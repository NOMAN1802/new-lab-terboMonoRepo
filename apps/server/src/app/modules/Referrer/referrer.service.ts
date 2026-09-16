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
): Promise<TReferrer> =>
  Referrer.create({ ...payload, createdBy: new Types.ObjectId(userId) });

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

const updateReferrer = async (
  id: string,
  payload: Partial<TReferrer>
): Promise<TReferrer> => {
  const referrer = await Referrer.findOneAndUpdate(
    { _id: id, isDeleted: false },
    payload,
    { new: true, runValidators: true }
  );

  if (!referrer) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
  return referrer;
};

const deleteReferrer = async (id: string): Promise<void> => {
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
