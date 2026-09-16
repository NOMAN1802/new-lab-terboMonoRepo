import { type Types } from 'mongoose';

/**
 * A single cash receipt against an invoice. An invoice may have many.
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
  amount: number;
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
