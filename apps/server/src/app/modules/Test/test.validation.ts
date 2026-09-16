import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category id');

const createTestValidationSchema = z.object({
  body: z.object({
    testCode: z
      .string({ required_error: 'Test code is required' })
      .trim()
      .min(1, 'Test code is required'),
    name: z
      .string({ required_error: 'Test name is required' })
      .trim()
      .min(1, 'Test name is required'),
    category: objectId.optional(),
    price: z
      .number({ required_error: 'Price is required', invalid_type_error: 'Price must be a number' })
      .min(0, 'Price cannot be negative'),
    sampleType: z.string().trim().optional(),
    reportDeliveryDays: z.number().int().min(0).optional(),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateTestValidationSchema = z.object({
  body: z.object({
    testCode: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    category: objectId.optional(),
    price: z.number().min(0, 'Price cannot be negative').optional(),
    sampleType: z.string().trim().optional(),
    reportDeliveryDays: z.number().int().min(0).optional(),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const TestValidations = {
  createTestValidationSchema,
  updateTestValidationSchema,
};
