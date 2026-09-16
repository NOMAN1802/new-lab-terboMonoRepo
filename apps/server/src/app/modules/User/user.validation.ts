import { z } from 'zod';

const roleEnum = z.enum(['admin', 'receptionist'], {
  required_error: 'Role is required',
  invalid_type_error: 'Role must be either admin or receptionist',
});

const createUserValidationSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(1, 'Name is required'),
    role: roleEnum,
    email: z.string().email({ message: 'Invalid email' }),
    mobileNumber: z.string({ required_error: 'Mobile number is required' }),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters'),
    status: z.enum(['active', 'inactive']).optional(),
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
