import { baseApi } from './baseApi';
import { cleanParams } from './types';
import type { ApiResponse, DateRangeQuery } from './types';
import type { Invoice } from './invoicesApi';
import type { ActivityByUserRow, ActivityEntry } from './activityApi';

export type TrendPoint = { _id: string; collected: number; receipts: number };

export type ReferrerSummaryRow = {
    _id: string;
    referrerName: string;
    referrerCode: string;
    invoiceCount: number;
    gross: number;
    discount: number;
    net: number;
    collected: number;
    commission: number;
};

export type UserCollectionRow = {
    _id: string;
    name: string;
    collected: number;
    receipts: number;
};

export type AdminDashboard = {
    today: {
        collected: number;
        newPatients: number;
        invoiceCount: number;
        gross: number;
        discount: number;
        net: number;
        due: number;
        commission: number;
    };
    period: {
        collected: number;
        newPatients: number;
        reports: { pending: number; uploaded: number; delivered: number };
        invoiceCount: number;
        gross: number;
        discount: number;
        net: number;
        due: number;
        /** Settled against the invoices raised in the window. */
        paid: number;
        commission: number;
        /** Cash collected less the commission owed on it — what the centre keeps. */
        revenue: number;
    };
    commission: { accrued: number; paid: number; pending: number };
    outstanding: { total: number; invoiceCount: number };
    trend: TrendPoint[];
    byReferrer: ReferrerSummaryRow[];
    byReceptionist: UserCollectionRow[];
    recentActivity: ActivityEntry[];
    activityByUser: ActivityByUserRow[];
};

export type ReceptionistDashboard = {
    today: { bookings: number; myCollection: number; myReceipts: number };
    reports: { pending: number; uploaded: number; delivered: number };
    pendingPayments: Invoice[];
};

/** The API returns one shape or the other, chosen by the caller's role. */
export type DashboardData = AdminDashboard | ReceptionistDashboard;

export const isAdminDashboard = (
    data: DashboardData
): data is AdminDashboard => 'commission' in data;

export const dashboardApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDashboard: builder.query<
            DashboardData,
            (DateRangeQuery & { groupBy?: 'daily' | 'monthly' | 'yearly' }) | void
        >({
            query: (params) => ({
                url: '/dashboard',
                params: cleanParams({ ...(params ?? {}) }),
            }),
            transformResponse: (r: ApiResponse<DashboardData>) => r.data,
            providesTags: [{ type: 'Dashboard', id: 'ALL' }],
        }),
    }),
});

export const { useGetDashboardQuery } = dashboardApi;
