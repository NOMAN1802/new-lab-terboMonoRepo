import express from 'express';
import { activityLogRoutes } from '../modules/ActivityLog/activity-log.route';
import { publicReportRoutes } from '../modules/PublicReport/public-report.route';
import { AuthRoutes } from '../modules/Auth/auth.route';
import { commissionPayoutRoutes } from '../modules/CommissionPayout/commission-payout.route';
import { dashboardRoutes } from '../modules/Dashboard/dashboard.route';
import { invoiceRoutes } from '../modules/Invoice/invoice.route';
import { patientRoutes } from '../modules/Patient/patient.route';
import { paymentRoutes } from '../modules/Payment/payment.route';
import { referrerRoutes } from '../modules/Referrer/referrer.route';
import { reportsRoutes } from '../modules/Reports/reports.route';
import { testCategoryRoutes } from '../modules/TestCategory/test-category.route';
import { testRoutes } from '../modules/Test/test.route';
import { userRoutes } from '../modules/User/user.route';

const router = express.Router();

const moduleRoutes = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: userRoutes },
  { path: '/patients', route: patientRoutes },
  { path: '/test-categories', route: testCategoryRoutes },
  { path: '/tests', route: testRoutes },
  { path: '/referrers', route: referrerRoutes },
  { path: '/invoices', route: invoiceRoutes },
  { path: '/payments', route: paymentRoutes },
  { path: '/commission-payouts', route: commissionPayoutRoutes },
  { path: '/dashboard', route: dashboardRoutes },
  { path: '/reports', route: reportsRoutes },
  { path: '/activity', route: activityLogRoutes },
  // Unauthenticated. Reached by a patient scanning the QR on their invoice.
  { path: '/public', route: publicReportRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
