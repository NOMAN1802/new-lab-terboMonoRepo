import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type ActivityEntry = {
    _id: string;
    actor: string;
    actorName: string;
    actorRole: string;
    action: string;
    entity: string;
    entityId?: string;
    entityLabel?: string;
    summary: string;
    meta?: Record<string, unknown>;
    at: string;
};

export type ActivityByUserRow = {
    _id: string;
    name: string;
    role: string;
    events: number;
    lastSeen: string;
};

export const activityApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getActivity: builder.query<
            Paginated<ActivityEntry>,
            (ListQuery & { action?: string }) | void
        >({
            query: (params) => ({
                url: '/activity',
                params: cleanParams({
                    page: 1,
                    limit: 30,
                    sortBy: '-at',
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<ActivityEntry>,
            providesTags: [{ type: 'Activity', id: 'LIST' }],
        }),

        getActivityByUser: builder.query<ActivityByUserRow[], ListQuery | void>({
            query: (params) => ({
                url: '/activity/by-user',
                params: cleanParams({ ...(params ?? {}) }),
            }),
            transformResponse: (r: ApiResponse<ActivityByUserRow[]>) => r.data,
            providesTags: [{ type: 'Activity', id: 'BY_USER' }],
        }),
    }),
});

export const { useGetActivityQuery, useGetActivityByUserQuery } = activityApi;
