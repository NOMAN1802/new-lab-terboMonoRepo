import { type TUserRole } from '../User/user.interface';
import { type TInvoice } from './invoice.interface';

type TPlain = Record<string, unknown>;

const toPlain = (doc: unknown): TPlain =>
  typeof (doc as { toObject?: () => TPlain })?.toObject === 'function'
    ? (doc as { toObject: () => TPlain }).toObject()
    : { ...(doc as TPlain) };

/** What the centre owes the referring doctor — an Admin-only matter. */
const COMMISSION_FIELDS = [
  'commissionType',
  'commissionValue',
  'commissionAmount',
  'commissionStatus',
  'commissionPayout',
] as const;

/**
 * The patient's side of an invoice is returned in full to both roles: a
 * receptionist books, collects and prints, so gross, discount, net, paid and
 * due all come through.
 *
 * The doctor's side does not. Commission is arranged and settled by an Admin
 * alone, from the Doctor's Commission screen, so every commission figure is
 * stripped here — along with the referrer's standing rate card, which is a
 * commercial term across all their patients rather than a figure on this
 * invoice.
 *
 * The §4.2 restriction is enforced elsewhere for aggregates: a receptionist's
 * dashboard payload carries no revenue totals, and every financial report and
 * the commission-payout module are admin-only at the route layer.
 */
export const serializeInvoice = (invoice: TInvoice, role: TUserRole): TPlain => {
  const plain = toPlain(invoice);

  /**
   * Brute-force bookkeeping for the patient QR check. Both roles print the
   * invoice, so publicToken stays -- it is the QR -- but the attempt counter
   * and lockout are the server's own business and would only invite a UI to
   * start making decisions from them.
   */
  delete plain.publicAccess;

  if (role === 'admin') return plain;

  for (const field of COMMISSION_FIELDS) {
    delete plain[field];
  }

  const referrer = plain.referrer as TPlain | undefined;
  if (referrer && typeof referrer === 'object') {
    delete referrer.defaultDiscountPercent;
    delete referrer.defaultCommissionType;
    delete referrer.defaultCommissionValue;
  }

  return plain;
};

export const serializeInvoices = (
  invoices: TInvoice[],
  role: TUserRole
): TPlain[] => invoices.map((invoice) => serializeInvoice(invoice, role));
