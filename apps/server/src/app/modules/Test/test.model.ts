import { Schema, model } from 'mongoose';
import { type TTest } from './test.interface';

const TestSchema = new Schema<TTest>(
  {
    testCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'TestCategory' },
    categoryName: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    sampleType: { type: String, trim: true },
    reportDeliveryDays: { type: Number, min: 0, default: 1 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TestSchema.index({ name: 1 });
TestSchema.index({ category: 1 });

export const Test = model<TTest>('Test', TestSchema);
