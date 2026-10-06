import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { DashboardControllers } from './dashboard.controller';

const router = express.Router();

// One endpoint, three payloads. The controller picks by role so a receptionist
// can never receive the financial overview, nor a doctor anyone else's work.
router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist, USER_ROLE.doctor),
  DashboardControllers.getDashboard
);

export const dashboardRoutes = router;
