import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { type TGroupBy, resolveDateRange } from '../../utils/dateRange';
import { DashboardServices } from './dashboard.service';

const ALLOWED_GROUPS: TGroupBy[] = ['daily', 'monthly', 'yearly'];

const getDashboard = catchAsync(async (req, res) => {
  const { role, _id } = req.user;

  if (role === 'admin') {
    const range = resolveDateRange(req.query);
    const requested = String(req.query.groupBy ?? 'daily') as TGroupBy;
    const groupBy = ALLOWED_GROUPS.includes(requested) ? requested : 'daily';

    const result = await DashboardServices.getAdminDashboard(range, groupBy);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Admin dashboard retrieved successfully',
      data: result,
    });
  }

  if (role === 'doctor') {
    const doctorView = await DashboardServices.getDoctorDashboard({ _id, role });

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Doctor dashboard retrieved successfully',
      data: doctorView,
    });
  }

  const result = await DashboardServices.getReceptionistDashboard(_id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard retrieved successfully',
    data: result,
  });
});

export const DashboardControllers = { getDashboard };
