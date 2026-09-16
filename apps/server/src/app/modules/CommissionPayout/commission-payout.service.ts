import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { dateRangeFilter, resolveDateRange } from '../../utils/dateRange';
import { round2 } from '../../utils/money';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { Invoice } from '../Invoice/invoice.model';
import { Referrer } from '../Referrer/referrer.model';
import { type TCommissionPayout } from './commission-payout.interface';
import { CommissionPayout } from './commission-payout.model';

export type TCreatePayoutInput = {
  referrer: string;
  invoiceIds?: string[];
  periodFrom?: string;
  periodTo?: string;
  paidOn?: string;
  note?: string;
};

/**
 * What is actually payable to a referrer right now.
 *
 * Commission accrues the moment an invoice is raised, but it is only settled
 * once the patient has paid in full, and that ordering is what keeps the
 * ledger consistent rather than being mere caution:
 *
 *   - a fully paid invoice cannot be cancelled (cancelInvoice refuses while
 *     any payment stands), and
 *   - none of its tests can be cancelled either, because dropping a line
 *     would take the net below what has already been collected.
 *
 * So by the time commission is payable, the figure behind it can no longer
 * move. Paying earlier is what creates the case where a doctor has been paid
 * for a test that was later called off.
 */
const pendingCommissionFilter = (referrerId: string) => ({
  referrer: new Types.ObjectId(referrerId),
  commissionStatus: 'pending' as const,
  isCancelled: { $ne: true },
  commissionAmount: { $gt: 0 },
  paymentStatus: 'paid' as const,
});

/** Accrued but not yet payable — the patient still owes on these. */
const awaitingSettlementFilter = (referrerId: string) => ({
  referrer: new Types.ObjectId(referrerId),
  commissionStatus: 'pending' as const,
  isCancelled: { $ne: true },
  commissionAmount: { $gt: 0 },
  paymentStatus: { $ne: 'paid' as const },
});

const createPayout = async (
  payload: TCreatePayoutInput,
  userId: string
): Promise<TCommissionPayout> => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const referrer = await Referrer.findById(payload.referrer).session(session);
    if (!referrer) {
      throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');
    }

    const filter: Record<string, unknown> = pendingCommissionFilter(
      payload.referrer
    );

    if (payload.invoiceIds?.length) {
      filter._id = {
        $in: payload.invoiceIds.map((id) => new Types.ObjectId(id)),
      };
    } else if (payload.periodFrom || payload.periodTo) {
      const bounds: Record<string, Date> = {};
      if (payload.periodFrom) bounds.$gte = new Date(payload.periodFrom);
      if (payload.periodTo) bounds.$lte = new Date(payload.periodTo);
      filter.visitDate = bounds;
    }

    const invoices = await Invoice.find(filter).session(session);

    if (invoices.length === 0) {
      const unsettled = await Invoice.countDocuments(
        awaitingSettlementFilter(payload.referrer)
      ).session(session);

      throw new AppError(
        httpStatus.BAD_REQUEST,
        unsettled > 0
          ? `Nothing payable yet. ${unsettled} invoice(s) have commission accrued but are not settled — commission is paid once the patient has.`
          : 'No pending commission found for this referrer'
      );
    }

    if (payload.invoiceIds?.length && invoices.length !== payload.invoiceIds.length) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Some selected invoices are cancelled, already settled, or belong to another referrer'
      );
    }

    const amount = round2(
      invoices.reduce((total, invoice) => total + invoice.commissionAmount, 0)
    );

    const seq = await nextSequence('commission-payout', session);

    const [payout] = await CommissionPayout.create(
      [
        {
          payoutNumber: formatDocNumber('CPO', seq),
          referrer: referrer._id,
          referrerName: referrer.name,
          referrerCode: referrer.referrerCode,
          invoices: invoices.map((invoice) => invoice._id),
          invoiceCount: invoices.length,
          periodFrom: payload.periodFrom
            ? new Date(payload.periodFrom)
            : undefined,
          periodTo: payload.periodTo ? new Date(payload.periodTo) : undefined,
          amount,
          paidOn: payload.paidOn ? new Date(payload.paidOn) : new Date(),
          paidBy: new Types.ObjectId(userId),
          note: payload.note,
        },
      ],
      { session }
    );

    await Invoice.updateMany(
      { _id: { $in: invoices.map((invoice) => invoice._id) } },
      { commissionStatus: 'paid', commissionPayout: payout._id },
      { session }
    );

    await session.commitTransaction();

    await recordActivity({
      userId,
      action: 'commission.paid_out',
      entity: 'CommissionPayout',
      entityId: payout._id,
      entityLabel: payout.payoutNumber,
      summary: `Paid ${amount} commission to ${referrer.name} covering ${invoices.length} invoice(s)`,
      meta: {
        amount,
        referrer: referrer.name,
        invoiceCount: invoices.length,
      },
    });

    return payout;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const getPayouts = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  const baseQuery = CommissionPayout.find({
    ...dateRangeFilter('paidOn', range),
  }).populate('paidBy', 'name email');

  const payoutQuery = new QueryBuilder(baseQuery, query)
    .search(['payoutNumber', 'referrerName', 'referrerCode'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [payouts, total] = await Promise.all([
    payoutQuery.modelQuery,
    payoutQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: payouts,
  };
};

const getPayout = async (id: string): Promise<TCommissionPayout> => {
  const payout = await CommissionPayout.findById(id)
    .populate('paidBy', 'name email')
    .populate('invoices', 'invoiceNumber visitDate netPayable commissionAmount');

  if (!payout) throw new AppError(httpStatus.NOT_FOUND, 'Payout not found');
  return payout;
};

/** What is still owed to a referrer, and which invoices make it up. */
const getPendingCommission = async (referrerId: string) => {
  const referrer = await Referrer.findById(referrerId);
  if (!referrer) throw new AppError(httpStatus.NOT_FOUND, 'Referrer not found');

  const [invoices, awaiting] = await Promise.all([
    Invoice.find(pendingCommissionFilter(referrerId))
      .select('invoiceNumber visitDate netPayable commissionType commissionValue commissionAmount')
      .sort({ visitDate: 1 }),
    Invoice.find(awaitingSettlementFilter(referrerId)).select(
      'invoiceNumber visitDate netPayable dueAmount commissionAmount'
    ),
  ]);

  const totalPending = round2(
    invoices.reduce((total, invoice) => total + invoice.commissionAmount, 0)
  );

  return {
    referrer,
    invoices,
    totalPending,
    /** Accrued, but the patient has not settled — so not payable yet. */
    awaitingSettlement: {
      invoiceCount: awaiting.length,
      total: round2(
        awaiting.reduce((sum, invoice) => sum + invoice.commissionAmount, 0)
      ),
    },
  };
};

export const CommissionPayoutServices = {
  createPayout,
  getPayouts,
  getPayout,
  getPendingCommission,
};
