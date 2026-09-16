import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CommissionPayoutServices } from './commission-payout.service';

const createPayout = catchAsync(async (req, res) => {
  const result = await CommissionPayoutServices.createPayout(
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Commission payout recorded successfully',
    data: result,
  });
});

const getPayouts = catchAsync(async (req, res) => {
  const { meta, result } = await CommissionPayoutServices.getPayouts(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Commission payouts retrieved successfully',
    meta,
    data: result,
  });
});

const getPayout = catchAsync(async (req, res) => {
  const result = await CommissionPayoutServices.getPayout(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Commission payout retrieved successfully',
    data: result,
  });
});

const getPendingCommission = catchAsync(async (req, res) => {
  const result = await CommissionPayoutServices.getPendingCommission(
    req.params.referrerId
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pending commission retrieved successfully',
    data: result,
  });
});

export const CommissionPayoutControllers = {
  createPayout,
  getPayouts,
  getPayout,
  getPendingCommission,
};
