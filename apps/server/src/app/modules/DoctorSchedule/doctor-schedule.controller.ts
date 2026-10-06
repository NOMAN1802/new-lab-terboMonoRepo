import { type Request } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DoctorScheduleServices } from './doctor-schedule.service';

const actorOf = (req: Request) => ({
  _id: req.user._id as string,
  role: req.user.role as string,
});

const createSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.createSchedule(
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Schedule created and sent to the doctor for approval',
    data: result,
  });
});

const getSchedules = catchAsync(async (req, res) => {
  const { meta, result } = await DoctorScheduleServices.getSchedules(
    req.query,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedules retrieved successfully',
    meta,
    data: result,
  });
});

const getSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.getSchedule(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule retrieved successfully',
    data: result,
  });
});

const updateSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.updateSchedule(
    req.params.id,
    req.body,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule updated successfully',
    data: result,
  });
});

const approveSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.approveSchedule(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule approved',
    data: result,
  });
});

const declineSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.declineSchedule(
    req.params.id,
    req.body.reason,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule declined',
    data: result,
  });
});

const cancelSchedule = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.cancelSchedule(
    req.params.id,
    req.body.reason,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule cancelled',
    data: result,
  });
});

const getScheduleSlots = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.getScheduleSlots(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slots retrieved successfully',
    data: result,
  });
});

const blockSlot = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.blockSlot(
    req.params.id,
    Number(req.params.slotIndex),
    req.body.reason,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slot blocked',
    data: result,
  });
});

const unblockSlot = catchAsync(async (req, res) => {
  const result = await DoctorScheduleServices.unblockSlot(
    req.params.id,
    Number(req.params.slotIndex),
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slot reopened',
    data: result,
  });
});

export const DoctorScheduleControllers = {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  approveSchedule,
  declineSchedule,
  cancelSchedule,
  getScheduleSlots,
  blockSlot,
  unblockSlot,
};
