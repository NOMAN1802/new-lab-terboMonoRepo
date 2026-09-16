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
  | 'report.uploaded'
  | 'report.delivered'
  | 'commission.paid_out'
  | 'test.created'
  | 'test.price_changed'
  | 'test.removed'
  | 'referrer.created'
  | 'referrer.rates_changed'
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
