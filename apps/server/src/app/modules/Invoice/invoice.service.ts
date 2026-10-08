import httpStatus from 'http-status';
import type mongoose from 'mongoose';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import {
  dateRangeFilter,
  dhakaDateParts,
  resolveDateRange,
} from '../../utils/dateRange';
import {
  candidateFileUrls,
  deleteReportFile,
  getSignedFileUrl,
  uploadReportFile,
} from '../../utils/fileUpload';
import { round2 } from '../../utils/money';
import { generatePublicToken } from '../../utils/publicToken';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { Appointment } from '../Appointment/appointment.model';
import { CommissionPayout } from '../CommissionPayout/commission-payout.model';
import { nextSequence } from '../Counter/counter.model';
import { Patient } from '../Patient/patient.model';
import { Referrer } from '../Referrer/referrer.model';
import { PaymentServices } from '../Payment/payment.service';
import { Test } from '../Test/test.model';
import {
  type TCommissionType,
  type TInvoice,
  type TInvoiceItem,
} from './invoice.interface';
import { Invoice } from './invoice.model';
import { computeTotals } from './invoice.totals';

const InvoiceSearchableFields = [
  'invoiceNumber',
  'patientInfo.name',
  'patientInfo.phone',
  'patientInfo.patientId',
];

/**
 * Invoice numbers read NLDC-MM-DD-YY-NNN, e.g. NLDC-08-30-26-001.
 *
 * The date part is the Dhaka calendar day. The three-digit tail is a counter
 * that restarts each morning: invoiceNumber is uniquely indexed, so without it
 * the second booking of any day would collide with the first. It doubles as
 * the day's booking count at a glance.
 */
const buildInvoiceNumber = async (visitDate: Date): Promise<string> => {
  const { dd, mm, yy, yyyy } = dhakaDateParts(visitDate);
  const seq = await nextSequence(`invoice:${yyyy}-${mm}-${dd}`);
  return `NLDC-${mm}-${dd}-${yy}-${String(seq).padStart(3, '0')}`;
};

export type TCreateInvoiceInput = {
  patient: string;
  referrer?: string;
  testIds: string[];
  visitDate?: string;
  discountPercent?: number;
  notes?: string;
  /** Take the whole net payable as cash immediately — the usual counter case. */
  collectFullPayment?: boolean;
  /**
   * Take part of the net payable at the counter, leaving the rest due. The
   * patient settles the remainder over as many later payments as they need.
   * Ignored when collectFullPayment is set.
   */
  advanceAmount?: number;
};

/**
 * Builds invoice items from the catalogue. Prices are read from the Test
 * collection - never from the request - so a tampered payload cannot change
 * what a patient is billed.
 */
const buildItems = async (
  testIds: string[],
  session?: mongoose.ClientSession
): Promise<TInvoiceItem[]> => {
  const uniqueIds = [...new Set(testIds)];

  const tests = await Test.find({
    _id: { $in: uniqueIds },
    isDeleted: false,
    isActive: true,
  }).session(session ?? null);

  if (tests.length !== uniqueIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'One or more selected tests are unavailable'
    );
  }

  const byId = new Map(tests.map((test) => [String(test._id), test]));

  // Preserve the order the receptionist selected, including repeats.
  return testIds.map((id) => {
    const test = byId.get(id)!;
    return {
      test: test._id as Types.ObjectId,
      testCode: test.testCode,
      testName: test.name,
      categoryName: test.categoryName,
      price: test.price,
      reportStatus: 'pending' as const,
    };
  });
};

const isConsultation = (item: TInvoiceItem) => item.kind === 'consultation';

/** True when no line on the invoice is a lab test. */
const isConsultationOnly = (invoice: TInvoice) =>
  invoice.items.length > 0 && invoice.items.every(isConsultation);

