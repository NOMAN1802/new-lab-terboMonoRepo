import { ActivityLogServices } from '../ActivityLog/activity-log.service';
import { Invoice } from '../Invoice/invoice.model';
import { Patient } from '../Patient/patient.model';
import { Payment } from '../Payment/payment.model';
import {
  type TDateRange,
  type TGroupBy,
  dateRangeFilter,
  endOfDhakaDay,
  groupByExpression,
  startOfDhakaDay,
} from '../../utils/dateRange';
import { round2 } from '../../utils/money';

const liveInvoice = { isCancelled: { $ne: true } };
const livePayment = { isVoided: false };

const todayRange = (): TDateRange => {
  const now = new Date();
  return { start: startOfDhakaDay(now), end: endOfDhakaDay(now) };
};

/**
 * Money actually received in a window, from the payment ledger.
 * Collections are counted on payment date, not invoice date — a payment taken
 * today against last week's invoice is today's cash.
 */
const collectedIn = async (range: TDateRange): Promise<number> => {
  const [result] = await Payment.aggregate([
    { $match: { ...livePayment, ...dateRangeFilter('paymentDate', range) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return round2(result?.total ?? 0);
};

/** Amounts billed in a window, from the invoices raised in it. */
const billedIn = async (range: TDateRange) => {
  const [result] = await Invoice.aggregate([
    { $match: { ...liveInvoice, ...dateRangeFilter('visitDate', range) } },
    {
      $group: {
        _id: null,
        invoiceCount: { $sum: 1 },
        gross: { $sum: '$grossAmount' },
        discount: { $sum: '$discountAmount' },
        net: { $sum: '$netPayable' },
        due: { $sum: '$dueAmount' },
        // Settled against these invoices. Distinct from `collected`, which is
        // counted on payment date: a part-payment taken today against last
        // week's invoice lands in this week's `collected` but in last week's
        // `paid`. Pairing it with `due` keeps the two halves of the same
        // invoices comparable.
        paid: { $sum: '$paidAmount' },
        // Commission is earned when the patient pays, so an unpaid invoice
        // contributes none of it — and the revenue tile below subtracts only
        // what is genuinely owed.
        commission: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$commissionAmount', 0],
          },
        },
      },
    },
  ]);

  return {
    invoiceCount: result?.invoiceCount ?? 0,
    gross: round2(result?.gross ?? 0),
    discount: round2(result?.discount ?? 0),
    net: round2(result?.net ?? 0),
    due: round2(result?.due ?? 0),
    paid: round2(result?.paid ?? 0),
    commission: round2(result?.commission ?? 0),
  };
};

/**
 * Report progress for the invoices raised in a window, counted per test rather
 * than per invoice — an invoice with three tests can be two-thirds reported,
 * and the delivery desk works a test at a time.
 */
const reportStatusIn = async (range: TDateRange) => {
  const rows = await Invoice.aggregate([
    { $match: { ...liveInvoice, ...dateRangeFilter('visitDate', range) } },
    { $unwind: '$items' },
    // A cancelled test is not a report anybody is waiting for.
    { $match: { 'items.isCancelled': { $ne: true } } },
    { $group: { _id: '$items.reportStatus', count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count]));

  return {
    pending: byStatus.pending ?? 0,
    uploaded: byStatus.uploaded ?? 0,
    delivered: byStatus.delivered ?? 0,
  };
};

const getAdminDashboard = async (range: TDateRange, groupBy: TGroupBy) => {
  const today = todayRange();

  const [
    todayCollected,
    todayBilled,
    todayPatients,
    periodCollected,
    periodBilled,
    periodPatients,
    periodReports,
    commissionSplit,
    trend,
    byReferrer,
    byReceptionist,
    outstanding,
    recentActivity,
    activityByUser,
  ] = await Promise.all([
    collectedIn(today),
    billedIn(today),
    Patient.countDocuments({
      isDeleted: false,
      createdAt: { $gte: today.start!, $lt: today.end! },
    }),
    collectedIn(range),
    billedIn(range),
    Patient.countDocuments({
      isDeleted: false,
      ...dateRangeFilter('createdAt', range),
    }),
    reportStatusIn(range),

    // Commission accrued vs paid vs pending (proposal §4.8).
    Invoice.aggregate([
      {
        $match: {
          ...liveInvoice,
          // An unpaid invoice owes the doctor nothing yet, so it stays out of
          // the split rather than inflating "pending" with money not owed.
          paymentStatus: 'paid',
          ...dateRangeFilter('visitDate', range),
        },
      },
      {
        $group: {
          _id: '$commissionStatus',
          total: { $sum: '$commissionAmount' },
        },
      },
    ]),

    // Revenue trend over the window.
    Payment.aggregate([
      { $match: { ...livePayment, ...dateRangeFilter('paymentDate', range) } },
      {
        $group: {
          _id: groupByExpression(groupBy, 'paymentDate'),
          collected: { $sum: '$amount' },
          receipts: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Referrer-wise: what they brought in and what they earned.
    Invoice.aggregate([
      {
        $match: {
          ...liveInvoice,
          referrer: { $ne: null },
          ...dateRangeFilter('visitDate', range),
        },
      },
      {
        $group: {
          _id: '$referrer',
          referrerName: { $first: '$referrerInfo.name' },
          referrerCode: { $first: '$referrerInfo.referrerCode' },
          invoiceCount: { $sum: 1 },
          gross: { $sum: '$grossAmount' },
          discount: { $sum: '$discountAmount' },
          net: { $sum: '$netPayable' },
          collected: { $sum: '$paidAmount' },
          commission: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$commissionAmount', 0],
            },
          },
        },
      },
      { $sort: { net: -1 } },
      { $limit: 20 },
    ]),

    // Receptionist-wise cash collection.
    Payment.aggregate([
      { $match: { ...livePayment, ...dateRangeFilter('paymentDate', range) } },
      {
        $group: {
          _id: '$receivedBy',
          name: { $first: '$receivedByName' },
          collected: { $sum: '$amount' },
          receipts: { $sum: 1 },
        },
      },
      { $sort: { collected: -1 } },
    ]),

    // Outstanding on the invoices raised in the window, so it moves with the
    // range filter like every other tile. The all-time figure is still on the
    // Dues report, which is where a full ledger belongs.
    Invoice.aggregate([
      {
        $match: {
          ...liveInvoice,
          dueAmount: { $gt: 0 },
          ...dateRangeFilter('visitDate', range),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$dueAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),

    // User activity monitoring (proposal §4.2). The dashboard shows the last
    // five; the Activity screen is where the full log is read.
    ActivityLogServices.getRecentActivity(5),
    ActivityLogServices.getActivityByUser({
      startDate: range.start?.toISOString().slice(0, 10),
      endDate: range.end?.toISOString().slice(0, 10),
    }),
  ]);

  const commissionByStatus = Object.fromEntries(
    commissionSplit.map((entry) => [entry._id, round2(entry.total)])
  );

  return {
    today: {
      collected: todayCollected,
      newPatients: todayPatients,
      ...todayBilled,
    },
    period: {
      collected: periodCollected,
      newPatients: periodPatients,
      reports: periodReports,
      ...periodBilled,
      /**
       * What the centre keeps: cash in hand, less the commission owed to the
       * referring doctors on it. Built from collected rather than billed —
       * an unpaid invoice has earned nothing yet. Same definition as the
       * financial summary's `revenue`.
       */
      revenue: round2(periodCollected - periodBilled.commission),
    },
    commission: {
      accrued: round2(periodBilled.commission),
      paid: commissionByStatus.paid ?? 0,
      pending: commissionByStatus.pending ?? 0,
    },
    outstanding: {
      total: round2(outstanding[0]?.total ?? 0),
      invoiceCount: outstanding[0]?.invoiceCount ?? 0,
    },
    trend,
    byReferrer,
    byReceptionist,
    recentActivity,
    activityByUser,
  };
};

/**
 * Operational only. No revenue, discount, commission or profit figures reach
 * this payload (proposal §4.2) — dues are included because collecting them is
 * the receptionist's job.
 */
const getReceptionistDashboard = async (userId: string) => {
  const today = todayRange();
  const todayFilter = dateRangeFilter('visitDate', today);

  const [bookings, reportStatus, pendingPayments, myCollection] =
    await Promise.all([
      Invoice.countDocuments({ ...liveInvoice, ...todayFilter }),

      Invoice.aggregate([
        { $match: { ...liveInvoice, ...todayFilter } },
        { $unwind: '$items' },
        { $group: { _id: '$items.reportStatus', count: { $sum: 1 } } },
      ]),

      Invoice.find({ ...liveInvoice, dueAmount: { $gt: 0 } })
        .select('invoiceNumber visitDate patientInfo netPayable paidAmount dueAmount paymentStatus')
        .sort({ visitDate: -1 })
        .limit(20),

      Payment.aggregate([
        {
          $match: {
            ...livePayment,
            receivedBy: userId,
            ...dateRangeFilter('paymentDate', today),
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, receipts: { $sum: 1 } } },
      ]),
    ]);

  const reports = Object.fromEntries(
    reportStatus.map((entry) => [entry._id, entry.count])
  );

  return {
    today: {
      bookings,
      myCollection: round2(myCollection[0]?.total ?? 0),
      myReceipts: myCollection[0]?.receipts ?? 0,
    },
    reports: {
      pending: reports.pending ?? 0,
      uploaded: reports.uploaded ?? 0,
      delivered: reports.delivered ?? 0,
    },
    pendingPayments,
  };
};

export const DashboardServices = {
  getAdminDashboard,
  getReceptionistDashboard,
};
