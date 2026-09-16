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

export const PaymentValidations = {
  createPaymentValidationSchema,
  voidPaymentValidationSchema,
};
