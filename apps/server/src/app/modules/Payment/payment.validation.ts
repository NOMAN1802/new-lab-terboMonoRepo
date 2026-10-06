import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const createPaymentValidationSchema = z.object({
  body: z.object({
    invoice: objectId,
    amount: z
      .number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number',
      })
      .positive('Amount must be greater than zero'),
    paymentDate: z.string().datetime().optional(),
    note: z.string().trim().optional(),
  }),
});

const voidPaymentValidationSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'A reason is required to void a payment'),
  }),
});

const refundPaymentValidationSchema = z.object({
  body: z.object({
    invoice: objectId,
    amount: z
      .number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number',
      })
      .positive('Amount must be greater than zero'),
    reason: z
      .string({ required_error: 'A reason is required for a refund' })
      .trim()
      .min(3, 'A reason is required for a refund'),
    // Refund and cancel in one step: only honoured when the refund clears what was paid.
    cancelInvoice: z.boolean().optional(),
  }),
});

export const PaymentValidations = {
  createPaymentValidationSchema,
  voidPaymentValidationSchema,
  refundPaymentValidationSchema,
};
