import express from 'express';
import { reportUpload } from '../../config/multer.config';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../User/user.constant';
import { InvoiceControllers } from './invoice.controller';
import { InvoiceValidations } from './invoice.validation';

const router = express.Router();

// Booking is reception work; per-invoice figures come back in full so the
// receptionist can print a correct patient invoice.
router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  validateRequest(InvoiceValidations.createInvoiceValidationSchema),
  InvoiceControllers.createInvoice
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.getInvoices
);

router.get(
  '/patient/:patientId',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.getPatientInvoices
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.getInvoice
);

// Changing billed tests or overriding rates is an Admin decision.
router.patch(
  '/:id/items',
  auth(USER_ROLE.admin),
  validateRequest(InvoiceValidations.updateInvoiceItemsValidationSchema),
  InvoiceControllers.updateInvoiceItems
);

router.patch(
  '/:id/cancel',
  auth(USER_ROLE.admin),
  validateRequest(InvoiceValidations.cancelInvoiceValidationSchema),
  InvoiceControllers.cancelInvoice
);

// Calling off a single test is counter work, so both roles may do it. The
// whole-invoice cancellation above stays Admin-only.
router.patch(
  '/:id/items/:itemId/cancel',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  validateRequest(InvoiceValidations.cancelInvoiceItemValidationSchema),
  InvoiceControllers.cancelInvoiceItem
);

// Report handling - both roles per proposal §4.7.
router.post(
  '/:id/items/:itemId/report',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  reportUpload.single('report'),
  InvoiceControllers.uploadItemReport
);

router.patch(
  '/:id/items/:itemId/deliver',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.markReportDelivered
);

router.get(
  '/:id/items/:itemId/report',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.getReportDownloadUrl
);

// The bytes themselves, typed and named from what we stored at upload.
router.get(
  '/:id/items/:itemId/report/file',
  auth(USER_ROLE.admin, USER_ROLE.receptionist),
  InvoiceControllers.getReportFile
);

export const invoiceRoutes = router;
