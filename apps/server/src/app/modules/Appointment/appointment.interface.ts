import { type Types } from 'mongoose';
import { type TGender } from '../Patient/patient.interface';

export type TAppointmentStatus =
  | 'booked'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** The patient as they were when booked, so later edits never rewrite the slip. */
export type TAppointmentPatient = {
  patientId: string;
  name: string;
  age: number;
  gender: TGender;
  phone: string;
};

/**
 * Raised when a booking is cancelled by someone other than the desk (the doctor
 * blocked the slot, or a schedule was cancelled), so the patient has to be
 * told. Stays open until the desk marks the patient informed.
 */
export type TCallback = {
  reason: string;
  requestedAt: Date;
  doneAt?: Date;
  doneBy?: Types.ObjectId;
  doneByName?: string;
};

export type TCancelRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * A cancellation asked for by the desk and answered by an admin. The
 * appointment keeps its own status until the admin approves; a rejected
 * request stays on record so the desk can see why it was refused.
 */
export type TCancellation = {
  status: TCancelRequestStatus;
  reason: string;
  requestedBy: Types.ObjectId;
  requestedByName: string;
  requestedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  /** When the person who asked acknowledged the answer. Unset means unseen. */
  requesterSeenAt?: Date;
};

/** One patient place in one slot of an approved schedule. */
export type TAppointment = {
  _id?: Types.ObjectId;
  appointmentNumber: string;
  schedule: Types.ObjectId;
  doctor: Types.ObjectId;
  patient: Types.ObjectId;
  patientInfo: TAppointmentPatient;
  /** Zero-based position within the schedule. Unique per schedule while held. */
  slotIndex: number;
  /** One-based token the patient is called by. */
  serialNo: number;
  /** Midnight at the start of the Dhaka day, copied from the schedule. */
  date: Date;
  slotStart: Date;
  slotEnd: Date;
  /** "HH:mm", Dhaka time, for display. */
  startTime: string;
  endTime: string;
  fee: number;
  /** The invoice billing the consultation fee. */
  invoice?: Types.ObjectId;
  invoiceNumber?: string;
  status: TAppointmentStatus;
  /**
   * True while the appointment occupies its slot. Only a cancelled one lets go
   * of it. A unique index over (schedule, slotIndex) where this is true is what
   * stops two people booking the same slot.
   */
  holdsSlot: boolean;
  notes?: string;
  cancelReason?: string;
  cancellation?: TCancellation;
  callback?: TCallback;
  checkedInAt?: Date;
  completedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
