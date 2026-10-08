import { z } from 'zod';

const fee = z
  .number({ invalid_type_error: 'Fee must be a number' })
  .min(0, 'Fee cannot be negative');

/** A percent share cannot pass 100; a flat one only has to be positive. */
const shareWithinBounds = (
  value: { appointmentShareType?: string; appointmentShareValue?: number },
  ctx: z.RefinementCtx
) => {
  if (
    value.appointmentShareType === 'percent' &&
    (value.appointmentShareValue ?? 0) > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentShareValue'],
      message: 'A percent share cannot exceed 100',
    });
  }
};

export const appointmentShareFields = {
  appointmentShareType: z.enum(['percent', 'fixed']).optional(),
  appointmentShareValue: z
    .number({ invalid_type_error: 'Share must be a number' })
    .min(0, 'Share cannot be negative')
    .optional(),
};

export { shareWithinBounds };

const updateDoctorValidationSchema = z.object({
  body: z.object({
    ...appointmentShareFields,
    name: z.string().trim().min(1).optional(),
    specialty: z.string().trim().min(1).optional(),
    degrees: z.string().trim().optional(),
    phone: z.string().trim().min(6).optional(),
    consultationFee: fee.optional(),
    isActive: z.boolean().optional(),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .optional(),
  }).superRefine(shareWithinBounds),
});

export const DoctorValidations = {
  updateDoctorValidationSchema,
};
