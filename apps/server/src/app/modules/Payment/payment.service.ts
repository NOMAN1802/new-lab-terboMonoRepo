import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { dateRangeFilter, resolveDateRange } from '../../utils/dateRange';
import { round2 } from '../../utils/money';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { Invoice } from '../Invoice/invoice.model';
import { derivePaymentStatus } from '../Invoice/invoice.totals';
import { User } from '../User/user.model';
import { type TPayment } from './payment.interface';
import { Payment } from './payment.model';

const PaymentSearchableFields = [
  'receiptNumber',
  'invoiceNumber',
  'patientName',
];

/**
 * Recomputes an invoice's paid/due/status from the payment ledger and writes
 * the result back. The ledger is authoritative; the invoice fields are a cache.
 */
const syncInvoiceFromLedger = async (
  invoiceId: Types.ObjectId | string,
  session: mongoose.ClientSession
) => {
  const [totals] = await Payment.aggregate([
    {
      $match: {
        invoice: new Types.ObjectId(String(invoiceId)),
        isVoided: false,
      },
    },
    { $group: { _id: null, paid: { $sum: '$amount' } } },
  ]).session(session);

  const paidAmount = round2(totals?.paid ?? 0);

  const invoice = await Invoice.findById(invoiceId).session(session);
  if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

  const rawDue = round2(invoice.netPayable - paidAmount);

  invoice.set({
    paidAmount,
    dueAmount: rawDue < 0 ? 0 : rawDue,
    paymentStatus: derivePaymentStatus(invoice.netPayable, paidAmount),
  });

  await invoice.save({ session });
  return invoice;
};

