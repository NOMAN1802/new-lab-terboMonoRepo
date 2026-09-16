import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { type TUserRole } from '../User/user.interface';
import { serializeReferrer, serializeReferrers } from './referrer.serializer';
import { ReferrerServices } from './referrer.service';

const createReferrer = catchAsync(async (req, res) => {
  const result = await ReferrerServices.createReferrer(req.body, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Referrer created successfully',
    data: result,
  });
});

const getReferrers = catchAsync(async (req, res) => {
  const { meta, result } = await ReferrerServices.getReferrers(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referrers retrieved successfully',
    meta,
    data: serializeReferrers(result, req.user.role as TUserRole),
  });
});

const getReferrer = catchAsync(async (req, res) => {
  const result = await ReferrerServices.getReferrer(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referrer retrieved successfully',
    data: serializeReferrer(result, req.user.role as TUserRole),
  });
});

const updateReferrer = catchAsync(async (req, res) => {
  const result = await ReferrerServices.updateReferrer(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referrer updated successfully',
    data: result,
  });
});

const deleteReferrer = catchAsync(async (req, res) => {
  await ReferrerServices.deleteReferrer(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referrer deleted successfully',
    data: null,
  });
});

export const ReferrerControllers = {
  createReferrer,
  getReferrers,
  getReferrer,
  updateReferrer,
  deleteReferrer,
};
