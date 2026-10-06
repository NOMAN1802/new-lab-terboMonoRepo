import { type Types } from 'mongoose';

export type TPaymentKind = 'payment' | 'refund';

/**
 * A single cash receipt against an invoice. An invoice may have many.
 *
 * A refund is an entry in the same ledger with a negative amount, so every
 * total that sums the ledger (cash collected, the till per receptionist, the
 * invoice paid and due) nets it out without special cases.
 * The invoice's paidAmount is a cache of the non-voided total here — this
 * collection is the source of truth for money received.
 */
export type TPayment = {
  _id?: Types.ObjectId;
  receiptNumber: string;
  invoice: Types.ObjectId;
  invoiceNumber: string;
  patient: Types.ObjectId;
  patientName: string;
  /** Negative for a refund. Never zero. */
  amount: number;
  /** Absent on receipts taken before refunds existed, which are all payments. */
  kind?: TPaymentKind;
  method: 'cash';
  paymentDate: Date;
  receivedBy: Types.ObjectId;
  receivedByName: string;
  note?: string;

  /** Mistakes are reversed by voiding, never by deleting — the trail stays. */
  isVoided?: boolean;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
};
