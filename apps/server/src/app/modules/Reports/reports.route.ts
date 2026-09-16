import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { ReportsControllers } from './reports.controller';

const router = express.Router();

// Patient data only — the one report a receptionist may run (proposal §4.9).
router.get(
  '/patients',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  ReportsControllers.getPatientReport
);

// Everything below is financial-overview data: Admin only.
router.get('/revenue', auth(USER_ROLE.admin), ReportsControllers.getRevenueReport);

router.get(
  '/financial-summary',
  auth(USER_ROLE.admin),
  ReportsControllers.getFinancialSummary
);

router.get(
  '/referral-commission',
  auth(USER_ROLE.admin),
  ReportsControllers.getReferralCommissionReport
);

router.get('/dues', auth(USER_ROLE.admin), ReportsControllers.getDuesReport);

router.get(
  '/collection-by-user',
  auth(USER_ROLE.admin),
  ReportsControllers.getCollectionByUserReport
);

export const reportsRoutes = router;
