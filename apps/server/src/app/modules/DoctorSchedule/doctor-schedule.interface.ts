import { type Types } from 'mongoose';

export type TScheduleStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

/** One slot taken out of an approved schedule, e.g. for a break or an emergency. */
export type TBlockedSlot = {
  slotIndex: number;
  reason: string;
  blockedBy: Types.ObjectId;
  blockedByName: string;
  blockedAt: Date;
};

/**
 * A block of time a doctor is offered for consultations.
 *
 * The admin proposes it (`pending`); the doctor then accepts (`approved`) or
 * rejects it (`declined`). Only approved schedules can ever be booked.
 */
export type TDoctorSchedule = {
  _id?: Types.ObjectId;
  doctor: Types.ObjectId;
  /** Midnight at the start of the Dhaka calendar day. */
  date: Date;
  /** 24h "HH:mm", Dhaka time. */
  startTime: string;
  endTime: string;
  slotMinutes: number;
  /** Consultation fee in taka, frozen from the doctor's default at creation. */
  fee: number;
  status: TScheduleStatus;
  declineReason?: string;
  cancelReason?: string;
  /** Slots that cannot be booked. Positions refer to the current time layout. */
  blockedSlots?: TBlockedSlot[];
  respondedAt?: Date;
  respondedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
