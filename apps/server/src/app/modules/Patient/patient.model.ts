import { Schema, model } from 'mongoose';
import { type TPatient } from './patient.interface';

const PatientSchema = new Schema<TPatient>(
  {
    patientId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PatientSchema.index({ name: 1 });
PatientSchema.index({ phone: 1 });
PatientSchema.index({ createdAt: -1 });

export const Patient = model<TPatient>('Patient', PatientSchema);
