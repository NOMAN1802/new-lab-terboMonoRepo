import { z } from 'zod';

const createTestCategoryValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Category name is required' })
      .trim()
      .min(1, 'Category name is required'),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateTestCategoryValidationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const TestCategoryValidations = {
  createTestCategoryValidationSchema,
  updateTestCategoryValidationSchema,
};
