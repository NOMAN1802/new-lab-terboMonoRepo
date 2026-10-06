import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { DoctorScheduleControllers } from './doctor-schedule.controller';
import { DoctorScheduleValidations } from './doctor-schedule.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLE.admin),
  validateRequest(DoctorScheduleValidations.createScheduleValidationSchema),
  DoctorScheduleControllers.createSchedule
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  DoctorScheduleControllers.getSchedules
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  DoctorScheduleControllers.getSchedule
);

// The party who agreed to a schedule changes it: the admin while it is only a
// proposal, the doctor once it is approved. The service enforces which.
router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  validateRequest(DoctorScheduleValidations.updateScheduleValidationSchema),
  DoctorScheduleControllers.updateSchedule
);

// Only the doctor the schedule belongs to can answer it; the service enforces
// the ownership, the role check here keeps everyone else out.
router.post(
  '/:id/approve',
  auth(USER_ROLE.doctor),
  DoctorScheduleControllers.approveSchedule
);

router.post(
  '/:id/decline',
  auth(USER_ROLE.doctor),
  validateRequest(DoctorScheduleValidations.declineScheduleValidationSchema),
  DoctorScheduleControllers.declineSchedule
);

router.post(
  '/:id/cancel',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  validateRequest(DoctorScheduleValidations.cancelScheduleValidationSchema),
  DoctorScheduleControllers.cancelSchedule
);

router.get(
  '/:id/slots',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  DoctorScheduleControllers.getScheduleSlots
);

router.post(
  '/:id/slots/:slotIndex/block',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  validateRequest(DoctorScheduleValidations.blockSlotValidationSchema),
  DoctorScheduleControllers.blockSlot
);

router.delete(
  '/:id/slots/:slotIndex/block',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  DoctorScheduleControllers.unblockSlot
);

export const doctorScheduleRoutes = router;
