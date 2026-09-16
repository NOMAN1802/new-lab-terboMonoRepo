import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { candidateFileUrls } from '../../utils/fileUpload';
import { lastFourDigits, maskName } from '../../utils/publicToken';
import { Invoice } from '../Invoice/invoice.model';
import { type TInvoice } from '../Invoice/invoice.interface';
import { signPublicSession } from './public-report.token';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Anything that fails to identify an invoice answers 404, never 401.
 *
 * Two reasons. A 401 from this API triggers the client's refresh-and-logout
 * path, so a patient opening a stale QR on the front desk's browser would sign
 * the receptionist out. And 404 tells someone probing tokens nothing about
 * whether a given one exists.
 */
const notFound = () =>
  new AppError(httpStatus.NOT_FOUND, 'This link is not valid');

const findByToken = async (token: string) => {
  // A token that is not the right shape never reaches the database.
  if (!token || token.length > 64) throw notFound();

  const invoice = await Invoice.findOne({ publicToken: token });
  if (!invoice) throw notFound();
  return invoice;
};

/**
 * What a scan shows before the patient proves who they are: enough to
 * recognise their own invoice, and nothing a stranger could use.
 *
 * Note what is absent - no amounts, no test names, no phone, no address. The
 * paper invoice already shows all of that to whoever is holding it, but a
 * photographed QR should reveal nothing on its own.
 */
const getSummary = async (token: string) => {
  const invoice = await findByToken(token);

  return {
    invoiceNumber: invoice.invoiceNumber,
    patientName: maskName(invoice.patientInfo.name),
    visitDate: invoice.visitDate,
    isCancelled: Boolean(invoice.isCancelled),
  };
};

/**
 * Which tests the patient may see, and which are still being worked on.
 *
 * Built only for a settled invoice; the caller decides that. Cancelled tests
 * are dropped rather than shown struck through - the patient is not being
 * billed for them and has no report coming.
 */
const visibleItems = (invoice: TInvoice) =>
  invoice.items
    .filter((item) => !item.isCancelled)
    .map((item) => ({
      itemId: String((item as unknown as { _id: unknown })._id),
      testName: item.testName,
      testCode: item.testCode,
      // Both 'uploaded' and 'delivered' mean the file exists and is readable.
      // 'delivered' only records that the desk also handed over a paper copy.
      ready: item.reportStatus !== 'pending' && Boolean(item.reportFile),
      originalName: item.reportFile?.originalName,
      mimeType: item.reportFile?.mimeType,
    }));

/**
 * The payload behind the phone check. Three states, and the caller never gets
 * to choose which: a cancelled invoice yields nothing, an unsettled one yields
 * the balance and no test names, and only a settled one lists reports.
 *
 * Test names are withheld while money is owed on purpose. An unpaid patient is
 * still a patient, and which tests someone ordered is medical information in
 * its own right.
 */
const buildPayload = (invoice: TInvoice) => {
  const base = {
    invoiceNumber: invoice.invoiceNumber,
    patientName: invoice.patientInfo.name,
    visitDate: invoice.visitDate,
  };

  if (invoice.isCancelled) {
    return { ...base, state: 'cancelled' as const };
  }

  if (invoice.paymentStatus !== 'paid') {
    return {
      ...base,
      state: 'unpaid' as const,
      netPayable: invoice.netPayable,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
    };
  }

  return {
    ...base,
    state: 'ready' as const,
    items: visibleItems(invoice),
  };
};

/**
 * The phone check itself.
 *
 * Four digits is only 10,000 combinations, so the lockout is what makes it
 * stand up: five wrong answers freezes the token for fifteen minutes, which
 * caps a guesser at roughly twenty tries an hour. Combined with the 128-bit
 * token an attacker must already be holding, that is a sound gate. The counter
 * lives on the document because the API runs serverless and has no memory
 * between requests.
 */
const verify = async (token: string, last4: string) => {
  const invoice = await findByToken(token);

  const lockedUntil = invoice.publicAccess?.lockedUntil;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Too many incorrect attempts. Try again in ${minutes} minute(s).`
    );
  }

  const expected = lastFourDigits(invoice.patientInfo.phone ?? '');

  // A patient record with no usable phone cannot be verified this way at all.
  // Letting an empty expected value match an empty guess would open every such
  // invoice to anyone holding the link.
  if (!expected || expected.length < 4 || last4 !== expected) {
    const attempts = (invoice.publicAccess?.failedAttempts ?? 0) + 1;
    invoice.publicAccess = {
      failedAttempts: attempts,
      lockedUntil:
        attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCK_MINUTES * 60000)
          : undefined,
    };
    await invoice.save();

    throw new AppError(
      httpStatus.UNAUTHORIZED,
      attempts >= MAX_ATTEMPTS
        ? `Too many incorrect attempts. Try again in ${LOCK_MINUTES} minutes.`
        : 'That does not match the phone number on this invoice'
    );
  }

  // Clean slate, so an earlier run of typos never counts against a patient who
  // has now proved who they are.
  invoice.publicAccess = { failedAttempts: 0, lockedUntil: undefined };
  await invoice.save();

  return {
    accessToken: signPublicSession(String(invoice._id)),
    ...buildPayload(invoice),
  };
};

/**
 * Streams one report.
 *
 * Every gate is re-asserted here rather than trusted from the payload that
 * listed the item: a patient who was shown a list is not thereby authorised to
 * fetch anything they can name. Settlement in particular is checked again - an
 * invoice can be settled when the list is built and refunded before the file
 * is requested.
 */
const getReportFile = async (invoiceId: string, itemId: string) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound();

  if (invoice.isCancelled) {
    throw new AppError(httpStatus.FORBIDDEN, 'This invoice has been cancelled');
  }

  if (invoice.paymentStatus !== 'paid') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Reports are available once the invoice is settled in full'
    );
  }

  const item = invoice.items.find(
    (entry) => String((entry as unknown as { _id: unknown })._id) === itemId
  );

  if (!item || item.isCancelled) throw notFound();

  if (item.reportStatus === 'pending' || !item.reportFile) {
    throw new AppError(httpStatus.NOT_FOUND, 'This report is not ready yet');
  }

  /**
   * The same ladder the staff route walks. Cloudinary assets are stored as
   * 'authenticated', so a browser can never be sent at them directly - the
   * bytes come back through here.
   */
  const attempts: string[] = [];
  for (const url of candidateFileUrls(item.reportFile)) {
    const response = await fetch(url);
    if (response.ok) {
      return {
        body: Buffer.from(await response.arrayBuffer()),
        mimeType: item.reportFile.mimeType || 'application/octet-stream',
        fileName: item.reportFile.originalName || 'report',
      };
    }
    attempts.push(String(response.status));
  }

  throw new AppError(
    httpStatus.BAD_GATEWAY,
    `Could not fetch the report file (tried ${attempts.join(', ')})`
  );
};

export const PublicReportServices = {
  getSummary,
  verify,
  getReportFile,
};
