import { type Types } from 'mongoose';

/** A billable item in the centre's catalogue: a lab test or a consultation. */
export type TTest = {
  _id?: Types.ObjectId;
  /** Human-facing code, e.g. CBC, LFT, USG-ABD. */
  testCode: string;
  name: string;
  category?: Types.ObjectId;
  categoryName?: string;
  price: number;
  sampleType?: string;
  /** Working days until the report is normally ready. */
  reportDeliveryDays?: number;
  description?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
