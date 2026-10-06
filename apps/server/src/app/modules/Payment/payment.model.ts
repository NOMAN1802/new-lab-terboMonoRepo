import { Schema, model } from 'mongoose';
import { type TPayment } from './payment.interface';

const PaymentSchema = new Schema<TPayment>(
  {
    receiptNumber: { type: String, required: true, unique: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    invoiceNumber: { type: String, required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },

    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value !== 0,
        message: 'Amount cannot be zero',
      },
    },
    kind: { type: String, enum: ['payment', 'refund'], default: 'payment' },
    method: { type: String, enum: ['cash'], default: 'cash' },
    paymentDate: { type: Date, required: true, default: Date.now },

    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receivedByName: { type: String, required: true },
    note: { type: String, trim: true },

    isVoided: { type: Boolean, default: false },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoice: 1, isVoided: 1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ receivedBy: 1, paymentDate: -1 });

export const Payment = model<TPayment>('Payment', PaymentSchema);
