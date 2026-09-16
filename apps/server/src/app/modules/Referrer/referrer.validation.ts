import { z } from 'zod';

const percent = z
  .number({ invalid_type_error: 'Must be a number' })
  .min(0, 'Cannot be negative')
  .max(100, 'Cannot exceed 100%');

const createReferrerValidationSchema = z.object({
  body: z.object({
    referrerCode: z
      .string({ required_error: 'Referrer code is required' })
      .trim()
      .min(1, 'Referrer code is required'),
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(1, 'Name is required'),
    designation: z.string().trim().optional(),
    hospital: z.string().trim().optional(),
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(6, 'Phone number is too short'),
    address: z.string().trim().optional(),
    defaultDiscountPercent: percent.optional(),
    defaultCommissionType: z.enum(['percent', 'fixed']).optional(),
    // Percentage or flat taka depending on the type, so only bounded below.
    defaultCommissionValue: z.number().min(0, 'Cannot be negative').optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateReferrerValidationSchema = z.object({
  body: z.object({
    referrerCode: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    designation: z.string().trim().optional(),
    hospital: z.string().trim().optional(),
    phone: z.string().trim().min(6).optional(),
    address: z.string().trim().optional(),
    defaultDiscountPercent: percent.optional(),
    defaultCommissionType: z.enum(['percent', 'fixed']).optional(),
    // Percentage or flat taka depending on the type, so only bounded below.
    defaultCommissionValue: z.number().min(0, 'Cannot be negative').optional(),
    isActive: z.boolean().optional(),
  }),
});

export const ReferrerValidations = {
  createReferrerValidationSchema,
  updateReferrerValidationSchema,
};
