import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const percent = z
  .number({ invalid_type_error: 'Must be a number' })
  .min(0, 'Cannot be negative')
  .max(100, 'Cannot exceed 100%');

const commissionType = z.enum(['percent', 'fixed'], {
  invalid_type_error: "Commission must be 'percent' or 'fixed'",
});

/**
 * commissionValue is a percentage when the type is 'percent' and a taka figure
 * when it is 'fixed', so it is only bounded below. The refinement stops a
 * percentage above 100 slipping through.
 */
const commissionValue = z
  .number({ invalid_type_error: 'Must be a number' })
  .min(0, 'Cannot be negative');

const withCommissionCheck = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, ctx) => {
    const body = (value as { body?: Record<string, unknown> }).body ?? {};
    if (
      body.commissionType === 'percent' &&
      typeof body.commissionValue === 'number' &&
      body.commissionValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'commissionValue'],
        message: 'A percentage commission cannot exceed 100%',
      });
    }
  });

/**
 * Note what is absent: grossAmount, discountAmount, netPayable, commissionAmount,
 * paidAmount, dueAmount and paymentStatus are all server-derived. Zod strips
 * unknown keys, so a client sending them has no effect.
 *
 * commissionType and commissionValue are absent too, and deliberately. Booking
 * records *who* referred the patient, never what the centre owes them: the
 * accrual comes from the referrer's standing terms, and only an Admin changes
 * those or settles them from the Doctor's Commission screen.
 */
const createInvoiceValidationSchema = z.object({
  body: z.object({
    patient: objectId,
    referrer: objectId.optional(),
    testIds: z
      .array(objectId, { required_error: 'Select at least one test' })
      .min(1, 'Select at least one test'),
    visitDate: z.string().datetime().optional(),
    discountPercent: percent.optional(),
    notes: z.string().trim().optional(),
    collectFullPayment: z.boolean().optional(),
    /**
     * A part-payment taken at the counter. The service clamps it to the net it
     * computes, so an over-figure can never receipt more than is owed.
     */
    advanceAmount: z
      .number({ invalid_type_error: 'Must be a number' })
      .min(0, 'Cannot be negative')
      .optional(),
  }),
});

const updateInvoiceItemsValidationSchema = withCommissionCheck(
  z.object({
    body: z.object({
      testIds: z.array(objectId).min(1, 'Select at least one test'),
      discountPercent: percent.optional(),
      commissionType: commissionType.optional(),
      commissionValue: commissionValue.optional(),
    }),
  })
);

const cancelInvoiceValidationSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'A cancellation reason is required'),
  }),
});

const cancelInvoiceItemValidationSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(1, 'Say why this test is being cancelled'),
  }),
});

export const InvoiceValidations = {
  createInvoiceValidationSchema,
  updateInvoiceItemsValidationSchema,
  cancelInvoiceValidationSchema,
  cancelInvoiceItemValidationSchema,
};
