import { z } from 'zod';

const objectId = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label.toLowerCase()}`);

const createAppointmentValidationSchema = z.object({
  body: z.object({
    schedule: objectId('Schedule'),
    slotIndex: z
      .number({ required_error: 'Slot is required' })
      .int('Slot must be a whole number')
      .min(0, 'Invalid slot'),
    patient: objectId('Patient'),
    notes: z.string().trim().max(500).optional(),
    // Money taken at the desk as part of the booking, as on a lab booking.
    collectFullPayment: z.boolean().optional(),
    advanceAmount: z
      .number({ invalid_type_error: 'Advance must be a number' })
      .min(0, 'Advance cannot be negative')
      .optional(),
  }),
});

const cancelAppointmentValidationSchema = z.object({
  body: z.object({
    reason: z
      .string({ required_error: 'A reason is required' })
      .trim()
      .min(3, 'A reason is required'),
    // Hand back what the patient has already paid as part of the cancellation.
    refund: z.boolean().optional(),
  }),
});

const approveCancelValidationSchema = z.object({
  body: z.object({
    note: z.string().trim().max(300).optional(),
    refund: z.boolean().optional(),
  }),
});

const rejectCancelValidationSchema = z.object({
  body: z.object({
    note: z
      .string({ required_error: 'Say why the request is refused' })
      .trim()
      .min(3, 'Say why the request is refused'),
  }),
});

const acknowledgeOutcomesValidationSchema = z.object({
  body: z.object({
    // Omit to acknowledge every answer waiting.
    ids: z.array(objectId('Appointment')).max(50).optional(),
  }),
});

export const AppointmentValidations = {
  createAppointmentValidationSchema,
  cancelAppointmentValidationSchema,
  approveCancelValidationSchema,
  rejectCancelValidationSchema,
  acknowledgeOutcomesValidationSchema,
};
