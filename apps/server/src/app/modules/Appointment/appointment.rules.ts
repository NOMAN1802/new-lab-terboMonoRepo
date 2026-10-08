import { type TAppointmentStatus } from './appointment.interface';

export type TAppointmentAction = 'check_in' | 'cancel' | 'no_show' | 'complete';

const ALLOWED_FROM: Record<TAppointmentAction, TAppointmentStatus[]> = {
  check_in: ['booked'],
  // Cancelling is allowed up to the point the doctor has seen the patient.
  cancel: ['booked', 'checked_in'],
  no_show: ['booked'],
  complete: ['checked_in'],
};

const RESULT: Record<TAppointmentAction, TAppointmentStatus> = {
  check_in: 'checked_in',
  cancel: 'cancelled',
  no_show: 'no_show',
  complete: 'completed',
};

/**
 * A patient can be moved to another slot only before they have arrived. Once
 * checked in they are being seen, so the visit is finished or cancelled instead.
 */
export const canReschedule = (status: TAppointmentStatus): boolean =>
  status === 'booked';

export const allowedFrom = (action: TAppointmentAction): TAppointmentStatus[] =>
  ALLOWED_FROM[action];

export const canApply = (
  status: TAppointmentStatus,
  action: TAppointmentAction
): boolean => ALLOWED_FROM[action].includes(status);

export const resultOf = (action: TAppointmentAction): TAppointmentStatus =>
  RESULT[action];

/** Only a cancelled appointment gives its slot back. */
export const holdsSlot = (status: TAppointmentStatus): boolean =>
  status !== 'cancelled';

export type TSlotState = 'free' | 'taken' | 'past' | 'blocked';

/** What a receptionist sees for one slot of the day. */
export const slotState = (
  slot: { end: Date },
  taken: boolean,
  now: Date,
  blocked = false
): TSlotState => {
  if (taken) return 'taken';
  if (blocked) return 'blocked';
  return slot.end <= now ? 'past' : 'free';
};
