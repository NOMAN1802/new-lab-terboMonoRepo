import { type Types } from 'mongoose';

/**
 * A settlement of accrued commission to one referrer. Recording a payout
 * flips the covered invoices' commissionStatus to 'paid', which is what makes
 * the accrued / paid / pending split on the commission report meaningful.
 */
export type TPayoutKind = 'lab' | 'appointment';

export type TCommissionPayout = {
  _id?: Types.ObjectId;
  payoutNumber: string;
  referrer: Types.ObjectId;
  referrerName: string;
  referrerCode: string;
  invoices: Types.ObjectId[];
  invoiceCount: number;
  /**
   * What the payout settles: commission on lab tests a doctor referred, or a
   * doctor's share of appointment fees. Older payouts have none and were lab.
   */
  kind?: TPayoutKind;
  periodFrom?: Date;
  periodTo?: Date;
  amount: number;
  paidOn: Date;
  paidBy: Types.ObjectId;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