export type TCreateConsultationInvoiceInput = {
  patient: string;
  appointment: Types.ObjectId;
  doctor: { _id: Types.ObjectId; name: string; specialty: string };
  fee: number;
  visitDate: Date;
  /**
   * The doctor's own Referrers entry and their share of the fee. The share is
   * recorded as the invoice's commission, so it is paid out with the rest of
   * the doctor's commission, and only once the patient has paid.
   */
  payee?: {
    _id: Types.ObjectId;
    referrerCode: string;
    name: string;
    designation?: string;
    hospital?: string;
  };
  share?: { type: TCommissionType; value: number };
};

/**
 * Bills a doctor consultation. It is an invoice of its own with one
 * consultation line, not a line added to a lab-test invoice: editing, report
 * handling and referrer commission all assume every line is a test, and
 * keeping the two apart means none of them can touch the consultation. The
 * fee comes from the approved schedule, never from the request.
 */
const createConsultationInvoice = async (
  input: TCreateConsultationInvoiceInput,
  userId: string
): Promise<TInvoice> => {
  const patient = await Patient.findOne({
    _id: input.patient,
    isDeleted: false,
  });
  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');

  const items: TInvoiceItem[] = [
    {
      kind: 'consultation',
      appointment: input.appointment,
      doctor: input.doctor._id,
      testCode: 'CONSULT',
      testName: `Consultation — ${input.doctor.name}`,
      categoryName: 'Consultation',
      price: input.fee,
      reportStatus: 'pending',
    },
  ];

  // No discount on a consultation. The doctor's share of the fee rides as the
  // commission, frozen here so a later change to the share only affects new
  // bookings. A flat share can never be more than the fee itself.
  const shareType: TCommissionType = input.payee && input.share ? input.share.type : 'percent';
  const rawShare = input.payee && input.share ? input.share.value : 0;
  const shareValue = shareType === 'fixed' ? Math.min(rawShare, input.fee) : Math.min(rawShare, 100);
  const totals = computeTotals(items, 0, shareType, shareValue, 0);

  const invoice = await Invoice.create({
    invoiceNumber: await buildInvoiceNumber(input.visitDate),
    visitDate: input.visitDate,
    patient: patient._id,
    patientInfo: {
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
    },
    items,
    ...(input.payee
      ? {
          referrer: input.payee._id,
          referrerInfo: {
            referrerCode: input.payee.referrerCode,
            name: input.payee.name,
            designation: input.payee.designation,
            hospital: input.payee.hospital,
          },
        }
      : {}),
    discountPercent: 0,
    commissionType: shareType,
    commissionValue: shareValue,
    ...totals,
    paidAmount: 0,
    commissionStatus: 'pending',
    createdBy: new Types.ObjectId(userId),
  });

  await recordActivity({
    userId,
    action: 'invoice.created',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary: `Billed consultation with ${input.doctor.name} for ${patient.name} — net ${invoice.netPayable}`,
    meta: { net: invoice.netPayable, doctor: input.doctor.name, consultation: true },
  });

  return invoice;
};

