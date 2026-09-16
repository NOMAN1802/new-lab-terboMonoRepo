import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { PatientControllers } from './patient.controller';
import { PatientValidations } from './patient.validation';

const router = express.Router();

// Registering and looking up patients is core reception work — both roles.
router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  validateRequest(PatientValidations.createPatientValidationSchema),
  PatientControllers.createPatient
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  PatientControllers.getPatients
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  PatientControllers.getPatient
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  validateRequest(PatientValidations.updatePatientValidationSchema),
  PatientControllers.updatePatient
);

router.delete('/:id', auth(USER_ROLE.admin), PatientControllers.deletePatient);

export const patientRoutes = router;
