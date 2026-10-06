import { type TScheduleStatus } from './doctor-schedule.interface';

export const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (totalMinutes: number): string => {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export type TSlot = {
  slotIndex: number;
  serialNo: number;
  startTime: string;
  endTime: string;
  start: Date;
  end: Date;
};

type TSlotInput = {
  /** YYYY-MM-DD, a Dhaka calendar day. */
  date: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

/**
 * Number of whole slots that fit in the window. A leftover shorter than one
 * slot is dropped rather than creating a short appointment.
 */
export const countSlots = ({
  startTime,
  endTime,
  slotMinutes,
}: Omit<TSlotInput, 'date'>): number => {
  const span = toMinutes(endTime) - toMinutes(startTime);
  if (span <= 0 || slotMinutes <= 0) return 0;
  return Math.floor(span / slotMinutes);
};

/** Fixed-length slots, numbered 1..n in time order (the serial number). */
export const generateSlots = (input: TSlotInput): TSlot[] => {
  const count = countSlots(input);
  const first = toMinutes(input.startTime);

  return Array.from({ length: count }, (_, index) => {
    const from = first + index * input.slotMinutes;
    const to = from + input.slotMinutes;
    const startTime = toTime(from);
    const endTime = toTime(to);

    return {
      slotIndex: index,
      serialNo: index + 1,
      startTime,
      endTime,
      start: new Date(`${input.date}T${startTime}:00+06:00`),
      end: new Date(`${input.date}T${endTime}:00+06:00`),
    };
  });
};

/** True when two same-day windows share any time. Touching ends do not overlap. */
export const rangesOverlap = (
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean =>
  toMinutes(a.startTime) < toMinutes(b.endTime) &&
  toMinutes(a.endTime) > toMinutes(b.startTime);

export type TScheduleAction = 'approve' | 'decline' | 'cancel' | 'edit';

const ALLOWED: Record<TScheduleAction, TScheduleStatus[]> = {
  // Only the proposed schedule is awaiting an answer.
  approve: ['pending'],
  decline: ['pending'],
  // An approved schedule can still be withdrawn; a finished one cannot.
  cancel: ['pending', 'approved'],
  // Changing an approved schedule would silently change what the doctor agreed
  // to, so it must be cancelled and re-proposed instead.
  edit: ['pending'],
};

export const canApply = (
  status: TScheduleStatus,
  action: TScheduleAction
): boolean => ALLOWED[action].includes(status);

export const nextStatus = (
  action: Exclude<TScheduleAction, 'edit'>
): TScheduleStatus =>
  ({ approve: 'approved', decline: 'declined', cancel: 'cancelled' } as const)[
    action
  ];
