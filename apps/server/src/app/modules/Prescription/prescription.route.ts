import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { PrescriptionControllers } from './prescription.controller';
import { PrescriptionValidations } from './prescription.validation';

const router = express.Router();

const everyone = auth(USER_ROLE.admin, USER_ROLE.receptionist, USER_ROLE.doctor);

router.get('/', everyone, PrescriptionControllers.getPrescriptions);

// Only the visit's own doctor writes it. Everyone else reads and prints.
router.put(
  '/appointment/:appointmentId',
  auth(USER_ROLE.doctor),
  validateRequest(PrescriptionValidations.savePrescriptionValidationSchema),
  PrescriptionControllers.savePrescription
);

router.get(
  '/appointment/:appointmentId',
  everyone,
  PrescriptionControllers.getByAppointment
);

router.get('/:id', everyone, PrescriptionControllers.getPrescription);

export const prescriptionRoutes = router;
