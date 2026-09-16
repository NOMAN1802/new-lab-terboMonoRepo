import { baseApi } from './baseApi';
import { cleanParams } from './types';
import type { ApiResponse, DateRangeQuery } from './types';

export type PatientReportRow = {
    invoiceNumber: string;
    visitDate: string;
    patientId: string;
    patientName: string;
    age: number;
    gender: string;
    phone: string;
    tests: string[];
    testCount: number;
    reportsPending: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
};

export type PatientReport = {
    summary: {
        visits: number;
        newPatients: number;
        totalPatients: number;
        testsPerformed: number;
    };
    rows: PatientReportRow[];
};

export type RevenueReport = {
    summary: { collected: number; receipts: number };
    series: { _id: string; collected: number; receipts: number }[];
};

export type FinancialSummary = {
    invoiceCount: number;
    grossBilled: number;
    discountGiven: number;
    netBilled: number;
    cashCollected: number;
    outstanding: number;
    commissionAccrued: number;
    /** Cash collected less the commission owed on it — what the centre keeps. */
    revenue: number;
    discountRate: number;
    collectionRate: number;
};

export type ReferralCommissionRow = {
    _id: string;
    referrerName: string;
    referrerCode: string;
    hospital?: string;
    invoiceCount: number;
    grossBilled: number;
    discountGiven: number;
    netBilled: number;
    collected: number;
    /** Commission is earned on settlement, so this counts paid invoices only. */
    commissionAccrued: number;
    /** Accrued on paper but not payable yet — the patient still owes. */
    commissionAwaiting: number;
    commissionPaid: number;
    commissionPending: number;
};

export type ReferralCommissionReport = {
    summary: {
        referrers: number;
        invoiceCount: number;
        discountGiven: number;
        commissionAccrued: number;
        commissionAwaiting: number;
        commissionPaid: number;
        commissionPending: number;
    };
    rows: ReferralCommissionRow[];
};

export type DuesReportRow = {
    _id: string;
    invoiceNumber: string;
    visitDate: string;
    patientInfo: { patientId: string; name: string; phone: string };
    referrerInfo?: { name: string; referrerCode: string };
    netPayable: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: string;
};

export type DuesReport = {
    summary: { invoiceCount: number; totalDue: number };
    rows: DuesReportRow[];
};

export type CollectionByUserReport = {
    summary: { users: number; collected: number; receipts: number };
    rows: { _id: string; name: string; collected: number; receipts: number }[];
};

const rangeQuery = (url: string) => (params: DateRangeQuery | void) => ({
    url,
    params: cleanParams({ ...(params ?? {}) }),
});

export const reportsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Available to both roles — patient data only.
        getPatientReport: builder.query<PatientReport, DateRangeQuery | void>({
            query: rangeQuery('/reports/patients'),
            transformResponse: (r: ApiResponse<PatientReport>) => r.data,
            providesTags: [{ type: 'Reports', id: 'PATIENTS' }],
        }),

        // Admin only — the API returns 403 for receptionists.
        getRevenueReport: builder.query<
            RevenueReport,
            (DateRangeQuery & { groupBy?: 'daily' | 'monthly' | 'yearly' }) | void
        >({
            query: (params) => ({
                url: '/reports/revenue',
                params: cleanParams({ ...(params ?? {}) }),
            }),
            transformResponse: (r: ApiResponse<RevenueReport>) => r.data,
            providesTags: [{ type: 'Reports', id: 'REVENUE' }],
        }),

        getFinancialSummary: builder.query<FinancialSummary, DateRangeQuery | void>({
            query: rangeQuery('/reports/financial-summary'),
            transformResponse: (r: ApiResponse<FinancialSummary>) => r.data,
            providesTags: [{ type: 'Reports', id: 'FINANCIAL' }],
        }),

        getReferralCommissionReport: builder.query<
            ReferralCommissionReport,
            DateRangeQuery | void
        >({
            query: rangeQuery('/reports/referral-commission'),
            transformResponse: (r: ApiResponse<ReferralCommissionReport>) => r.data,
            providesTags: [{ type: 'Reports', id: 'COMMISSION' }],
        }),

        getDuesReport: builder.query<DuesReport, DateRangeQuery | void>({
            query: rangeQuery('/reports/dues'),
            transformResponse: (r: ApiResponse<DuesReport>) => r.data,
            providesTags: [{ type: 'Reports', id: 'DUES' }],
        }),

        getCollectionByUserReport: builder.query<
            CollectionByUserReport,
            DateRangeQuery | void
        >({
            query: rangeQuery('/reports/collection-by-user'),
            transformResponse: (r: ApiResponse<CollectionByUserReport>) => r.data,
            providesTags: [{ type: 'Reports', id: 'COLLECTION' }],
        }),
    }),
});

export const {
    useGetPatientReportQuery,
    useGetRevenueReportQuery,
    useGetFinancialSummaryQuery,
    useGetReferralCommissionReportQuery,
    useGetDuesReportQuery,
    useGetCollectionByUserReportQuery,
} = reportsApi;
