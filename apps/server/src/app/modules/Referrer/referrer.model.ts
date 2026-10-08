import { Schema, model } from 'mongoose';
import { type TReferrer } from './referrer.interface';

const ReferrerSchema = new Schema<TReferrer>(
  {
    referrerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    hospital: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    defaultDiscountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    defaultCommissionType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
      default: 'percent',
    },
    // Percentage or taka depending on the type above, so no max here.
    defaultCommissionValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // One referrer entry per doctor. Sparse, so outside referrers are unaffected.
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ReferrerSchema.index({ name: 1 });
ReferrerSchema.index({ phone: 1 });

export const Referrer = model<TReferrer>('Referrer', ReferrerSchema);
