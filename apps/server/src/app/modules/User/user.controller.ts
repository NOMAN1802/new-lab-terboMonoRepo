import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';

const createUser = catchAsync(async (req, res) => {
  const user = await UserServices.createUser(req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User created successfully',
    data: user,
  });
});

const updateUser = catchAsync(async (req, res) => {
  const result = await UserServices.updateUser(req.params.id, req.body);

  if (!result) {
    throw new AppError(404, 'User not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User updated successfully',
    data: result,
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const result = await UserServices.deleteUser(req.params.id);

  if (!result) {
    throw new AppError(404, 'User not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User deleted successfully',
    data: result,
  });
});

const getUser = catchAsync(async (req, res) => {
  const result = await UserServices.getUser(req.params.id);

  if (!result) {
    throw new AppError(404, 'User not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User retrieved successfully',
    data: result,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const query = { ...req.query };
  const result = await UserServices.getUsers(query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Users retrieved successfully',
    data: result,
  });
});

const getCurrentUser = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await UserServices.getUser(userId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User profile retrieved successfully',
    data: result,
  });
});

const updateCurrentUser = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await UserServices.updateUser(userId, req.body);

  if (!result) {
    throw new AppError(404, 'User not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Profile updated successfully',
    data: result,
  });
});

export const UserControllers = {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  getCurrentUser,
  updateCurrentUser,
};
