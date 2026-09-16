import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { PaymentControllers } from './payment.controller';
import { PaymentValidations } from './payment.validation';

const router = express.Router();

// Taking cash is the receptionist's core job.
router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  validateRequest(PaymentValidations.createPaymentValidationSchema),
  PaymentControllers.createPayment
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  PaymentControllers.getPayments
);

router.get(
  '/invoice/:invoiceId',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  PaymentControllers.getInvoicePayments
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  PaymentControllers.getPayment
);

// Reversing a recorded payment is an Admin-only correction.
router.patch(
  '/:id/void',
  auth(USER_ROLE.admin),
  validateRequest(PaymentValidations.voidPaymentValidationSchema),
  PaymentControllers.voidPayment
);

export const paymentRoutes = router;
