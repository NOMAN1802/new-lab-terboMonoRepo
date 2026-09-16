import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/app/store';
import { logout, setCredentials } from '@/features/auth/authSlice';
import { API_BASE_URL } from '@/lib/apiBase';


const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
        const token = (getState() as RootState).auth.accessToken;
        if (token) {
            headers.set('authorization', `Bearer ${token}`);
        }
        return headers;
    },
});

const baseQueryWithReauth: typeof rawBaseQuery = async (
    args,
    api,
    extraOptions
) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error && result.error.status === 401) {
        const refreshToken = (api.getState() as RootState).auth.refreshToken;

        if (!refreshToken) {
            api.dispatch(logout());
            return result;
        }

        const refreshResult = await rawBaseQuery(
            {
                url: '/auth/refresh-token',
                method: 'POST',
                body: { refreshToken },
            },
            api,
            extraOptions
        );

        if (refreshResult.data) {
            api.dispatch(
                setCredentials(refreshResult.data as { accessToken: string })
            );
            result = await rawBaseQuery(args, api, extraOptions);
        } else {
            api.dispatch(logout());
        }
    }

    return result;
};

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithReauth,
    tagTypes: [
        'Patients',
        'Tests',
        'TestCategories',
        'Referrers',
        'Invoices',
        'Payments',
        'CommissionPayouts',
        'Dashboard',
        'Reports',
        'Activity',
        'User',
    ],
    endpoints: () => ({}),
});
