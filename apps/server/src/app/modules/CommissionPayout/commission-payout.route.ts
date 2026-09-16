import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { CommissionPayoutControllers } from './commission-payout.controller';
import { CommissionPayoutValidations } from './commission-payout.validation';

const router = express.Router();

// Commission is financial-overview data — Admin only, per proposal §4.8.
router.use(auth(USER_ROLE.admin));

router.post(
  '/',
  validateRequest(
    CommissionPayoutValidations.createCommissionPayoutValidationSchema
  ),
  CommissionPayoutControllers.createPayout
);

router.get('/', CommissionPayoutControllers.getPayouts);

router.get(
  '/pending/:referrerId',
  CommissionPayoutControllers.getPendingCommission
);

router.get('/:id', CommissionPayoutControllers.getPayout);

export const commissionPayoutRoutes = router;
