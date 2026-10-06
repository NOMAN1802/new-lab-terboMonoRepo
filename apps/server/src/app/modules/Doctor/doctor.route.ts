import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { DoctorControllers } from './doctor.controller';
import { DoctorValidations } from './doctor.validation';

const router = express.Router();

// Must stay above '/:id' or "me" is read as an id.
router.get('/me', auth(USER_ROLE.doctor), DoctorControllers.getMyDoctor);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  DoctorControllers.getDoctors
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  DoctorControllers.getDoctor
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin),
  validateRequest(DoctorValidations.updateDoctorValidationSchema),
  DoctorControllers.updateDoctor
);

router.delete('/:id', auth(USER_ROLE.admin), DoctorControllers.deleteDoctor);

export const doctorRoutes = router;
