import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { AppointmentControllers } from './appointment.controller';
import { AppointmentValidations } from './appointment.validation';

const router = express.Router();

const desk = auth(USER_ROLE.admin, USER_ROLE.receptionist);
// The doctor works their own list: calls patients in, closes visits, asks to cancel.
const deskOrDoctor = auth(
  USER_ROLE.admin,
  USER_ROLE.receptionist,
  USER_ROLE.doctor
);

router.post(
  '/',
  desk,
  validateRequest(AppointmentValidations.createAppointmentValidationSchema),
  AppointmentControllers.createAppointment
);

// The desk marks the answers to its own cancellation requests as read.
router.post(
  '/cancel-request/ack',
  desk,
  validateRequest(AppointmentValidations.acknowledgeOutcomesValidationSchema),
  AppointmentControllers.acknowledgeOutcomes
);

// The desk ticks off patients it has phoned after a doctor-side cancellation.
router.post(
  '/callback/done',
  desk,
  validateRequest(AppointmentValidations.acknowledgeOutcomesValidationSchema),
  AppointmentControllers.markInformed
);

// Must stay above '/:id' or "availability" is read as an id.
router.get(
  '/availability',
  deskOrDoctor,
  AppointmentControllers.getAvailability
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist, USER_ROLE.doctor),
  AppointmentControllers.getAppointments
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist, USER_ROLE.doctor),
  AppointmentControllers.getAppointment
);

router.post('/:id/check-in', deskOrDoctor, AppointmentControllers.checkIn);

// Move a booked patient to another slot of the same doctor.
router.post(
  '/:id/reschedule',
  deskOrDoctor,
  validateRequest(AppointmentValidations.rescheduleAppointmentValidationSchema),
  AppointmentControllers.reschedule
);

// Cancelling outright is for admins. The desk asks, and an admin answers.
router.post(
  '/:id/cancel',
  auth(USER_ROLE.admin),
  validateRequest(AppointmentValidations.cancelAppointmentValidationSchema),
  AppointmentControllers.cancel
);

router.post(
  '/:id/cancel-request',
  deskOrDoctor,
  validateRequest(AppointmentValidations.cancelAppointmentValidationSchema),
  AppointmentControllers.requestCancel
);

router.post(
  '/:id/cancel-request/approve',
  auth(USER_ROLE.admin),
  validateRequest(AppointmentValidations.approveCancelValidationSchema),
  AppointmentControllers.approveCancel
);

router.post(
  '/:id/cancel-request/reject',
  auth(USER_ROLE.admin),
  validateRequest(AppointmentValidations.rejectCancelValidationSchema),
  AppointmentControllers.rejectCancel
);

router.post('/:id/no-show', deskOrDoctor, AppointmentControllers.markNoShow);

// The doctor closes the consultation; admin can too, to fix a missed click.
router.post(
  '/:id/complete',
  auth(USER_ROLE.admin, USER_ROLE.doctor),
  AppointmentControllers.complete
);

export const appointmentRoutes = router;
