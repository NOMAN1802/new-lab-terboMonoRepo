import { type Request } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AppointmentServices } from './appointment.service';

const actorOf = (req: Request) => ({
  _id: req.user._id as string,
  role: req.user.role as string,
});

const createAppointment = catchAsync(async (req, res) => {
  const result = await AppointmentServices.createAppointment(
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked',
    data: result,
  });
});

const getAvailability = catchAsync(async (req, res) => {
  const result = await AppointmentServices.getAvailability({
    date: req.query.date as string | undefined,
    doctor: req.query.doctor as string | undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Availability retrieved successfully',
    data: result,
  });
});

const getAppointments = catchAsync(async (req, res) => {
  const { meta, result } = await AppointmentServices.getAppointments(
    req.query,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments retrieved successfully',
    meta,
    data: result,
  });
});

const getAppointment = catchAsync(async (req, res) => {
  const result = await AppointmentServices.getAppointment(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment retrieved successfully',
    data: result,
  });
});

const checkIn = catchAsync(async (req, res) => {
  const result = await AppointmentServices.checkIn(req.params.id, actorOf(req));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient checked in',
    data: result,
  });
});

const cancel = catchAsync(async (req, res) => {
  const result = await AppointmentServices.cancel(
    req.params.id,
    req.body.reason,
    actorOf(req),
    req.body.refund
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment cancelled',
    data: result,
  });
});

const requestCancel = catchAsync(async (req, res) => {
  const result = await AppointmentServices.requestCancel(
    req.params.id,
    req.body.reason,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cancellation requested. An admin will review it.',
    data: result,
  });
});

const approveCancel = catchAsync(async (req, res) => {
  const result = await AppointmentServices.approveCancel(
    req.params.id,
    req.body.note,
    actorOf(req),
    req.body.refund
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cancellation approved',
    data: result,
  });
});

const rejectCancel = catchAsync(async (req, res) => {
  const result = await AppointmentServices.rejectCancel(
    req.params.id,
    req.body.note,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cancellation request refused',
    data: result,
  });
});

const acknowledgeOutcomes = catchAsync(async (req, res) => {
  const result = await AppointmentServices.acknowledgeOutcomes(
    req.body.ids,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Marked as read',
    data: result,
  });
});

const markInformed = catchAsync(async (req, res) => {
  const result = await AppointmentServices.markInformed(
    req.body.ids,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Marked as informed',
    data: result,
  });
});

const markNoShow = catchAsync(async (req, res) => {
  const result = await AppointmentServices.markNoShow(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Marked as no-show',
    data: result,
  });
});

const complete = catchAsync(async (req, res) => {
  const result = await AppointmentServices.complete(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Consultation completed',
    data: result,
  });
});

export const AppointmentControllers = {
  createAppointment,
  getAvailability,
  getAppointments,
  getAppointment,
  checkIn,
  cancel,
  requestCancel,
  approveCancel,
  rejectCancel,
  acknowledgeOutcomes,
  markInformed,
  markNoShow,
  complete,
};
