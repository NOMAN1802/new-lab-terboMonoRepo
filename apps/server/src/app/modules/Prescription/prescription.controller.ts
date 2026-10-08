import { type Request } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PrescriptionServices } from './prescription.service';

const actorOf = (req: Request) => ({
  _id: req.user._id as string,
  role: req.user.role as string,
});

const savePrescription = catchAsync(async (req, res) => {
  const result = await PrescriptionServices.savePrescription(
    req.params.appointmentId,
    req.body,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prescription saved',
    data: result,
  });
});

const getByAppointment = catchAsync(async (req, res) => {
  const result = await PrescriptionServices.getByAppointment(
    req.params.appointmentId,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prescription retrieved successfully',
    data: result,
  });
});

const getPrescription = catchAsync(async (req, res) => {
  const result = await PrescriptionServices.getPrescription(
    req.params.id,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prescription retrieved successfully',
    data: result,
  });
});

const getPrescriptions = catchAsync(async (req, res) => {
  const { meta, result } = await PrescriptionServices.getPrescriptions(
    req.query,
    actorOf(req)
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prescriptions retrieved successfully',
    meta,
    data: result,
  });
});

export const PrescriptionControllers = {
  savePrescription,
  getByAppointment,
  getPrescription,
  getPrescriptions,
};
