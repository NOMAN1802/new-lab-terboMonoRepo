import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, Paginated } from './types';
import type { Gender } from './patientsApi';

export type Medicine = {
    name: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    instruction?: string;
};

export type Prescription = {
    _id: string;
    prescriptionNumber: string;
    appointment: string;
    patientInfo: { patientId: string; name: string; age: number; gender: Gender; phone: string };
    doctorInfo: { doctorCode: string; name: string; specialty: string; degrees?: string };
    /** Midnight at the start of the Dhaka visit day. */
    visitDate: string;
    complaints?: string;
    diagnosis?: string;
    medicines: Medicine[];
    investigations: string[];
    advice?: string;
    followUpDate?: string;
    createdAt: string;
    updatedAt: string;
};

export type PrescriptionInput = {
    complaints?: string;
    diagnosis?: string;
    medicines: Medicine[];
    investigations: string[];
    advice?: string;
    /** YYYY-MM-DD. Blank or null clears it. */
    followUpDate?: string | null;
};

export const prescriptionsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // A visit with nothing written yet answers null, not an error.
        getPrescriptionByAppointment: builder.query<Prescription | null, string>({
            query: (appointmentId) => ({ url: `/prescriptions/appointment/${appointmentId}` }),
            transformResponse: (r: ApiResponse<Prescription | null>) => r.data,
            providesTags: (_r, _e, appointmentId) => [{ type: 'Prescriptions', id: appointmentId }],
        }),

        getPatientPrescriptions: builder.query<Paginated<Prescription>, string>({
            query: (patient) => ({ url: '/prescriptions', params: cleanParams({ patient, limit: 50 }) }),
            transformResponse: toPaginated<Prescription>,
            providesTags: [{ type: 'Prescriptions', id: 'LIST' }],
        }),

        savePrescription: builder.mutation<Prescription, { appointmentId: string } & PrescriptionInput>({
            query: ({ appointmentId, ...body }) => ({
                url: `/prescriptions/appointment/${appointmentId}`,
                method: 'PUT',
                body,
            }),
            transformResponse: (r: ApiResponse<Prescription>) => r.data,
            invalidatesTags: (_r, _e, { appointmentId }) => [
                { type: 'Prescriptions', id: appointmentId },
                { type: 'Prescriptions', id: 'LIST' },
                { type: 'Appointments', id: 'LIST' },
                { type: 'Appointments', id: appointmentId },
            ],
        }),
    }),
});

export const { useGetPrescriptionByAppointmentQuery, useGetPatientPrescriptionsQuery, useSavePrescriptionMutation } =
    prescriptionsApi;
