import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { TestCategory } from '../TestCategory/test-category.model';
import { type TTest } from './test.interface';
import { Test } from './test.model';

const TestSearchableFields = ['name', 'testCode', 'sampleType', 'categoryName'];

/** Denormalises the category name so invoices and reports avoid a join. */
const resolveCategoryName = async (
  categoryId?: Types.ObjectId | string
): Promise<string | undefined> => {
  if (!categoryId) return undefined;

  const category = await TestCategory.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Test category not found');
  }

  return category.name;
};

const createTest = async (payload: TTest, userId: string): Promise<TTest> => {
  const categoryName = await resolveCategoryName(payload.category);

  return Test.create({
    ...payload,
    categoryName,
    createdBy: new Types.ObjectId(userId),
  });
};

const getTests = async (query: Record<string, unknown>) => {
  const baseQuery = Test.find({ isDeleted: false }).populate(
    'category',
    'name'
  );

  const testQuery = new QueryBuilder(baseQuery, query)
    .search(TestSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [tests, total] = await Promise.all([
    testQuery.modelQuery,
    testQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: tests,
  };
};

const getTest = async (id: string): Promise<TTest> => {
  const test = await Test.findOne({ _id: id, isDeleted: false }).populate(
    'category',
    'name'
  );
  if (!test) throw new AppError(httpStatus.NOT_FOUND, 'Test not found');
  return test;
};

const updateTest = async (
  id: string,
  payload: Partial<TTest>,
  userId: string
): Promise<TTest> => {
  const update: Partial<TTest> = { ...payload };

  if (payload.category) {
    update.categoryName = await resolveCategoryName(payload.category);
  }

  const before = await Test.findOne({ _id: id, isDeleted: false });
  if (!before) throw new AppError(httpStatus.NOT_FOUND, 'Test not found');

  const test = await Test.findOneAndUpdate(
    { _id: id, isDeleted: false },
    update,
    { new: true, runValidators: true }
  );

  if (!test) throw new AppError(httpStatus.NOT_FOUND, 'Test not found');

  // A price change alters what every future patient is billed, so it is
  // recorded with both the old and new figure.
  if (payload.price !== undefined && payload.price !== before.price) {
    await recordActivity({
      userId,
      action: 'test.price_changed',
      entity: 'Test',
      entityId: test._id,
      entityLabel: test.testCode,
      summary: `Changed ${test.name} price from ${before.price} to ${test.price}`,
      meta: { from: before.price, to: test.price },
    });
  }

  return test;
};

const deleteTest = async (id: string): Promise<void> => {
  // Soft delete only. Invoices snapshot the test name and price, so historic
  // billing stays intact and readable after a test leaves the catalogue.
  const test = await Test.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, isActive: false },
    { new: true }
  );

  if (!test) throw new AppError(httpStatus.NOT_FOUND, 'Test not found');
};

export const TestServices = {
  createTest,
  getTests,
  getTest,
  updateTest,
  deleteTest,
};
