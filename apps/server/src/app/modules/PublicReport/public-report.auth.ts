import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { catchAsync } from '../../utils/catchAsync';
import { Invoice } from '../Invoice/invoice.model';
import { verifyPublicSession } from './public-report.token';

/**
 * Guards the patient report endpoints.
 *
 * Deliberately not the staff `auth` middleware, and deliberately not accepting
 * a staff token: the two credential types verify against different secrets, so
 * neither can stand in for the other.
 *
 * Failures answer 403, not 401. A 401 from this API drives the client's
 * refresh-then-logout path, and a patient hitting an expired session on the
 * front desk's browser must not sign the receptionist out.
 */
export const publicReportAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : header;

  const session = raw ? verifyPublicSession(raw) : null;
  if (!session) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This session has expired. Scan the code again.'
    );
  }

  /**
   * The session says which invoice it is for; the URL says which token is
   * being browsed. They must be the same invoice, or a patient holding one
   * valid session could read every other invoice by editing the address.
   */
  const invoice = await Invoice.findOne({ publicToken: req.params.token });
  if (!invoice || String(invoice._id) !== session.invoiceId) {
    throw new AppError(httpStatus.NOT_FOUND, 'This link is not valid');
  }

  req.publicSession = { invoiceId: session.invoiceId };
  next();
});