const createInvoice = async (
  payload: TCreateInvoiceInput,
  userId: string
): Promise<TInvoice> => {
  const patient = await Patient.findOne({
    _id: payload.patient,
    isDeleted: false,
  });
  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');

  let referrerDoc = null;
  if (payload.referrer) {
    referrerDoc = await Referrer.findOne({
      _id: payload.referrer,
      isDeleted: false,
    });
    if (!referrerDoc) {
      throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
    }
  }

  const items = await buildItems(payload.testIds);

  // The discount comes off the patient's bill; it defaults from the referrer
  // but can be given to a walk-in too, so an explicit value always wins.
  const discountPercent =
    payload.discountPercent ?? referrerDoc?.defaultDiscountPercent ?? 0;

  // Commission is settled by an Admin from the Doctor's Commission screen, not
  // agreed at the counter: booking only records who referred the patient. The
  // accrual therefore always comes from the referrer's standing terms, and with
  // no referrer there is nobody to pay.
  const commissionType = referrerDoc
    ? referrerDoc.defaultCommissionType
    : 'percent';
  const commissionValue = referrerDoc ? referrerDoc.defaultCommissionValue : 0;

  // Both are frozen onto the invoice below, so later changes to the referrer's
  // standing terms never rewrite past billing.
  const totals = computeTotals(
    items,
    discountPercent,
    commissionType,
    commissionValue,
    0
  );

  const visitDate = payload.visitDate ? new Date(payload.visitDate) : new Date();

  const invoice = await Invoice.create({
    invoiceNumber: await buildInvoiceNumber(visitDate),
    visitDate,
    patient: patient._id,
    patientInfo: {
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
    },
    referrer: referrerDoc?._id,
    referrerInfo: referrerDoc
      ? {
          referrerCode: referrerDoc.referrerCode,
          name: referrerDoc.name,
          designation: referrerDoc.designation,
          hospital: referrerDoc.hospital,
        }
      : undefined,
    items,
    discountPercent,
    commissionType,
    commissionValue,
    ...totals,
    paidAmount: 0,
    commissionStatus: 'pending',
    notes: payload.notes,
    createdBy: new Types.ObjectId(userId),
    publicToken: generatePublicToken(),
  });

  await recordActivity({
    userId,
    action: 'invoice.created',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary:
      `Booked ${items.length} test(s) for ${patient.name} — ` +
      `net ${invoice.netPayable}` +
      (referrerDoc ? ` (ref. ${referrerDoc.name})` : ' (walk-in)'),
    meta: {
      gross: invoice.grossAmount,
      discount: invoice.discountAmount,
      net: invoice.netPayable,
      commission: invoice.commissionAmount,
      referrer: referrerDoc?.name,
    },
  });

  // Money taken at the counter is receipted as part of the booking rather than
  // as a second step. That is either the whole net payable, or an advance with
  // the rest left due — the patient can then settle it over as many payments
  // as they like. A fully discounted invoice has nothing to collect and is
  // already marked paid.
  //
  // The amount is clamped to the net the server just computed, so a stale
  // price in the client's preview can never receipt more than is owed.
  const takeNow = payload.collectFullPayment
    ? invoice.netPayable
    : Math.min(payload.advanceAmount ?? 0, invoice.netPayable);

  if (takeNow > 0 && invoice.netPayable > 0) {
    const { invoice: settled } = await PaymentServices.createPayment(
      { invoice: String(invoice._id), amount: round2(takeNow) },
      userId
    );
    return settled;
  }

  return invoice;
};

const getInvoices = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  const baseQuery = Invoice.find({
    ...dateRangeFilter('visitDate', range),
  })
    .populate('createdBy', 'name email')
    .populate('patient', 'patientId name phone');

  const invoiceQuery = new QueryBuilder(baseQuery, query)
    .search(InvoiceSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [invoices, total] = await Promise.all([
    invoiceQuery.modelQuery,
    invoiceQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: invoices,
  };
};

const getInvoice = async (id: string): Promise<TInvoice> => {
  const invoice = await Invoice.findById(id)
    .populate('createdBy', 'name email')
    .populate('patient', 'patientId name phone age gender address');

  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  /**
   * Invoices raised before the QR feature carry no token, and the print view
   * needs one. Minting it here rather than in a migration means there is no
   * deploy-ordering step and no script to remember: the first time anyone
   * opens an old invoice it acquires a token, once, and keeps it. Reprints
   * therefore produce the same QR every time.
   */
  if (!invoice.publicToken && !isConsultationOnly(invoice)) {
    invoice.publicToken = generatePublicToken();
    await invoice.save();
  }

  return invoice;
};

/** Every invoice raised for a patient - powers the visit-history view. */
const getPatientInvoices = async (patientId: string) => {
  const patient = await Patient.findOne({ _id: patientId, isDeleted: false });
  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');

  const invoices = await Invoice.find({ patient: patientId }).sort({
    visitDate: -1,
  });

  return { patient, invoices };
};

/**
 * Replaces the booked tests on an invoice and re-derives every total.
 * Refuses if the new net would fall below what has already been collected -
 * that would imply an untracked refund.
 */
const updateInvoiceItems = async (
  id: string,
  testIds: string[],
  discountPercent?: number,
  commissionType?: TCommissionType,
  commissionValue?: number
): Promise<TInvoice> => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  if (invoice.isCancelled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot modify a cancelled invoice'
    );
  }

  if (invoice.items.some(isConsultation)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A consultation invoice cannot be edited. Cancel the appointment and book again.'
    );
  }

  const hasReports = invoice.items.some(
    (item) => item.reportStatus !== 'pending'
  );
  if (hasReports) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot change tests once a report has been uploaded against this invoice'
    );
  }

  const items = await buildItems(testIds);
  const nextDiscount = discountPercent ?? invoice.discountPercent;
  const nextCommissionType = commissionType ?? invoice.commissionType;
  const nextCommissionValue = commissionValue ?? invoice.commissionValue;

  const totals = computeTotals(
    items,
    nextDiscount,
    nextCommissionType,
    nextCommissionValue,
    invoice.paidAmount
  );

  if (totals.netPayable < invoice.paidAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Net payable would fall below the amount already collected. Void the excess payments before reducing this invoice.'
    );
  }

  invoice.set({
    items,
    discountPercent: nextDiscount,
    commissionType: nextCommissionType,
    commissionValue: nextCommissionValue,
    ...totals,
  });

  await invoice.save();
  return invoice;
};

