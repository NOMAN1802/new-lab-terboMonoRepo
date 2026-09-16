import { baseApi } from './baseApi';
import type { UserRole } from '@/lib/token';
import type { ApiResponse } from './types';

export type User = {
    _id: string;
    name: string;
    email: string;
    mobileNumber: string;
    role: UserRole;
    status: 'active' | 'inactive';
    createdAt?: string;
    updatedAt?: string;
};

export type UpdateUserInput = {
    name?: string;
    email?: string;
    mobileNumber?: string;
    password?: string;
};

export type CreateUserInput = {
    name: string;
    email: string;
    mobileNumber: string;
    password: string;
    role: UserRole;
    status?: 'active' | 'inactive';
};

export type UsersListResponse = {
    users: User[];
    total: number;
    page: number;
    limit: number;
};

export const userApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getCurrentUser: builder.query<User, void>({
            query: () => ({
                url: '/users/me',
            }),
            transformResponse: (response: ApiResponse<User>) => response.data,
            providesTags: [{ type: 'User', id: 'CURRENT' }],
        }),
        updateCurrentUser: builder.mutation<User, UpdateUserInput>({
            query: (data) => ({
                url: '/users/me',
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<User>) => response.data,
            invalidatesTags: [{ type: 'User', id: 'CURRENT' }],
        }),
        getUsers: builder.query<UsersListResponse, { page?: number; search?: string; limit?: number }>({
            query: ({ page = 1, search, limit = 30 } = {}) => ({
                url: '/users',
                params: {
                    page,
                    limit,
                    search,
                },
            }),
            transformResponse: (response: ApiResponse<UsersListResponse>) => response.data,
            providesTags: (result) =>
                result
                    ? [
                        ...result.users.map(({ _id }) => ({ type: 'User' as const, id: _id })),
                        { type: 'User' as const, id: 'LIST' },
                    ]
                    : [{ type: 'User', id: 'LIST' }],
        }),
        createUser: builder.mutation<User, CreateUserInput>({
            query: (data) => ({
                url: '/users/create-user',
                method: 'POST',
                body: data,
            }),
            transformResponse: (response: ApiResponse<User>) => response.data,
            invalidatesTags: [{ type: 'User', id: 'LIST' }],
        }),
        updateUser: builder.mutation<User, { id: string; data: Partial<UpdateUserInput & { role?: string; status?: string }> }>({
            query: ({ id, data }) => ({
                url: `/users/update-user/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<User>) => response.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'User', id },
                { type: 'User', id: 'LIST' },
            ],
        }),
        deleteUser: builder.mutation<void, string>({
            query: (id) => ({
                url: `/users/delete-user/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'User', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetCurrentUserQuery,
    useUpdateCurrentUserMutation,
    useGetUsersQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} = userApi;

