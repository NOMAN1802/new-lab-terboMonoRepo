import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { type TUserRole } from '../User/user.interface';
import { serializeInvoice, serializeInvoices } from './invoice.serializer';
import { InvoiceServices } from './invoice.service';

const createInvoice = catchAsync(async (req, res) => {
  const result = await InvoiceServices.createInvoice(req.body, req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Invoice created successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const getInvoices = catchAsync(async (req, res) => {
  const { meta, result } = await InvoiceServices.getInvoices(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoices retrieved successfully',
    meta,
    data: serializeInvoices(result, req.user.role as TUserRole),
  });
});

const getInvoice = catchAsync(async (req, res) => {
  const result = await InvoiceServices.getInvoice(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice retrieved successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const getPatientInvoices = catchAsync(async (req, res) => {
  const { patient, invoices } = await InvoiceServices.getPatientInvoices(
    req.params.patientId
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient visit history retrieved successfully',
    data: {
      patient,
      invoices: serializeInvoices(invoices, req.user.role as TUserRole),
    },
  });
});

const updateInvoiceItems = catchAsync(async (req, res) => {
  const { testIds, discountPercent, commissionType, commissionValue } = req.body;
  const result = await InvoiceServices.updateInvoiceItems(
    req.params.id,
    testIds,
    discountPercent,
    commissionType,
    commissionValue
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice updated successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const cancelInvoice = catchAsync(async (req, res) => {
  const result = await InvoiceServices.cancelInvoice(
    req.params.id,
    req.user._id,
    req.body.reason
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice cancelled successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const uploadItemReport = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No report file was uploaded');
  }

  const result = await InvoiceServices.uploadItemReport(
    req.params.id,
    req.params.itemId,
    req.file,
    req.user._id
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report uploaded successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const markReportDelivered = catchAsync(async (req, res) => {
  const result = await InvoiceServices.markReportDelivered(
    req.params.id,
    req.params.itemId,
    req.user._id
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report marked as delivered',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const cancelInvoiceItem = catchAsync(async (req, res) => {
  const result = await InvoiceServices.cancelInvoiceItem(
    req.params.id,
    req.params.itemId,
    req.user._id,
    req.body.reason
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test cancelled successfully',
    data: serializeInvoice(result, req.user.role as TUserRole),
  });
});

const getReportDownloadUrl = catchAsync(async (req, res) => {
  const result = await InvoiceServices.getReportDownloadUrl(
    req.params.id,
    req.params.itemId
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report link generated successfully',
    data: result,
  });
});

/**
 * Streams the report itself rather than a link to it, so the browser gets the
 * content type and filename we recorded at upload instead of guessing from a
 * storage URL. Not sendResponse(): this is the file, not a JSON envelope.
 */
const getReportFile = catchAsync(async (req, res) => {
  const { body, mimeType, fileName } = await InvoiceServices.getReportFile(
    req.params.id,
    req.params.itemId
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', body.length);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fileName)}"`
  );
  // A medical record has no business in a shared cache.
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(body);
});

export const InvoiceControllers = {
  createInvoice,
  getInvoices,
  getInvoice,
  getPatientInvoices,
  updateInvoiceItems,
  cancelInvoice,
  cancelInvoiceItem,
  uploadItemReport,
  markReportDelivered,
  getReportDownloadUrl,
  getReportFile,
};
