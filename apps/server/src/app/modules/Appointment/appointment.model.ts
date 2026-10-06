import { Schema, model } from 'mongoose';
import { type TAppointment } from './appointment.interface';

const PatientInfoSchema = new Schema(
  {
    patientId: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const CancellationSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: { type: String, required: true },
    requestedAt: { type: Date, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedByName: { type: String },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
    requesterSeenAt: { type: Date },
  },
  { _id: false }
);

const CallbackSchema = new Schema(
  {
    reason: { type: String, required: true, trim: true },
    requestedAt: { type: Date, required: true },
    doneAt: { type: Date },
    doneBy: { type: Schema.Types.ObjectId, ref: 'User' },
    doneByName: { type: String },
  },
  { _id: false }
);

const AppointmentSchema = new Schema<TAppointment>(
  {
    appointmentNumber: { type: String, required: true, unique: true },
    schedule: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorSchedule',
      required: true,
    },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientInfo: { type: PatientInfoSchema, required: true },
    slotIndex: { type: Number, required: true, min: 0 },
    serialNo: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    fee: { type: Number, required: true, min: 0 },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: { type: String },
    status: {
      type: String,
      enum: ['booked', 'checked_in', 'completed', 'cancelled', 'no_show'],
      default: 'booked',
    },
    holdsSlot: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    cancellation: { type: CancellationSchema },
    callback: { type: CallbackSchema },
    checkedInAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// The double-booking guard: one live appointment per slot. Filtering on an
// equality keeps this to a plain partial index, which every MongoDB supports.
AppointmentSchema.index(
  { schedule: 1, slotIndex: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true } }
);
AppointmentSchema.index({ date: 1, doctor: 1, status: 1 });
AppointmentSchema.index({ patient: 1, date: 1 });
AppointmentSchema.index({ invoice: 1 });
AppointmentSchema.index({ 'cancellation.status': 1 });
AppointmentSchema.index({ 'callback.requestedAt': 1, 'callback.doneAt': 1 });

export const Appointment = model<TAppointment>('Appointment', AppointmentSchema);
