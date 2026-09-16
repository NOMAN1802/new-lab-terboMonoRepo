import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthControllers } from './auth.controller';
import { AuthValidation } from './auth.validation';

const router = express.Router();

/**
 * There is deliberately no public registration endpoint.
 *
 * Accounts are created by an Admin at POST /users/create-user, and the first
 * Admin is seeded from the environment on boot (proposal §4.1: "Admin can
 * add/manage receptionist user accounts").
 */
router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthControllers.loginUser
);

router.post('/refresh-token', AuthControllers.refreshToken);

export const AuthRoutes = router;
