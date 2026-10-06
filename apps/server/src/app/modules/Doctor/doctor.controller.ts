import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DoctorServices } from './doctor.service';

const getDoctors = catchAsync(async (req, res) => {
  const { meta, result } = await DoctorServices.getDoctors(
    req.query,
    req.user.role
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    meta,
    data: result,
  });
});

const getMyDoctor = catchAsync(async (req, res) => {
  const result = await DoctorServices.getMyDoctor(req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor profile retrieved successfully',
    data: result,
  });
});

const getDoctor = catchAsync(async (req, res) => {
  const result = await DoctorServices.getDoctor(
    req.params.id,
    req.user.role
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor retrieved successfully',
    data: result,
  });
});

const updateDoctor = catchAsync(async (req, res) => {
  const result = await DoctorServices.updateDoctor(
    req.params.id,
    req.body,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteDoctor = catchAsync(async (req, res) => {
  await DoctorServices.deleteDoctor(req.params.id, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor removed successfully',
    data: null,
  });
});

export const DoctorControllers = {
  getDoctors,
  getMyDoctor,
  getDoctor,
  updateDoctor,
  deleteDoctor,
};
