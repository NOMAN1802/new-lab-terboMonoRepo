import { Invoice } from '../Invoice/invoice.model';
import { Patient } from '../Patient/patient.model';
import { Payment } from '../Payment/payment.model';
import {
  type TDateRange,
  type TGroupBy,
  dateRangeFilter,
  groupByExpression,
} from '../../utils/dateRange';
import { round2 } from '../../utils/money';

const liveInvoice = { isCancelled: { $ne: true } };
const livePayment = { isVoided: false };

/**
 * Patient activity for a date range. Contains no financial columns beyond the
 * payment status a receptionist needs — this is the one report both roles see
 * (proposal §4.9).
 */
const getPatientReport = async (range: TDateRange) => {
  const invoices = await Invoice.find({
    ...liveInvoice,
    ...dateRangeFilter('visitDate', range),
  })
    .select('invoiceNumber visitDate patientInfo items paymentStatus createdBy')
    .populate('createdBy', 'name')
    .sort({ visitDate: -1 });

  const [newPatients, totalPatients] = await Promise.all([
    Patient.countDocuments({
      isDeleted: false,
      ...dateRangeFilter('createdAt', range),
    }),
    Patient.countDocuments({ isDeleted: false }),
  ]);

  const rows = invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    visitDate: invoice.visitDate,
    patientId: invoice.patientInfo.patientId,
    patientName: invoice.patientInfo.name,
    age: invoice.patientInfo.age,
    gender: invoice.patientInfo.gender,
    phone: invoice.patientInfo.phone,
    tests: invoice.items.map((item) => item.testName),
    testCount: invoice.items.length,
    reportsPending: invoice.items.filter(
      (item) => item.reportStatus === 'pending'
    ).length,
    paymentStatus: invoice.paymentStatus,
  }));

  return {
    summary: {
      visits: invoices.length,
      newPatients,
      totalPatients,
      testsPerformed: rows.reduce((total, row) => total + row.testCount, 0),
    },
    rows,
  };
};

