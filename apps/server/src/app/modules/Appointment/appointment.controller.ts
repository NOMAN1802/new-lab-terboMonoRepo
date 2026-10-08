import { type Request } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AppointmentServices } from './appointment.service';

const actorOf = (req: Request) => ({
  _id: req.user._id as string,
  role: req.user.role as string,
});

// What the doctor is owed from a fee is the centre's business, not the desk's
// or the doctor's: only an admin sees it.
const SHARE_FIELDS = ['commissionAmount', 'commissionStatus', 'referrer'];

const toPlain = (value: unknown): unknown =>
  value && typeof (value as { toObject?: () => unknown }).toObject === 'function'
    ? (value as { toObject: () => unknown }).toObject()
    : value;

const forRole = <T>(req: Request, data: T): T => {
  if (req.user.role === 'admin') return data;
  const strip = (item: unknown) => {
    const plain = toPlain(item) as Record<string, unknown> | null;
    const invoice = plain && (plain.invoice as Record<string, unknown> | undefined);
    if (invoice && typeof invoice === 'object') {
      for (const field of SHARE_FIELDS) delete invoice[field];
    }
    return plain;
  };
  return (Array.isArray(data) ? data.map(strip) : strip(data)) as T;
};

const createAppointment = catchAsync(async (req, res) => {
  const result = await AppointmentServices.createAppointment(
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked',
    data: forRole(req, result),
  });
});

const getAvailability = catchAsync(async (req, res) => {
  const result = await AppointmentServices.getAvailability(
    {
      date: req.query.date as string | undefined,
      doctor: req.query.doctor as string | undefined,
    },
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Availability retrieved successfully',
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
  });
});

const checkIn = catchAsync(async (req, res) => {
  const result = await AppointmentServices.checkIn(req.params.id, actorOf(req));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient checked in',
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
  });
});

const reschedule = catchAsync(async (req, res) => {
  const result = await AppointmentServices.reschedule(
    req.params.id,
    req.body,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment moved',
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
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
    data: forRole(req, result),
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
  reschedule,
  approveCancel,
  rejectCancel,
  acknowledgeOutcomes,
  markInformed,
  markNoShow,
  complete,
};
