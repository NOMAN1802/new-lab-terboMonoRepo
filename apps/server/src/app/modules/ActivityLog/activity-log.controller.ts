import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ActivityLogServices } from './activity-log.service';

const getActivities = catchAsync(async (req, res) => {
  const { meta, result } = await ActivityLogServices.getActivities(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activity retrieved successfully',
    meta,
    data: result,
  });
});

const getActivityByUser = catchAsync(async (req, res) => {
  const result = await ActivityLogServices.getActivityByUser(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activity by user retrieved successfully',
    data: result,
  });
});

export const ActivityLogControllers = { getActivities, getActivityByUser };
