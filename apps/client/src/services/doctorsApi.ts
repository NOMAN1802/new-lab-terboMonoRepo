import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type Doctor = {
    _id: string;
    doctorCode: string;
    name: string;
    specialty: string;
    degrees?: string;
    phone: string;
    consultationFee: number;
    isActive: boolean;
    /** Only sent to admins. */
    user?: { email: string; status: string };
    createdAt: string;
};

export type DoctorInput = {
    name: string;
    specialty: string;
    degrees?: string;
    phone: string;
    consultationFee: number;
};

export type DoctorCreateInput = DoctorInput & { email: string; password: string };

export type DoctorUpdateInput = Partial<DoctorInput> & {
    isActive?: boolean;
    password?: string;
};

export const doctorsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDoctors: builder.query<Paginated<Doctor>, ListQuery | void>({
            query: (params) => ({
                url: '/doctors',
                params: cleanParams({
                    page: 1,
                    limit: 200,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Doctor>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({ type: 'Doctors' as const, id: _id })),
                          { type: 'Doctors' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Doctors', id: 'LIST' }],
        }),

        createDoctor: builder.mutation<Doctor, DoctorCreateInput>({
            query: (body) => ({ url: '/doctors', method: 'POST', body }),
            transformResponse: (r: ApiResponse<Doctor>) => r.data,
            invalidatesTags: [{ type: 'Doctors', id: 'LIST' }],
        }),

        updateDoctor: builder.mutation<Doctor, { id: string; data: DoctorUpdateInput }>({
            query: ({ id, data }) => ({ url: `/doctors/${id}`, method: 'PATCH', body: data }),
            transformResponse: (r: ApiResponse<Doctor>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Doctors', id },
                { type: 'Doctors', id: 'LIST' },
            ],
        }),

        deleteDoctor: builder.mutation<void, string>({
            query: (id) => ({ url: `/doctors/${id}`, method: 'DELETE' }),
            invalidatesTags: [{ type: 'Doctors', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetDoctorsQuery,
    useCreateDoctorMutation,
    useUpdateDoctorMutation,
    useDeleteDoctorMutation,
} = doctorsApi;
