import { type Types } from 'mongoose';

/** Groups tests into departments: Pathology, Radiology, Consultation, etc. */
export type TTestCategory = {
  _id?: Types.ObjectId;
  name: string;
  description?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
