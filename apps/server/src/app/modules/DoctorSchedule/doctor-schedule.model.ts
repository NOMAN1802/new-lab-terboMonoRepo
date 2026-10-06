import { Schema, model } from 'mongoose';
import { type TDoctorSchedule } from './doctor-schedule.interface';

const BlockedSlotSchema = new Schema(
  {
    slotIndex: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedByName: { type: String, required: true },
    blockedAt: { type: Date, required: true },
  },
  { _id: false }
);

const DoctorScheduleSchema = new Schema<TDoctorSchedule>(
  {
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotMinutes: { type: Number, required: true, min: 5, max: 120 },
    fee: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'cancelled'],
      default: 'pending',
    },
    declineReason: { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    blockedSlots: { type: [BlockedSlotSchema], default: [] },
    respondedAt: { type: Date },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

DoctorScheduleSchema.index({ doctor: 1, date: 1, status: 1 });
DoctorScheduleSchema.index({ status: 1, date: 1 });

export const DoctorSchedule = model<TDoctorSchedule>(
  'DoctorSchedule',
  DoctorScheduleSchema
);
