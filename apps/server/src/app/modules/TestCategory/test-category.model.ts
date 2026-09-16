import { Schema, model } from 'mongoose';
import { type TTestCategory } from './test-category.interface';

const TestCategorySchema = new Schema<TTestCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const TestCategory = model<TTestCategory>(
  'TestCategory',
  TestCategorySchema
);
