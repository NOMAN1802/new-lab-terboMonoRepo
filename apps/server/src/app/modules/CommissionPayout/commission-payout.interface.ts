import { type Types } from 'mongoose';

/**
 * A settlement of accrued commission to one referrer. Recording a payout
 * flips the covered invoices' commissionStatus to 'paid', which is what makes
 * the accrued / paid / pending split on the commission report meaningful.
 */
export type TCommissionPayout = {
  _id?: Types.ObjectId;
  payoutNumber: string;
  referrer: Types.ObjectId;
  referrerName: string;
  referrerCode: string;
  invoices: Types.ObjectId[];
  invoiceCount: number;
  periodFrom?: Date;
  periodTo?: Date;
  amount: number;
  paidOn: Date;
  paidBy: Types.ObjectId;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
