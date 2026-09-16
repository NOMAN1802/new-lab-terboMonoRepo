import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type TestCategory = {
    _id: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
};

export type TestCategoryInput = {
    name: string;
    description?: string;
    isActive?: boolean;
};

export const testCategoriesApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getTestCategories: builder.query<Paginated<TestCategory>, ListQuery | void>({
            query: (params) => ({
                url: '/test-categories',
                params: cleanParams({
                    page: 1,
                    limit: 100,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<TestCategory>,
            providesTags: [{ type: 'TestCategories', id: 'LIST' }],
        }),

        createTestCategory: builder.mutation<TestCategory, TestCategoryInput>({
            query: (body) => ({ url: '/test-categories', method: 'POST', body }),
            transformResponse: (r: ApiResponse<TestCategory>) => r.data,
            invalidatesTags: [{ type: 'TestCategories', id: 'LIST' }],
        }),

        updateTestCategory: builder.mutation<
            TestCategory,
            { id: string; data: Partial<TestCategoryInput> }
        >({
            query: ({ id, data }) => ({
                url: `/test-categories/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (r: ApiResponse<TestCategory>) => r.data,
            invalidatesTags: [{ type: 'TestCategories', id: 'LIST' }],
        }),

        deleteTestCategory: builder.mutation<void, string>({
            query: (id) => ({ url: `/test-categories/${id}`, method: 'DELETE' }),
            invalidatesTags: [
                { type: 'TestCategories', id: 'LIST' },
                { type: 'Tests', id: 'LIST' },
            ],
        }),
    }),
});

export const {
    useGetTestCategoriesQuery,
    useCreateTestCategoryMutation,
    useUpdateTestCategoryMutation,
    useDeleteTestCategoryMutation,
} = testCategoriesApi;