/**
 * Calls off a single test without touching the rest of the invoice.
 *
 * The line is struck, not deleted: the patient was told they were being billed
 * for it, so it stays on the record with a reason against it and drops out of
 * the totals. Both roles may do this — a sample that cannot be drawn is a
 * counter problem, not an accounting one — but every cancellation carries a
 * reason and lands in the activity log.
 */
const cancelInvoiceItem = async (
  invoiceId: string,
  itemId: string,
  userId: string,
  reason: string
): Promise<TInvoice> => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  if (invoice.isCancelled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This invoice is already cancelled'
    );
  }

  const item = invoice.items.find((entry) => String(entry._id) === itemId);
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test not found on this invoice');
  }

  if (isConsultation(item)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A consultation is cancelled by cancelling its appointment.'
    );
  }

  if (item.isCancelled) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This test is already cancelled');
  }

  // A report in hand means the work was done, whatever happened afterwards.
  if (item.reportStatus !== 'pending') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `The ${item.testName} report has already been ${item.reportStatus}. Cancel the whole invoice instead if this booking should not stand.`
    );
  }

  const live = invoice.items.filter(
    (entry) => !entry.isCancelled && String(entry._id) !== itemId
  );

  // An invoice with nothing left on it is a cancelled invoice, and that is a
  // different action with its own record.
  if (live.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This is the only remaining test. Cancel the invoice instead.'
    );
  }

  const totals = computeTotals(
    live,
    invoice.discountPercent,
    invoice.commissionType,
    invoice.commissionValue,
    invoice.paidAmount
  );

  // Same rule as reducing an invoice by editing its tests: money already taken
  // cannot exceed what is owed, or the ledger hides a refund.
  if (totals.netPayable < invoice.paidAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cancelling this test would drop the bill to ${totals.netPayable}, below the ${invoice.paidAmount} already collected. Void the excess receipt first.`
    );
  }

  /**
   * Commission already handed over is not rewritten by a later cancellation.
   *
   * The centre really did pay that figure, and the CommissionPayout it belongs
   * to records both the amount and the invoices it covered — recomputing here
   * would leave the payout no longer equal to the sum of its own invoices, and
   * under-report what was actually paid out. It stays frozen at what was
   * settled; recovering the difference is a conversation with the doctor, not
   * a number that changes behind them.
   */
  const commissionSettled = invoice.commissionStatus === 'paid';
  const applied = commissionSettled
    ? { ...totals, commissionAmount: invoice.commissionAmount }
    : totals;

  item.isCancelled = true;
  item.cancelledAt = new Date();
  item.cancelledBy = new Types.ObjectId(userId);
  item.cancelReason = reason;

  invoice.set(applied);
  await invoice.save();

  await recordActivity({
    userId,
    action: 'invoice.item_cancelled',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary:
      `${item.testName} cancelled on ${invoice.invoiceNumber} for ${invoice.patientInfo.name} — ` +
      `net now ${invoice.netPayable} (${reason})` +
      (commissionSettled
        ? ` · commission held at ${invoice.commissionAmount}, already paid out`
        : ''),
    meta: {
      test: item.testName,
      price: item.price,
      net: invoice.netPayable,
      commission: invoice.commissionAmount,
      commissionFrozen: commissionSettled,
      reason,
    },
  });

  return invoice;
};

const cancelInvoice = async (
  id: string,
  userId: string,
  reason?: string,
  options: { fromAppointment?: boolean } = {}
): Promise<TInvoice> => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  if (invoice.isCancelled) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invoice is already cancelled');
  }

  if (invoice.paidAmount > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot cancel an invoice with payments recorded against it. Void the payments first.'
    );
  }

  // A consultation invoice belongs to its appointment: cancelling it alone
  // would leave the patient booked and the slot held for nothing.
  if (!options.fromAppointment) {
    const liveAppointment = await Appointment.exists({
      invoice: invoice._id,
      status: { $in: ['booked', 'checked_in'] },
    });
    if (liveAppointment) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This invoice is for a booked appointment. Cancel the appointment instead.'
      );
    }
  }

  /**
   * A cancelled invoice drops out of every report, which is fine while its
   * commission is still an accrual — but not once the doctor has been paid.
   * The payout record would go on claiming an amount that no longer has an
   * invoice behind it, and the "commission paid" column would quietly lose the
   * money that actually left the till.
   *
   * Blocked rather than reconciled here, because reversing a payout is a
   * decision with a person on the other end of it.
   */
  if (invoice.commissionStatus === 'paid') {
    const payout = invoice.commissionPayout
      ? await CommissionPayout.findById(invoice.commissionPayout).select(
          'payoutNumber'
        )
      : null;

    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Commission of ${invoice.commissionAmount} on this invoice has already been paid to ` +
        `${invoice.referrerInfo?.name ?? 'the referrer'}` +
        (payout ? ` under ${payout.payoutNumber}` : '') +
        '. Reverse that payout before cancelling the invoice.'
    );
  }

  invoice.set({
    isCancelled: true,
    cancelledAt: new Date(),
    cancelledBy: new Types.ObjectId(userId),
    cancelReason: reason,
  });

  await invoice.save();

  await recordActivity({
    userId,
    action: 'invoice.cancelled',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary: `Cancelled ${invoice.invoiceNumber} for ${invoice.patientInfo.name} — ${reason ?? 'no reason given'}`,
    meta: { net: invoice.netPayable, reason },
  });

  return invoice;
};

