import { Schema, model } from 'mongoose';
import { type TCommissionPayout } from './commission-payout.interface';

const CommissionPayoutSchema = new Schema<TCommissionPayout>(
  {
    payoutNumber: { type: String, required: true, unique: true },
    referrer: { type: Schema.Types.ObjectId, ref: 'Referrer', required: true },
    referrerName: { type: String, required: true },
    referrerCode: { type: String, required: true },

    invoices: [{ type: Schema.Types.ObjectId, ref: 'Invoice' }],
    invoiceCount: { type: Number, required: true, min: 0 },

    periodFrom: { type: Date },
    periodTo: { type: Date },

    amount: { type: Number, required: true, min: 0 },
    paidOn: { type: Date, required: true, default: Date.now },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

CommissionPayoutSchema.index({ referrer: 1, paidOn: -1 });

export const CommissionPayout = model<TCommissionPayout>(
  'CommissionPayout',
  CommissionPayoutSchema
);
