import { type Types } from 'mongoose';
import { type TCommissionType } from '../Invoice/invoice.interface';

/**
 * A consulting doctor who can be given a schedule and booked by patients.
 *
 * Distinct from Referrer, which is someone who sends patients to the centre and
 * is paid commission. A doctor here has a login (`user`) so they can approve or
 * decline the schedules the admin creates for them.
 */
export type TDoctor = {
  _id?: Types.ObjectId;
  doctorCode: string;
  name: string;
  specialty: string;
  degrees?: string;
  phone: string;
  /** Default fee for a consultation, in taka. Snapshotted onto each schedule. */
  consultationFee: number;
  /**
   * The doctor's own entry on the Referrers list, made with the doctor. It is
   * how they are picked as the referrer on a lab booking and how their
   * earnings are paid out.
   */
  referrer?: Types.ObjectId;
  /** What the doctor earns from each appointment fee: a percent of it, or flat taka. */
  appointmentShareType?: TCommissionType;
  appointmentShareValue?: number;
  user: Types.ObjectId;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
