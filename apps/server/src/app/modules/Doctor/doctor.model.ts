import { Schema, model } from 'mongoose';
import { type TDoctor } from './doctor.interface';

const DoctorSchema = new Schema<TDoctor>(
  {
    doctorCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    degrees: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    consultationFee: { type: Number, required: true, min: 0, default: 0 },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    referrer: { type: Schema.Types.ObjectId, ref: 'Referrer' },
    appointmentShareType: {
      type: String,
      enum: ['percent', 'fixed'],
      default: 'percent',
    },
    // A percent when the type is percent, taka when fixed.
    appointmentShareValue: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

DoctorSchema.index({ name: 1 });
DoctorSchema.index({ specialty: 1 });

export const Doctor = model<TDoctor>('Doctor', DoctorSchema);
