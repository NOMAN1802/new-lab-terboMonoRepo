import { z } from 'zod';

const genderEnum = z.enum(['male', 'female', 'other'], {
  required_error: 'Gender is required',
  invalid_type_error: 'Gender must be male, female or other',
});

const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .min(6, 'Phone number is too short')
  .max(20, 'Phone number is too long');

const createPatientValidationSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required'),
    age: z
      .number({ required_error: 'Age is required', invalid_type_error: 'Age must be a number' })
      .int('Age must be a whole number')
      .min(0, 'Age cannot be negative')
      .max(130, 'Age must be 130 or less'),
    gender: genderEnum,
    phone: phoneSchema,
    address: z.string().trim().optional(),
  }),
});

const updatePatientValidationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    age: z.number().int().min(0).max(130).optional(),
    gender: genderEnum.optional(),
    phone: phoneSchema.optional(),
    address: z.string().trim().optional(),
  }),
});

export const PatientValidations = {
  createPatientValidationSchema,
  updatePatientValidationSchema,
};