const uploadItemReport = async (
  invoiceId: string,
  itemId: string,
  file: Express.Multer.File,
  userId: string
): Promise<TInvoice> => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  const item = invoice.items.find((entry) => String(entry._id) === itemId);
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test not found on this invoice');
  }
  if (isConsultation(item)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A consultation has no report to upload.'
    );
  }

  const previous = item.reportFile;
  const stored = await uploadReportFile(file);

  item.reportFile = {
    ...stored,
    uploadedAt: new Date(),
    uploadedBy: new Types.ObjectId(userId),
  };
  item.reportStatus = 'uploaded';

  try {
    await invoice.save();
  } catch (error) {
    // Do not strand the just-uploaded file if the write fails.
    await deleteReportFile(stored.publicId, stored.resourceType).catch(
      () => undefined
    );
    throw error;
  }

  // Replacing a report supersedes the old file.
  if (previous?.publicId) {
    await deleteReportFile(previous.publicId, previous.resourceType).catch(
      () => undefined
    );
  }

  await recordActivity({
    userId,
    action: 'report.uploaded',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary:
      `${previous ? 'Replaced' : 'Uploaded'} the ${item.testName} report for ` +
      `${invoice.patientInfo.name} (${invoice.invoiceNumber})`,
    meta: { test: item.testName, file: stored.originalName, replaced: Boolean(previous) },
  });

  return invoice;
};

