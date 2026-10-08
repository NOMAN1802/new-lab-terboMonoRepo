import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).optional();

const medicine = z.object({
  name: z
    .string({ required_error: 'Medicine name is required' })
    .trim()
    .min(1, 'Medicine name is required')
    .max(120),
  dose: text(60),
  frequency: text(60),
  duration: text(60),
  instruction: text(120),
});

const savePrescriptionValidationSchema = z.object({
  body: z
    .object({
      complaints: text(1500),
      diagnosis: text(1500),
      medicines: z.array(medicine).max(30, 'Too many medicines').default([]),
      investigations: z
        .array(z.string().trim().min(1).max(120))
        .max(20, 'Too many tests')
        .default([]),
      advice: text(1500),
      // Blank or null clears the date.
      followUpDate: z
        .union([
          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
          z.literal(''),
          z.null(),
        ])
        .optional(),
    })
    .refine(
      (body) =>
        body.medicines.length > 0 ||
        body.investigations.length > 0 ||
        Boolean(body.diagnosis) ||
        Boolean(body.advice),
      { message: 'Write at least a diagnosis, a medicine, a test or some advice' }
    ),
});

export const PrescriptionValidations = {
  savePrescriptionValidationSchema,
};
