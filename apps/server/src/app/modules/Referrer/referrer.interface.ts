import { type Types } from 'mongoose';
import { type TCommissionType } from '../Invoice/invoice.interface';

/**
 * A referring doctor or agent (RFE).
 *
 * Each carries two independent defaults that pre-fill at booking and are then
 * frozen onto the invoice, so later changes never rewrite past billing:
 *
 *   - the discount this doctor's patients get off their bill
 *   - what the centre pays the doctor, either a percentage of the net the
 *     patient pays or a flat taka figure
 */
export type TReferrer = {
  _id?: Types.ObjectId;
  referrerCode: string;
  name: string;
  designation?: string;
  hospital?: string;
  phone: string;
  address?: string;
  /** Percent off the patient's bill. 0-100. */
  defaultDiscountPercent: number;
  /** Whether commission is a percentage of net payable, or a flat amount. */
  defaultCommissionType: TCommissionType;
  /** A percentage when type is 'percent', a taka figure when 'fixed'. */
  defaultCommissionValue: number;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
