import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';
import type { CommissionType } from './invoicesApi';

/**
 * The default* fields are the referrer's standing terms and are omitted by the
 * API for receptionists, so treat them as optional everywhere in the UI.
 *
 * Discount comes off the patient's bill. Commission is what the centre pays
 * the referrer, either a percentage of the net the patient pays or a flat
 * taka amount — `defaultCommissionValue` means whichever the type says.
 */
export type Referrer = {
    _id: string;
    referrerCode: string;
    name: string;
    designation?: string;
    hospital?: string;
    phone: string;
    address?: string;
    defaultDiscountPercent?: number;
    defaultCommissionType?: CommissionType;
    defaultCommissionValue?: number;
    isActive: boolean;
    createdAt: string;
};

export type ReferrerInput = {
    referrerCode: string;
    name: string;
    designation?: string;
    hospital?: string;
    phone: string;
    address?: string;
    defaultDiscountPercent?: number;
    defaultCommissionType?: CommissionType;
    defaultCommissionValue?: number;
    isActive?: boolean;
};

export const referrersApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getReferrers: builder.query<Paginated<Referrer>, ListQuery | void>({
            query: (params) => ({
                url: '/referrers',
                params: cleanParams({
                    page: 1,
                    limit: 200,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Referrer>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({
                              type: 'Referrers' as const,
                              id: _id,
                          })),
                          { type: 'Referrers' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Referrers', id: 'LIST' }],
        }),

        getReferrer: builder.query<Referrer, string>({
            query: (id) => ({ url: `/referrers/${id}` }),
            transformResponse: (r: ApiResponse<Referrer>) => r.data,
            providesTags: (_r, _e, id) => [{ type: 'Referrers', id }],
        }),

        createReferrer: builder.mutation<Referrer, ReferrerInput>({
            query: (body) => ({ url: '/referrers', method: 'POST', body }),
            transformResponse: (r: ApiResponse<Referrer>) => r.data,
            invalidatesTags: [{ type: 'Referrers', id: 'LIST' }],
        }),

        updateReferrer: builder.mutation<
            Referrer,
            { id: string; data: Partial<ReferrerInput> }
        >({
            query: ({ id, data }) => ({
                url: `/referrers/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (r: ApiResponse<Referrer>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Referrers', id },
                { type: 'Referrers', id: 'LIST' },
            ],
        }),

        deleteReferrer: builder.mutation<void, string>({
            query: (id) => ({ url: `/referrers/${id}`, method: 'DELETE' }),
            invalidatesTags: [{ type: 'Referrers', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetReferrersQuery,
    useGetReferrerQuery,
    useCreateReferrerMutation,
    useUpdateReferrerMutation,
    useDeleteReferrerMutation,
} = referrersApi;
