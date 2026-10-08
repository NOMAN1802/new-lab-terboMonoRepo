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
    /** The doctor's own entry on the Referrers list. */
    referrer?: string;
    /** What the doctor earns from each appointment fee. */
    appointmentShareType?: 'percent' | 'fixed';
    appointmentShareValue?: number;
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
    appointmentShareType?: 'percent' | 'fixed';
    appointmentShareValue?: number;
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
            // The doctor's Referrers entry follows their name and phone.
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Doctors', id },
                { type: 'Doctors', id: 'LIST' },
                { type: 'Referrers', id: 'LIST' },
            ],
        }),

        // Puts the doctor's current share on past appointments not yet paid out.
        applyShareToPast: builder.mutation<{ appointments: number; updated: number; total: number }, string>({
            query: (id) => ({ url: `/doctors/${id}/apply-share`, method: 'POST' }),
            transformResponse: (r: ApiResponse<{ appointments: number; updated: number; total: number }>) => r.data,
            invalidatesTags: [
                { type: 'Appointments', id: 'LIST' },
                { type: 'CommissionPayouts' },
                { type: 'Reports' },
            ],
        }),

        deleteDoctor: builder.mutation<void, string>({
            query: (id) => ({ url: `/doctors/${id}`, method: 'DELETE' }),
            invalidatesTags: [{ type: 'Doctors', id: 'LIST' }, { type: 'Referrers', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetDoctorsQuery,
    useCreateDoctorMutation,
    useUpdateDoctorMutation,
    useDeleteDoctorMutation,
    useApplyShareToPastMutation,
} = doctorsApi;
