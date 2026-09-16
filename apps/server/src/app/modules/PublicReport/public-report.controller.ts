import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PublicReportServices } from './public-report.service';

const getSummary = catchAsync(async (req, res) => {
  const result = await PublicReportServices.getSummary(req.params.token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice found',
    data: result,
  });
});

const verify = catchAsync(async (req, res) => {
  const result = await PublicReportServices.verify(
    req.params.token,
    String(req.body.last4)
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Verified',
    data: result,
  });
});

/**
 * Streams the bytes rather than going through sendResponse, matching the staff
 * report route. The invoice id comes from the verified session, never from the
 * URL, so a patient cannot point a valid session at another invoice.
 */
const getReportFile = catchAsync(async (req, res) => {
  const { body, mimeType, fileName } = await PublicReportServices.getReportFile(
    req.publicSession!.invoiceId,
    req.params.itemId
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', body.length);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fileName)}"`
  );
  // Nothing about a medical report belongs in a shared cache.
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(body);
});

export const PublicReportControllers = {
  getSummary,
  verify,
  getReportFile,
};
