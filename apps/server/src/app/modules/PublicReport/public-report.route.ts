import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { publicReportAuth } from './public-report.auth';
import { PublicReportControllers } from './public-report.controller';
import { PublicReportValidations } from './public-report.validation';

/**
 * The only unauthenticated data routes in the system.
 *
 * They live in their own module rather than alongside the staff invoice routes
 * so that "public" is a property of a whole file somebody can review in one
 * sitting - and so nobody adds an unguarded route to invoice.route.ts by
 * copying the line above it.
 *
 * Reached by a patient scanning the QR printed on their invoice. Read
 * docs/qr-report-access.md before changing anything here.
 */
const router = express.Router();

// Pre-verification. Masked summary only - no amounts, no test names.
router.get('/reports/:token', PublicReportControllers.getSummary);

// The phone check. Rate-limited in app.ts and attempt-locked in the service.
router.post(
  '/reports/:token/verify',
  validateRequest(PublicReportValidations.verifyValidationSchema),
  PublicReportControllers.verify
);

// Report bytes, for a patient who has passed the check on this invoice.
router.get(
  '/reports/:token/items/:itemId/file',
  publicReportAuth,
  PublicReportControllers.getReportFile
);

export const publicReportRoutes = router;