/** Cash received, grouped for charting. Admin only. */
const getRevenueReport = async (range: TDateRange, groupBy: TGroupBy) => {
  const [series, totals] = await Promise.all([
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
    Payment.aggregate([
      { $match: { ...livePayment, ...dateRangeFilter('paymentDate', range) } },
      {
        $group: {
          _id: null,
          collected: { $sum: '$amount' },
          receipts: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    summary: {
      collected: round2(totals[0]?.collected ?? 0),
      receipts: totals[0]?.receipts ?? 0,
    },
    series,
  };
};

/**
 * The headline financial picture. Billed and collected are deliberately
 * separate figures: an invoice raised today may be collected next week.
 */
const getFinancialSummary = async (range: TDateRange) => {
  const [billed, collected] = await Promise.all([
    Invoice.aggregate([
      { $match: { ...liveInvoice, ...dateRangeFilter('visitDate', range) } },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          gross: { $sum: '$grossAmount' },
          discount: { $sum: '$discountAmount' },
          net: { $sum: '$netPayable' },
          due: { $sum: '$dueAmount' },
          // Only settled invoices earn commission, so only they are counted.
          commission: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$commissionAmount', 0],
            },
          },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...livePayment, ...dateRangeFilter('paymentDate', range) } },
      { $group: { _id: null, collected: { $sum: '$amount' } } },
    ]),
  ]);

  const b = billed[0] ?? {};
  const grossBilled = round2(b.gross ?? 0);
  const discountGiven = round2(b.discount ?? 0);
  const netBilled = round2(b.net ?? 0);
  const commissionAccrued = round2(b.commission ?? 0);
  const cashCollected = round2(collected[0]?.collected ?? 0);

  return {
    invoiceCount: b.invoiceCount ?? 0,
    grossBilled,
    discountGiven,
    netBilled,
    cashCollected,
    outstanding: round2(b.due ?? 0),
    commissionAccrued,
    /**
     * Revenue is what the centre actually keeps: cash in hand, less what is
     * owed to the referring doctors on it. It is built from cashCollected, not
     * netBilled — an invoice that has not been paid has earned nothing yet.
     *
     * The two sides are scoped differently, and deliberately: cash is counted
     * by payment date, commission by the invoice's visit date. Over any period
     * longer than a few days they converge; on a single day a payment against
     * an older invoice can carry no matching commission.
     */
    revenue: round2(cashCollected - commissionAccrued),
    discountRate: grossBilled > 0 ? round2((discountGiven / grossBilled) * 100) : 0,
    collectionRate:
      netBilled > 0 ? round2((cashCollected / netBilled) * 100) : 0,
  };
};

/** Discounts given and commission owed, per referrer. Admin only. */
const getReferralCommissionReport = async (range: TDateRange) => {
  const rows = await Invoice.aggregate([
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
        hospital: { $first: '$referrerInfo.hospital' },
        invoiceCount: { $sum: 1 },
        grossBilled: { $sum: '$grossAmount' },
        discountGiven: { $sum: '$discountAmount' },
        netBilled: { $sum: '$netPayable' },
        collected: { $sum: '$paidAmount' },
        commissionAccrued: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$commissionAmount', 0],
          },
        },
        // Accrued on paper but not payable yet — the patient still owes.
        commissionAwaiting: {
          $sum: {
            $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$commissionAmount', 0],
          },
        },
        commissionPaid: {
          $sum: {
            $cond: [
              { $eq: ['$commissionStatus', 'paid'] },
              '$commissionAmount',
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        commissionPending: {
          $subtract: ['$commissionAccrued', '$commissionPaid'],
        },
      },
    },
    { $sort: { commissionAccrued: -1 } },
  ]);

  const summary = rows.reduce(
    (acc, row) => ({
      referrers: acc.referrers + 1,
      invoiceCount: acc.invoiceCount + row.invoiceCount,
      discountGiven: acc.discountGiven + row.discountGiven,
      commissionAccrued: acc.commissionAccrued + row.commissionAccrued,
      commissionAwaiting: acc.commissionAwaiting + row.commissionAwaiting,
      commissionPaid: acc.commissionPaid + row.commissionPaid,
      commissionPending: acc.commissionPending + row.commissionPending,
    }),
    {
      referrers: 0,
      invoiceCount: 0,
      discountGiven: 0,
      commissionAccrued: 0,
      commissionAwaiting: 0,
      commissionPaid: 0,
      commissionPending: 0,
    }
  );

  return {
    summary: {
      ...summary,
      discountGiven: round2(summary.discountGiven),
      commissionAccrued: round2(summary.commissionAccrued),
      commissionAwaiting: round2(summary.commissionAwaiting),
      commissionPaid: round2(summary.commissionPaid),
      commissionPending: round2(summary.commissionPending),
    },
    rows,
  };
};

/** Every invoice still carrying a balance. Admin only. */
const getDuesReport = async (range: TDateRange) => {
  const invoices = await Invoice.find({
    ...liveInvoice,
    dueAmount: { $gt: 0 },
    ...dateRangeFilter('visitDate', range),
  })
    .select(
      'invoiceNumber visitDate patientInfo referrerInfo netPayable paidAmount dueAmount paymentStatus'
    )
    .sort({ dueAmount: -1 });

  const total = round2(
    invoices.reduce((sum, invoice) => sum + invoice.dueAmount, 0)
  );

  return {
    summary: { invoiceCount: invoices.length, totalDue: total },
    rows: invoices,
  };
};

/** Cash collected per receptionist — reconciles the till. Admin only. */
const getCollectionByUserReport = async (range: TDateRange) => {
  const rows = await Payment.aggregate([
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
  ]);

  return {
    summary: {
      users: rows.length,
      collected: round2(rows.reduce((sum, row) => sum + row.collected, 0)),
      receipts: rows.reduce((sum, row) => sum + row.receipts, 0),
    },
    rows,
  };
};

export const ReportsServices = {
  getPatientReport,
  getRevenueReport,
  getFinancialSummary,
  getReferralCommissionReport,
  getDuesReport,
  getCollectionByUserReport,
};
