import { type Types } from 'mongoose';

export type TGender = 'male' | 'female' | 'other';

export type TPatient = {
  _id?: Types.ObjectId;
  /** Human-facing identifier, e.g. PT-000001. Assigned by the server. */
  patientId: string;
  name: string;
  age: number;
  gender: TGender;
  phone: string;
  address?: string;
  createdBy?: Types.ObjectId;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
