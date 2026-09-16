import httpStatus from 'http-status';
import { type TGroupBy, resolveDateRange } from '../../utils/dateRange';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ReportsServices } from './reports.service';

const ALLOWED_GROUPS: TGroupBy[] = ['daily', 'monthly', 'yearly'];

const resolveGroupBy = (value: unknown): TGroupBy => {
  const requested = String(value ?? 'daily') as TGroupBy;
  return ALLOWED_GROUPS.includes(requested) ? requested : 'daily';
};

const getPatientReport = catchAsync(async (req, res) => {
  const result = await ReportsServices.getPatientReport(
    resolveDateRange(req.query)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient report retrieved successfully',
    data: result,
  });
});

const getRevenueReport = catchAsync(async (req, res) => {
  const result = await ReportsServices.getRevenueReport(
    resolveDateRange(req.query),
    resolveGroupBy(req.query.groupBy)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue report retrieved successfully',
    data: result,
  });
});

const getFinancialSummary = catchAsync(async (req, res) => {
  const result = await ReportsServices.getFinancialSummary(
    resolveDateRange(req.query)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Financial summary retrieved successfully',
    data: result,
  });
});

const getReferralCommissionReport = catchAsync(async (req, res) => {
  const result = await ReportsServices.getReferralCommissionReport(
    resolveDateRange(req.query)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral & commission report retrieved successfully',
    data: result,
  });
});

const getDuesReport = catchAsync(async (req, res) => {
  const result = await ReportsServices.getDuesReport(
    resolveDateRange(req.query)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dues report retrieved successfully',
    data: result,
  });
});

const getCollectionByUserReport = catchAsync(async (req, res) => {
  const result = await ReportsServices.getCollectionByUserReport(
    resolveDateRange(req.query)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Collection report retrieved successfully',
    data: result,
  });
});

export const ReportsControllers = {
  getPatientReport,
  getRevenueReport,
  getFinancialSummary,
  getReferralCommissionReport,
  getDuesReport,
  getCollectionByUserReport,
};