const createPayment = async (
  payload: { invoice: string; amount: number; paymentDate?: string; note?: string },
  userId: string
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const invoice = await Invoice.findById(payload.invoice).session(session);
    if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

    if (invoice.isCancelled) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot take payment against a cancelled invoice'
      );
    }

    const amount = round2(payload.amount);

    // Overpayment would create a negative due and an untracked liability.
    if (amount > invoice.dueAmount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Payment of ${amount} exceeds the outstanding due of ${invoice.dueAmount}`
      );
    }

    const receiver = await User.findById(userId).session(session);
    if (!receiver) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

    const seq = await nextSequence('payment', session);

    const [payment] = await Payment.create(
      [
        {
          receiptNumber: formatDocNumber('RCP', seq),
          invoice: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          patient: invoice.patient,
          patientName: invoice.patientInfo.name,
          amount,
          method: 'cash',
          paymentDate: payload.paymentDate
            ? new Date(payload.paymentDate)
            : new Date(),
          receivedBy: new Types.ObjectId(userId),
          receivedByName: receiver.name,
          note: payload.note,
        },
      ],
      { session }
    );

    const updatedInvoice = await syncInvoiceFromLedger(invoice._id!, session);

    await session.commitTransaction();

    // Logged after commit so an audit failure can never roll back real money.
    await recordActivity({
      userId,
      action: 'payment.recorded',
      entity: 'Payment',
      entityId: payment._id,
      entityLabel: payment.receiptNumber,
      summary: `Took ${amount} from ${invoice.patientInfo.name} against ${invoice.invoiceNumber}`,
      meta: {
        amount,
        invoiceNumber: invoice.invoiceNumber,
        dueAfter: updatedInvoice.dueAmount,
      },
    });

    return { payment, invoice: updatedInvoice };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Hands money back to the patient. Recorded as a negative entry in the ledger,
 * with its own RFD number, so the history shows both the receipt and the
 * refund and the books net out. Admin only.
 */
const refundPayment = async (
  payload: { invoice: string; amount: number; reason: string },
  userId: string
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const invoice = await Invoice.findById(payload.invoice).session(session);
    if (!invoice) throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found');

    const amount = round2(payload.amount);
    if (!(amount > 0)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'A refund must be more than zero');
    }

    // Only what the patient has actually paid can go back.
    if (amount > invoice.paidAmount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        invoice.paidAmount > 0
          ? `Refund of ${amount} exceeds the ${invoice.paidAmount} paid on this invoice`
          : 'Nothing has been paid on this invoice, so there is nothing to refund'
      );
    }

    // A refund un-settles the invoice, and commission is only ever paid on a
    // settled one. Once it has gone out it has to be reversed first.
    if (invoice.commissionStatus === 'paid') {
      throw new AppError(
        httpStatus.CONFLICT,
        'Commission on this invoice has already been paid out. Reverse that payout before refunding.'
      );
    }

    const actor = await User.findById(userId).session(session);
    if (!actor) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

    const seq = await nextSequence('refund', session);

    const [refund] = await Payment.create(
      [
        {
          receiptNumber: formatDocNumber('RFD', seq),
          kind: 'refund',
          invoice: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          patient: invoice.patient,
          patientName: invoice.patientInfo.name,
          amount: -amount,
          paymentDate: new Date(),
          receivedBy: new Types.ObjectId(userId),
          receivedByName: actor.name,
          note: payload.reason,
        },
      ],
      { session }
    );

    const updatedInvoice = await syncInvoiceFromLedger(invoice._id!, session);

    await session.commitTransaction();

    await recordActivity({
      userId,
      action: 'payment.refunded',
      entity: 'Payment',
      entityId: refund._id,
      entityLabel: refund.receiptNumber,
      summary: `Refunded ${amount} to ${invoice.patientInfo.name} against ${invoice.invoiceNumber} — ${payload.reason}`,
      meta: {
        amount,
        reason: payload.reason,
        invoiceNumber: invoice.invoiceNumber,
        paidAfter: updatedInvoice.paidAmount,
      },
    });

    return { payment: refund, invoice: updatedInvoice };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const voidPayment = async (id: string, userId: string, reason: string) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const payment = await Payment.findById(id).session(session);
    if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');

    if (payment.isVoided) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment is already voided');
    }

    // A receipt that refunds have been paid against stays on record: voiding it
    // would leave a refund for money the books say was never taken.
    if (payment.kind !== 'refund') {
      const hasLiveRefund = await Payment.exists({
        invoice: payment.invoice,
        kind: 'refund',
        isVoided: false,
      }).session(session);
      if (hasLiveRefund) {
        throw new AppError(
          httpStatus.CONFLICT,
          'This invoice has refunds against it. Void the refunds first, or leave the receipt on record.'
        );
      }
    }

    payment.set({
      isVoided: true,
      voidedAt: new Date(),
      voidedBy: new Types.ObjectId(userId),
      voidReason: reason,
    });
    await payment.save({ session });

    const invoice = await syncInvoiceFromLedger(payment.invoice, session);

    // Voiding a refund after the patient has paid again would leave more on the
    // invoice than it is worth.
    if (round2(invoice.paidAmount - invoice.netPayable) > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Voiding this would leave the invoice overpaid. The patient has already paid the amount again.'
      );
    }

    await session.commitTransaction();

    await recordActivity({
      userId,
      action: 'payment.voided',
      entity: 'Payment',
      entityId: payment._id,
      entityLabel: payment.receiptNumber,
      summary: `Voided receipt ${payment.receiptNumber} for ${payment.amount} — ${reason}`,
      meta: {
        amount: payment.amount,
        reason,
        invoiceNumber: payment.invoiceNumber,
        dueAfter: invoice.dueAmount,
      },
    });

    return { payment, invoice };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const getPayments = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  const baseQuery = Payment.find({
    ...dateRangeFilter('paymentDate', range),
  }).populate('receivedBy', 'name email');

  const paymentQuery = new QueryBuilder(baseQuery, query)
    .search(PaymentSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [payments, total] = await Promise.all([
    paymentQuery.modelQuery,
    paymentQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: payments,
  };
};

const getPayment = async (id: string): Promise<TPayment> => {
  const payment = await Payment.findById(id).populate(
    'receivedBy',
    'name email'
  );
  if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  return payment;
};

/** Full receipt history for one invoice, voided entries included. */
const getInvoicePayments = async (invoiceId: string): Promise<TPayment[]> =>
  Payment.find({ invoice: invoiceId })
    .sort({ paymentDate: 1 })
    .populate('receivedBy', 'name email');

export const PaymentServices = {
  createPayment,
  refundPayment,
  voidPayment,
  getPayments,
  getPayment,
  getInvoicePayments,
  syncInvoiceFromLedger,
};
