import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PatientServices } from './patient.service';

const createPatient = catchAsync(async (req, res) => {
  const result = await PatientServices.createPatient(req.body, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Patient registered successfully',
    data: result,
  });
});

const getPatients = catchAsync(async (req, res) => {
  const { meta, result } = await PatientServices.getPatients(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patients retrieved successfully',
    meta,
    data: result,
  });
});

const getPatient = catchAsync(async (req, res) => {
  const result = await PatientServices.getPatient(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient retrieved successfully',
    data: result,
  });
});

const updatePatient = catchAsync(async (req, res) => {
  const result = await PatientServices.updatePatient(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient updated successfully',
    data: result,
  });
});

const deletePatient = catchAsync(async (req, res) => {
  await PatientServices.deletePatient(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient deleted successfully',
    data: null,
  });
});

export const PatientControllers = {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
};
