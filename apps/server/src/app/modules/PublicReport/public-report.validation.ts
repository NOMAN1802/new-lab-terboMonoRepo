import { z } from 'zod';

/**
 * Exactly four digits. Anything else is rejected before it reaches the lockout
 * counter, so a malformed request cannot burn a patient's attempts.
 */
const verifyValidationSchema = z.object({
  body: z.object({
    last4: z
      .string({ required_error: 'Enter the last 4 digits of the phone number' })
      .trim()
      .regex(/^\d{4}$/, 'Enter exactly 4 digits'),
  }),
});

export const PublicReportValidations = {
  verifyValidationSchema,
};
