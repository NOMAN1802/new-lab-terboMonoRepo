import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const createCommissionPayoutValidationSchema = z.object({
  body: z.object({
    referrer: objectId,
    /**
     * Which accrued invoices this payout settles. Omit to settle everything
     * currently pending for the referrer within the given period.
     */
    invoiceIds: z.array(objectId).optional(),
    periodFrom: z.string().datetime().optional(),
    periodTo: z.string().datetime().optional(),
    paidOn: z.string().datetime().optional(),
    note: z.string().trim().optional(),
  }),
});

export const CommissionPayoutValidations = {
  createCommissionPayoutValidationSchema,
};
