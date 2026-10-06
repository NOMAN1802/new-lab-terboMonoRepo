import { z } from 'zod';

const fee = z
  .number({ invalid_type_error: 'Fee must be a number' })
  .min(0, 'Fee cannot be negative');

const updateDoctorValidationSchema = z.object({
  body: z.object({
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
  }),
});

export const DoctorValidations = {
  updateDoctorValidationSchema,
};
