import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { type TReferrer } from './referrer.interface';
import { Referrer } from './referrer.model';

const ReferrerSearchableFields = [
  'name',
  'referrerCode',
  'phone',
  'hospital',
  'designation',
];

const createReferrer = async (
  payload: TReferrer,
  userId: string
): Promise<TReferrer> => {
  // Doctor entries are made with the doctor, never by hand.
  const { doctor: _ignored, ...fields } = payload;
  void _ignored;
  return Referrer.create({ ...fields, createdBy: new Types.ObjectId(userId) });
};

const getReferrers = async (query: Record<string, unknown>) => {
  const baseQuery = Referrer.find({ isDeleted: false });

  const referrerQuery = new QueryBuilder(baseQuery, query)
    .search(ReferrerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [referrers, total] = await Promise.all([
    referrerQuery.modelQuery,
    referrerQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: referrers,
  };
};

const getReferrer = async (id: string): Promise<TReferrer> => {
  const referrer = await Referrer.findOne({ _id: id, isDeleted: false });
  if (!referrer) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
  return referrer;
};

// A doctor's entry follows the doctor: who they are and whether they are
// active is changed from Users, not here. The commercial terms stay editable.
const DOCTOR_OWNED_FIELDS = ['name', 'phone', 'designation', 'isActive', 'doctor'] as const;

const updateReferrer = async (
  id: string,
  payload: Partial<TReferrer>
): Promise<TReferrer> => {
  const existing = await Referrer.findOne({ _id: id, isDeleted: false }).select('doctor');
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');

  const update: Partial<TReferrer> = { ...payload };
  delete update.doctor;
  if (existing.doctor) {
    for (const field of DOCTOR_OWNED_FIELDS) delete update[field];
  }

  const referrer = await Referrer.findOneAndUpdate(
    { _id: id, isDeleted: false },
    update,
    { new: true, runValidators: true }
  );

  if (!referrer) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
  return referrer;
};

const deleteReferrer = async (id: string): Promise<void> => {
  const linked = await Referrer.findOne({ _id: id, isDeleted: false }).select('doctor');
  if (linked?.doctor) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This referrer is one of your doctors. Remove the doctor from Users instead.'
    );
  }

  // Soft delete — invoices snapshot the referrer, and outstanding commission
  // must remain attributable after the referrer stops working with the centre.
  const referrer = await Referrer.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, isActive: false },
    { new: true }
  );

  if (!referrer) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
};

export const ReferrerServices = {
  createReferrer,
  getReferrers,
  getReferrer,
  updateReferrer,
  deleteReferrer,
};