const markReportDelivered = async (
  invoiceId: string,
  itemId: string,
  userId: string
): Promise<TInvoice> => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  const item = invoice.items.find((entry) => String(entry._id) === itemId);
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test not found on this invoice');
  }

  if (isConsultation(item)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A consultation has no report to deliver.'
    );
  }

  if (item.reportStatus !== 'uploaded') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A report must be uploaded before it can be marked delivered'
    );
  }

  // The report is the leverage for collecting the balance, so it does not
  // leave the counter until the invoice is settled in full. The check is on
  // the invoice, not the item: a part-payment does not buy one report of a
  // multi-test booking, because payments are never allocated per test.
  if (invoice.paymentStatus !== 'paid') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invoice ${invoice.invoiceNumber} still has ${invoice.dueAmount} due — ` +
        'collect the balance before handing over the report'
    );
  }

  item.reportStatus = 'delivered';
  item.deliveredAt = new Date();

  await invoice.save();

  await recordActivity({
    userId,
    action: 'report.delivered',
    entity: 'Invoice',
    entityId: invoice._id,
    entityLabel: invoice.invoiceNumber,
    summary: `Handed the ${item.testName} report to ${invoice.patientInfo.name} (${invoice.invoiceNumber})`,
    meta: { test: item.testName },
  });

  return invoice;
};

/** Short-lived signed link - reports are medical records, not public assets. */
const getReportDownloadUrl = async (
  invoiceId: string,
  itemId: string
): Promise<{ url: string; originalName: string }> => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  const item = invoice.items.find((entry) => String(entry._id) === itemId);
  if (!item?.reportFile) {
    throw new AppError(httpStatus.NOT_FOUND, 'No report uploaded for this test');
  }

  return {
    url: getSignedFileUrl(item.reportFile),
    originalName: item.reportFile.originalName,
  };
};

/**
 * The report's actual bytes, fetched from storage server-side.
 *
 * Handing the browser a signed Cloudinary URL turned out to be the wrong shape
 * for this: the link had to be opened after an await (so popup blockers ate
 * it), and the filename and content type were whatever Cloudinary inferred
 * from the stored path — which for a raw PDF was nothing at all. Streaming it
 * ourselves means the type and name come from what we recorded at upload.
 */
const getReportFile = async (
  invoiceId: string,
  itemId: string
): Promise<{ body: Buffer; mimeType: string; fileName: string }> => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  const item = invoice.items.find((entry) => String(entry._id) === itemId);
  if (!item?.reportFile) {
    throw new AppError(httpStatus.NOT_FOUND, 'No report uploaded for this test');
  }

  // No attachment flag on any of these: this is a plain fetch of the stored
  // bytes, and the Content-Disposition goes on our own response instead.
  const attempts: string[] = [];
  let body: Buffer | undefined;

  for (const url of candidateFileUrls(item.reportFile)) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        body = Buffer.from(await response.arrayBuffer());
        break;
      }
      attempts.push(String(response.status));
    } catch {
      attempts.push('unreachable');
    }
  }

  if (!body) {
    // The statuses are the whole diagnosis when storage refuses a report, so
    // they travel with the message rather than only into a log.
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Storage would not return this report (tried ${attempts.length}: ${attempts.join(', ')}). ` +
        'Re-uploading the file will fix it.'
    );
  }

  return {
    body,
    mimeType: item.reportFile.mimeType || 'application/octet-stream',
    fileName: item.reportFile.originalName || 'report',
  };
};

export const InvoiceServices = {
  createInvoice,
  createConsultationInvoice,
  getInvoices,
  getInvoice,
  getPatientInvoices,
  updateInvoiceItems,
  cancelInvoice,
  cancelInvoiceItem,
  uploadItemReport,
  markReportDelivered,
  getReportDownloadUrl,
  getReportFile,
};
