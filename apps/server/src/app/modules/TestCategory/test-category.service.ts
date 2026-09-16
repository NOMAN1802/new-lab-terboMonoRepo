import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { Test } from '../Test/test.model';
import { type TTestCategory } from './test-category.interface';
import { TestCategory } from './test-category.model';

const createTestCategory = async (
  payload: TTestCategory,
  userId: string
): Promise<TTestCategory> =>
  TestCategory.create({ ...payload, createdBy: new Types.ObjectId(userId) });

const getTestCategories = async (query: Record<string, unknown>) => {
  const baseQuery = TestCategory.find({ isDeleted: false });

  const categoryQuery = new QueryBuilder(baseQuery, query)
    .search(['name', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [categories, total] = await Promise.all([
    categoryQuery.modelQuery,
    categoryQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: categories,
  };
};

const getTestCategory = async (id: string): Promise<TTestCategory> => {
  const category = await TestCategory.findOne({ _id: id, isDeleted: false });
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test category not found');
  }
  return category;
};

const updateTestCategory = async (
  id: string,
  payload: Partial<TTestCategory>
): Promise<TTestCategory> => {
  const category = await TestCategory.findOneAndUpdate(
    { _id: id, isDeleted: false },
    payload,
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test category not found');
  }
  return category;
};

const deleteTestCategory = async (id: string): Promise<void> => {
  // Tests carry a category reference used on invoices; orphaning them would
  // break the department breakdown on financial reports.
  const testsInUse = await Test.countDocuments({
    category: id,
    isDeleted: false,
  });

  if (testsInUse > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete this category — ${testsInUse} test(s) still belong to it`
    );
  }

  const category = await TestCategory.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Test category not found');
  }
};

export const TestCategoryServices = {
  createTestCategory,
  getTestCategories,
  getTestCategory,
  updateTestCategory,
  deleteTestCategory,
};
