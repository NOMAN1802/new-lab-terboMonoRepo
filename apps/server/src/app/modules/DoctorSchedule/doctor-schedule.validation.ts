import { z } from 'zod';
import { toMinutes } from './schedule.rules';

const objectId = z
  .string({ required_error: 'Doctor is required' })
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const date = z
  .string({ required_error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const time = z
  .string({ required_error: 'Time is required' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24-hour)');

const slotMinutes = z
  .number({ invalid_type_error: 'Slot length must be a number' })
  .int('Slot length must be a whole number of minutes')
  .min(5, 'Slots must be at least 5 minutes')
  .max(120, 'Slots cannot be longer than 120 minutes');

const reason = z
  .string({ required_error: 'A reason is required' })
  .trim()
  .min(3, 'A reason is required');

const endsAfterStart = (value: { startTime?: string; endTime?: string }) =>
  !value.startTime ||
  !value.endTime ||
  toMinutes(value.endTime) > toMinutes(value.startTime);

const createScheduleValidationSchema = z.object({
  body: z
    .object({
      doctor: objectId,
      date,
      startTime: time,
      endTime: time,
      slotMinutes,
      fee: z.number().min(0, 'Fee cannot be negative').optional(),
    })
    .refine(endsAfterStart, {
      message: 'End time must be after start time',
      path: ['endTime'],
    }),
});

const updateScheduleValidationSchema = z.object({
  body: z
    .object({
      date: date.optional(),
      startTime: time.optional(),
      endTime: time.optional(),
      slotMinutes: slotMinutes.optional(),
      fee: z.number().min(0, 'Fee cannot be negative').optional(),
    })
    .refine(endsAfterStart, {
      message: 'End time must be after start time',
      path: ['endTime'],
    }),
});

const declineScheduleValidationSchema = z.object({
  body: z.object({ reason }),
});

const cancelScheduleValidationSchema = z.object({
  body: z.object({ reason: reason.optional() }),
});

const blockSlotValidationSchema = z.object({
  body: z.object({ reason }),
});

export const DoctorScheduleValidations = {
  createScheduleValidationSchema,
  updateScheduleValidationSchema,
  declineScheduleValidationSchema,
  cancelScheduleValidationSchema,
  blockSlotValidationSchema,
};
