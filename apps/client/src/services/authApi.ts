import { baseApi } from './baseApi';
import { setCredentials } from '@/features/auth/authSlice';
import type { ApiResponse } from './types';

export type LoginPayload = {
    email: string;
    password: string;
};

export type LoginResponse = {
    accessToken: string;
    refreshToken: string;
};

/**
 * There is no self-registration. Accounts are created by an Admin under
 * Users, and the first Admin is seeded on the server from the environment.
 */
export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation<LoginResponse, LoginPayload>({
            query: (body) => ({
                url: '/auth/login',
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiResponse<LoginResponse>) => response.data,
            async onQueryStarted(_, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(setCredentials({ ...data }));
                } catch (error) {
                    console.error(error);
                }
            },
        }),
        refreshToken: builder.mutation<{ accessToken: string }, { refreshToken: string }>({
            query: (body) => ({
                url: '/auth/refresh-token',
                method: 'POST',
                body,
            }),
            transformResponse: (response: ApiResponse<{ accessToken: string }>) => response.data,
            async onQueryStarted(_, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(setCredentials({ ...data }));
                } catch (error) {
                    console.error(error);
                }
            },
        }),
    }),
});

export const { useLoginMutation, useRefreshTokenMutation } = authApi;

