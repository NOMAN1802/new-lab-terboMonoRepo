import { Schema, model } from 'mongoose';
import { type TPrescription } from './prescription.interface';

const MedicineSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    dose: { type: String, trim: true },
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },
    instruction: { type: String, trim: true },
  },
  { _id: false }
);

const PrescriptionSchema = new Schema<TPrescription>(
  {
    prescriptionNumber: { type: String, required: true, unique: true },
    // One prescription per visit. The unique index also settles a double submit.
    appointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientInfo: {
      type: new Schema(
        {
          patientId: { type: String, required: true },
          name: { type: String, required: true },
          age: { type: Number, required: true },
          gender: { type: String, required: true },
          phone: { type: String, required: true },
        },
        { _id: false }
      ),
      required: true,
    },
    doctorInfo: {
      type: new Schema(
        {
          doctorCode: { type: String, required: true },
          name: { type: String, required: true },
          specialty: { type: String, required: true },
          degrees: { type: String },
        },
        { _id: false }
      ),
      required: true,
    },
    visitDate: { type: Date, required: true },
    complaints: { type: String, trim: true },
    diagnosis: { type: String, trim: true },
    medicines: { type: [MedicineSchema], default: [] },
    investigations: { type: [String], default: [] },
    advice: { type: String, trim: true },
    followUpDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PrescriptionSchema.index({ patient: 1, visitDate: -1 });
PrescriptionSchema.index({ doctor: 1, visitDate: -1 });

export const Prescription = model<TPrescription>(
  'Prescription',
  PrescriptionSchema
);
