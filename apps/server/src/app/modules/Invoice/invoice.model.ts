import { Schema, model } from 'mongoose';
import { type TInvoice, type TInvoiceItem, type TReportFile } from './invoice.interface';

const ReportFileSchema = new Schema<TReportFile>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true, default: 'image' },
    format: { type: String },
    version: { type: String },
    mimeType: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, required: true, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const InvoiceItemSchema = new Schema<TInvoiceItem>({
  test: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
  testCode: { type: String, required: true },
  testName: { type: String, required: true },
  categoryName: { type: String },
  price: { type: Number, required: true, min: 0 },
  reportStatus: {
    type: String,
    enum: ['pending', 'uploaded', 'delivered'],
    default: 'pending',
  },
  reportFile: { type: ReportFileSchema, required: false },
  deliveredAt: { type: Date },

  isCancelled: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true },
});

const InvoiceSchema = new Schema<TInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    visitDate: { type: Date, required: true, default: Date.now },

    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientInfo: {
      patientId: { type: String, required: true },
      name: { type: String, required: true },
      age: { type: Number, required: true },
      gender: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String },
    },

    referrer: { type: Schema.Types.ObjectId, ref: 'Referrer' },
    referrerInfo: {
      type: {
        referrerCode: { type: String, required: true },
        name: { type: String, required: true },
        designation: { type: String },
        hospital: { type: String },
      },
      required: false,
      _id: false,
    },

    items: {
      type: [InvoiceItemSchema],
      required: true,
      validate: [
        (items: TInvoiceItem[]) => items.length > 0,
        'An invoice must contain at least one test',
      ],
    },

    grossAmount: { type: Number, required: true, min: 0 },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    netPayable: { type: Number, required: true, min: 0 },

    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    dueAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },

    commissionType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
      default: 'percent',
    },
    // A percentage when type is 'percent', a taka figure when 'fixed', so it
    // deliberately carries no max.
    commissionValue: { type: Number, required: true, min: 0, default: 0 },
    commissionAmount: { type: Number, required: true, min: 0, default: 0 },
    commissionStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    commissionPayout: { type: Schema.Types.ObjectId, ref: 'CommissionPayout' },

    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true },

    // Scanned off the printed invoice. Sparse, because invoices created before
    // this feature have none until they are next read.
    publicToken: { type: String, unique: true, sparse: true },
    publicAccess: {
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date },
    },
  },
  { timestamps: true }
);

InvoiceSchema.index({ patient: 1, visitDate: -1 });
InvoiceSchema.index({ referrer: 1, commissionStatus: 1 });
InvoiceSchema.index({ visitDate: -1 });
InvoiceSchema.index({ paymentStatus: 1 });
InvoiceSchema.index({ createdBy: 1 });

export const Invoice = model<TInvoice>('Invoice', InvoiceSchema);
