import { type Types } from 'mongoose';

/**
 * The events worth auditing: anything that moves money, alters a patient
 * record, changes what a test costs, or grants access.
 */
export type TActivityAction =
  | 'patient.registered'
  | 'patient.updated'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.cancelled'
  | 'invoice.item_cancelled'
  | 'payment.recorded'
  | 'payment.voided'
  | 'payment.refunded'
  | 'report.uploaded'
  | 'report.delivered'
  | 'commission.paid_out'
  | 'test.created'
  | 'test.price_changed'
  | 'test.removed'
  | 'referrer.created'
  | 'referrer.rates_changed'
  | 'doctor.created'
  | 'doctor.updated'
  | 'doctor.removed'
  | 'referrer.linked_doctor'
  | 'schedule.created'
  | 'schedule.approved'
  | 'schedule.declined'
  | 'schedule.cancelled'
  | 'schedule.updated'
  | 'schedule.slot_blocked'
  | 'schedule.slot_unblocked'
  | 'appointment.informed'
  | 'appointment.booked'
  | 'appointment.checked_in'
  | 'appointment.completed'
  | 'appointment.no_show'
  | 'appointment.cancelled'
  | 'appointment.cancel_requested'
  | 'appointment.cancel_rejected'
  | 'appointment.rescheduled'
  | 'prescription.saved'
  | 'user.created'
  | 'user.updated'
  | 'user.removed';

export type TActivityLog = {
  _id?: Types.ObjectId;
  actor: Types.ObjectId;
  actorName: string;
  actorRole: string;
  action: TActivityAction;
  /** Collection the event concerns, e.g. 'Invoice'. */
  entity: string;
  entityId?: Types.ObjectId;
  /** Human-facing handle for the record, e.g. an invoice number. */
  entityLabel?: string;
  /** A short, readable sentence describing what happened. */
  summary: string;
  /** Small structured extras — amounts, before/after values. */
  meta?: Record<string, unknown>;
  at: Date;
};
