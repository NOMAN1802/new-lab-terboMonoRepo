import { type Types } from 'mongoose';
import { type TGender } from '../Patient/patient.interface';

export type TMedicine = {
  name: string;
  /** e.g. "500 mg" */
  dose?: string;
  /** e.g. "1+0+1" or "twice a day" */
  frequency?: string;
  /** e.g. "7 days" */
  duration?: string;
  /** e.g. "after meals" */
  instruction?: string;
};

/**
 * What the doctor writes for a patient at one visit. One per appointment, and
 * a copy of the patient and doctor as they were, so it prints the same later.
 */
export type TPrescription = {
  _id?: Types.ObjectId;
  /** RX-YYMMDD-001, numbered per visit day. */
  prescriptionNumber: string;
  appointment: Types.ObjectId;
  doctor: Types.ObjectId;
  patient: Types.ObjectId;
  patientInfo: {
    patientId: string;
    name: string;
    age: number;
    gender: TGender;
    phone: string;
  };
  doctorInfo: {
    doctorCode: string;
    name: string;
    specialty: string;
    degrees?: string;
  };
  /** Midnight at the start of the Dhaka visit day. */
  visitDate: Date;
  complaints?: string;
  diagnosis?: string;
  medicines: TMedicine[];
  /** Tests the doctor wants done, written as free text. */
  investigations: string[];
  advice?: string;
  followUpDate?: Date;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
