import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { ReferrerControllers } from './referrer.controller';
import { ReferrerValidations } from './referrer.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLE.admin),
  validateRequest(ReferrerValidations.createReferrerValidationSchema),
  ReferrerControllers.createReferrer
);

// Receptionists need the list to attach a referrer at booking time, but the
// controller strips the discount and commission terms from what they receive.
router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  ReferrerControllers.getReferrers
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  ReferrerControllers.getReferrer
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin),
  validateRequest(ReferrerValidations.updateReferrerValidationSchema),
  ReferrerControllers.updateReferrer
);

router.delete('/:id', auth(USER_ROLE.admin), ReferrerControllers.deleteReferrer);

export const referrerRoutes = router;
