import { z } from 'zod';

const roleEnum = z.enum(['admin', 'receptionist'], {
  required_error: 'Role is required',
  invalid_type_error: 'Role must be either admin or receptionist',
});

// A doctor is a user with a clinical profile, so the doctor role is only
// available when creating one: changing an existing login into a doctor (or
// out of it) would leave a profile with no login, or the reverse.
const createRoleEnum = z.enum(['admin', 'receptionist', 'doctor'], {
  required_error: 'Role is required',
  invalid_type_error: 'Role must be admin, receptionist or doctor',
});

const createUserValidationSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: 'Name is required' }).min(1, 'Name is required'),
      role: createRoleEnum,
      email: z.string().email({ message: 'Invalid email' }),
      mobileNumber: z.string({ required_error: 'Mobile number is required' }),
      password: z
        .string({ required_error: 'Password is required' })
        .min(6, 'Password must be at least 6 characters'),
      status: z.enum(['active', 'inactive']).optional(),
      // The doctor profile. Only read when the role is doctor.
      specialty: z.string().trim().min(1, 'Specialty is required').optional(),
      degrees: z.string().trim().optional(),
      consultationFee: z
        .number({ invalid_type_error: 'Fee must be a number' })
        .min(0, 'Fee cannot be negative')
        .optional(),
    })
    .superRefine((value, ctx) => {
      if (value.role !== 'doctor') return;
      if (!value.specialty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specialty'],
          message: 'Specialty is required for a doctor',
        });
      }
      if (value.consultationFee === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['consultationFee'],
          message: 'Consultation fee is required for a doctor',
        });
      }
    }),
});

const updateUserValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    role: roleEnum.optional(),
    email: z.string().email().optional(),
    mobileNumber: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

const updateCurrentUserValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    mobileNumber: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  }),
});

export const UserValidation = {
  createUserValidationSchema,
  updateUserValidationSchema,
  updateCurrentUserValidationSchema,
};
