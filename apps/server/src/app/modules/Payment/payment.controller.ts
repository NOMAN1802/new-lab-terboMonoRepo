import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { type TInvoice } from '../Invoice/invoice.interface';
import { InvoiceServices } from '../Invoice/invoice.service';
import { serializeInvoice } from '../Invoice/invoice.serializer';
import { type TUserRole } from '../User/user.interface';
import { PaymentServices } from './payment.service';

const createPayment = catchAsync(async (req, res) => {
  const { payment, invoice } = await PaymentServices.createPayment(
    req.body,
    req.user._id
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Payment recorded successfully',
    data: {
      payment,
      invoice: serializeInvoice(invoice, req.user.role as TUserRole),
    },
  });
});

const refundPayment = catchAsync(async (req, res) => {
  const { invoice: invoiceId, amount, reason, cancelInvoice } = req.body;
  const refunded = await PaymentServices.refundPayment(
    { invoice: invoiceId, amount, reason },
    req.user._id
  );

  // Refund and cancel in one go: only when the refund cleared everything paid,
  // since an invoice with money still on it cannot be cancelled.
  let invoice: TInvoice = refunded.invoice;
  if (cancelInvoice && invoice.paidAmount === 0 && !invoice.isCancelled) {
    invoice = await InvoiceServices.cancelInvoice(invoiceId, req.user._id, reason);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Refund recorded successfully',
    data: {
      payment: refunded.payment,
      invoice: serializeInvoice(invoice, req.user.role as TUserRole),
    },
  });
});

const voidPayment = catchAsync(async (req, res) => {
  const { payment, invoice } = await PaymentServices.voidPayment(
    req.params.id,
    req.user._id,
    req.body.reason
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment voided successfully',
    data: {
      payment,
      invoice: serializeInvoice(invoice, req.user.role as TUserRole),
    },
  });
});

const getPayments = catchAsync(async (req, res) => {
  const { meta, result } = await PaymentServices.getPayments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payments retrieved successfully',
    meta,
    data: result,
  });
});

const getPayment = catchAsync(async (req, res) => {
  const result = await PaymentServices.getPayment(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment retrieved successfully',
    data: result,
  });
});

const getInvoicePayments = catchAsync(async (req, res) => {
  const result = await PaymentServices.getInvoicePayments(req.params.invoiceId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment history retrieved successfully',
    data: result,
  });
});

export const PaymentControllers = {
  createPayment,
  refundPayment,
  voidPayment,
  getPayments,
  getPayment,
  getInvoicePayments,
};
