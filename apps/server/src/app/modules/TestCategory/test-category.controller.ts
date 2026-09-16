import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { TestCategoryServices } from './test-category.service';

const createTestCategory = catchAsync(async (req, res) => {
  const result = await TestCategoryServices.createTestCategory(
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Test category created successfully',
    data: result,
  });
});

const getTestCategories = catchAsync(async (req, res) => {
  const { meta, result } = await TestCategoryServices.getTestCategories(
    req.query
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test categories retrieved successfully',
    meta,
    data: result,
  });
});

const getTestCategory = catchAsync(async (req, res) => {
  const result = await TestCategoryServices.getTestCategory(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test category retrieved successfully',
    data: result,
  });
});

const updateTestCategory = catchAsync(async (req, res) => {
  const result = await TestCategoryServices.updateTestCategory(
    req.params.id,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test category updated successfully',
    data: result,
  });
});

const deleteTestCategory = catchAsync(async (req, res) => {
  await TestCategoryServices.deleteTestCategory(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test category deleted successfully',
    data: null,
  });
});

export const TestCategoryControllers = {
  createTestCategory,
  getTestCategories,
  getTestCategory,
  updateTestCategory,
  deleteTestCategory,
};
