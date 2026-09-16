import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type LabTest = {
    _id: string;
    testCode: string;
    name: string;
    category?: { _id: string; name: string } | string;
    categoryName?: string;
    price: number;
    sampleType?: string;
    reportDeliveryDays?: number;
    description?: string;
    isActive: boolean;
    createdAt: string;
};

export type LabTestInput = {
    testCode: string;
    name: string;
    category?: string;
    price: number;
    sampleType?: string;
    reportDeliveryDays?: number;
    description?: string;
    isActive?: boolean;
};

export const testsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getTests: builder.query<Paginated<LabTest>, ListQuery | void>({
            query: (params) => ({
                url: '/tests',
                params: cleanParams({
                    page: 1,
                    limit: 200,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<LabTest>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({
                              type: 'Tests' as const,
                              id: _id,
                          })),
                          { type: 'Tests' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Tests', id: 'LIST' }],
        }),

        getTest: builder.query<LabTest, string>({
            query: (id) => ({ url: `/tests/${id}` }),
            transformResponse: (r: ApiResponse<LabTest>) => r.data,
            providesTags: (_r, _e, id) => [{ type: 'Tests', id }],
        }),

        createTest: builder.mutation<LabTest, LabTestInput>({
            query: (body) => ({ url: '/tests', method: 'POST', body }),
            transformResponse: (r: ApiResponse<LabTest>) => r.data,
            invalidatesTags: [{ type: 'Tests', id: 'LIST' }],
        }),

        updateTest: builder.mutation<
            LabTest,
            { id: string; data: Partial<LabTestInput> }
        >({
            query: ({ id, data }) => ({
                url: `/tests/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (r: ApiResponse<LabTest>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Tests', id },
                { type: 'Tests', id: 'LIST' },
            ],
        }),

        deleteTest: builder.mutation<void, string>({
            query: (id) => ({ url: `/tests/${id}`, method: 'DELETE' }),
            invalidatesTags: [{ type: 'Tests', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetTestsQuery,
    useGetTestQuery,
    useCreateTestMutation,
    useUpdateTestMutation,
    useDeleteTestMutation,
} = testsApi;
