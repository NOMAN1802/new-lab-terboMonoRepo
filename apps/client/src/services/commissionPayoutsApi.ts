import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';
import type { Referrer } from './referrersApi';
import type { CommissionType } from './invoicesApi';

export type PayoutKind = 'lab' | 'appointment';

export type CommissionPayout = {
    _id: string;
    payoutNumber: string;
    referrer: string;
    referrerName: string;
    referrerCode: string;
    invoices: string[];
    invoiceCount: number;
    /** Lab commission or appointment fee share. Older payouts have none (lab). */
    kind?: PayoutKind;
    periodFrom?: string;
    periodTo?: string;
    amount: number;
    paidOn: string;
    paidBy: { _id: string; name: string } | string;
    note?: string;
    createdAt: string;
};

export type PendingCommission = {
    referrer: Referrer;
    invoices: {
        _id: string;
        invoiceNumber: string;
        visitDate: string;
        netPayable: number;
        commissionType: CommissionType;
        commissionValue: number;
        commissionAmount: number;
        /** A consultation line means the doctor's share of an appointment fee. */
        items?: { kind?: 'test' | 'consultation' }[];
    }[];
    totalPending: number;
    /**
     * Accrued but not payable: the patient has not settled these yet. Reported
     * separately so an admin can see why a figure they expected is not offered.
     */
    awaitingSettlement: { invoiceCount: number; total: number };
};

export type CreatePayoutInput = {
    referrer: string;
    kind?: PayoutKind;
    invoiceIds?: string[];
    periodFrom?: string;
    periodTo?: string;
    paidOn?: string;
    note?: string;
};

export const commissionPayoutsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getCommissionPayouts: builder.query<
            Paginated<CommissionPayout>,
            (ListQuery & { kind?: PayoutKind }) | void
        >({
            query: (params) => ({
                url: '/commission-payouts',
                params: cleanParams({
                    page: 1,
                    limit: 20,
                    sortBy: '-paidOn',
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<CommissionPayout>,
            providesTags: [{ type: 'CommissionPayouts', id: 'LIST' }],
        }),

        getPendingCommission: builder.query<PendingCommission, { referrerId: string; kind?: PayoutKind }>({
            query: ({ referrerId, kind }) => ({
                url: `/commission-payouts/pending/${referrerId}`,
                params: cleanParams({ kind }),
            }),
            transformResponse: (r: ApiResponse<PendingCommission>) => r.data,
            providesTags: (_r, _e, { referrerId }) => [
                { type: 'CommissionPayouts', id: `PENDING-${referrerId}` },
            ],
        }),

        createCommissionPayout: builder.mutation<CommissionPayout, CreatePayoutInput>({
            query: (body) => ({ url: '/commission-payouts', method: 'POST', body }),
            transformResponse: (r: ApiResponse<CommissionPayout>) => r.data,
            invalidatesTags: (_r, _e, { referrer }) => [
                { type: 'CommissionPayouts', id: 'LIST' },
                { type: 'CommissionPayouts', id: `PENDING-${referrer}` },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Reports' },
                { type: 'Dashboard', id: 'ALL' },
            ],
        }),
    }),
});

export const {
    useGetCommissionPayoutsQuery,
    useGetPendingCommissionQuery,
    useCreateCommissionPayoutMutation,
} = commissionPayoutsApi;
