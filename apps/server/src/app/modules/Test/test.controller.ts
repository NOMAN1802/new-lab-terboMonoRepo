import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { TestServices } from './test.service';

const createTest = catchAsync(async (req, res) => {
  const result = await TestServices.createTest(req.body, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Test created successfully',
    data: result,
  });
});

const getTests = catchAsync(async (req, res) => {
  const { meta, result } = await TestServices.getTests(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tests retrieved successfully',
    meta,
    data: result,
  });
});

const getTest = catchAsync(async (req, res) => {
  const result = await TestServices.getTest(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test retrieved successfully',
    data: result,
  });
});

const updateTest = catchAsync(async (req, res) => {
  const result = await TestServices.updateTest(req.params.id, req.body, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test updated successfully',
    data: result,
  });
});

const deleteTest = catchAsync(async (req, res) => {
  await TestServices.deleteTest(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test deleted successfully',
    data: null,
  });
});

export const TestControllers = {
  createTest,
  getTests,
  getTest,
  updateTest,
  deleteTest,
};
