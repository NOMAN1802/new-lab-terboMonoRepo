import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type Gender = 'male' | 'female' | 'other';

export type Patient = {
    _id: string;
    patientId: string;
    name: string;
    age: number;
    gender: Gender;
    phone: string;
    address?: string;
    createdAt: string;
    updatedAt: string;
};

export type PatientInput = {
    name: string;
    age: number;
    gender: Gender;
    phone: string;
    address?: string;
};

export const patientsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPatients: builder.query<Paginated<Patient>, ListQuery | void>({
            query: (params) => ({
                url: '/patients',
                params: cleanParams({
                    page: 1,
                    limit: 20,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Patient>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({
                              type: 'Patients' as const,
                              id: _id,
                          })),
                          { type: 'Patients' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Patients', id: 'LIST' }],
        }),

        getPatient: builder.query<Patient, string>({
            query: (id) => ({ url: `/patients/${id}` }),
            transformResponse: (response: ApiResponse<Patient>) => response.data,
            providesTags: (_r, _e, id) => [{ type: 'Patients', id }],
        }),

        createPatient: builder.mutation<Patient, PatientInput>({
            query: (body) => ({ url: '/patients', method: 'POST', body }),
            transformResponse: (response: ApiResponse<Patient>) => response.data,
            invalidatesTags: [{ type: 'Patients', id: 'LIST' }],
        }),

        updatePatient: builder.mutation<
            Patient,
            { id: string; data: Partial<PatientInput> }
        >({
            query: ({ id, data }) => ({
                url: `/patients/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Patient>) => response.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Patients', id },
                { type: 'Patients', id: 'LIST' },
            ],
        }),

        deletePatient: builder.mutation<void, string>({
            query: (id) => ({ url: `/patients/${id}`, method: 'DELETE' }),
            invalidatesTags: [{ type: 'Patients', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetPatientsQuery,
    useGetPatientQuery,
    useCreatePatientMutation,
    useUpdatePatientMutation,
    useDeletePatientMutation,
} = patientsApi;
