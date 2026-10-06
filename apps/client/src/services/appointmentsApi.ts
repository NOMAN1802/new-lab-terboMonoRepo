import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';
import type { Gender } from './patientsApi';

export type AppointmentStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

type DoctorRef = { _id: string; name: string; doctorCode: string; specialty: string };

export type Appointment = {
    _id: string;
    appointmentNumber: string;
    schedule: string;
    doctor: DoctorRef;
    patient: string;
    patientInfo: { patientId: string; name: string; age: number; gender: Gender; phone: string };
    slotIndex: number;
    serialNo: number;
    /** Midnight at the start of the Dhaka day. */
    date: string;
    startTime: string;
    endTime: string;
    fee: number;
    invoiceNumber?: string;
    /** The invoice billing the fee, with just the figures the desk needs. */
    invoice?: {
        _id: string;
        invoiceNumber: string;
        paymentStatus: 'unpaid' | 'partial' | 'paid';
        netPayable: number;
        paidAmount: number;
        dueAmount: number;
        isCancelled?: boolean;
    };
    /** Only on the response to a booking: the booking stood but taking money failed. */
    paymentWarning?: string;
    status: AppointmentStatus;
    /** Set when the doctor or a schedule change cancelled it: the desk must tell the patient. */
    callback?: {
        reason: string;
        requestedAt: string;
        doneAt?: string;
        doneByName?: string;
    };
    /** The desk asked for this to be cancelled; an admin answers. */
    cancellation?: {
        status: 'pending' | 'approved' | 'rejected';
        reason: string;
        requestedByName: string;
        requestedAt: string;
        reviewedByName?: string;
        reviewedAt?: string;
        reviewNote?: string;
        /** Set once the person who asked has acknowledged the answer. */
        requesterSeenAt?: string;
    };
    notes?: string;
    cancelReason?: string;
    checkedInAt?: string;
    completedAt?: string;
    createdAt: string;
};

export type AppointmentQuery = ListQuery & {
    status?: AppointmentStatus;
    /** Appointments with a cancellation request in this state. */
    cancelRequest?: 'pending' | 'rejected';
    /** Answers to the logged-in user own requests they have not acknowledged. */
    cancelOutcome?: 'unseen';
    /** Cancelled by the doctor or a schedule change, patient not yet told. */
    callback?: 'pending';
    doctor?: string;
    patient?: string;
};

export type SlotState = 'free' | 'taken' | 'past' | 'blocked';

export type AvailabilitySlot = {
    slotIndex: number;
    serialNo: number;
    startTime: string;
    endTime: string;
    state: SlotState;
};

export type ScheduleAvailability = {
    schedule: {
        _id: string;
        doctor: DoctorRef;
        date: string;
        startTime: string;
        endTime: string;
        slotMinutes: number;
        fee: number;
    };
    freeCount: number;
    slots: AvailabilitySlot[];
};

export type BookingInput = {
    schedule: string;
    slotIndex: number;
    patient: string;
    notes?: string;
    /** Take the whole fee at the desk. */
    collectFullPayment?: boolean;
    /** Or take part of it, leaving the rest due. */
    advanceAmount?: number;
};

const listTags = [{ type: 'Appointments' as const, id: 'LIST' }];

// Anything that moves a patient through the day changes the dashboards.
const workTags = [...listTags, { type: 'Dashboard' as const }];

// Booking and cancelling both create, cancel or settle an invoice.
const billingTags = [
    ...listTags,
    { type: 'Invoices' as const, id: 'LIST' },
    { type: 'Dashboard' as const },
    { type: 'Reports' as const },
];

export const appointmentsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getAvailability: builder.query<ScheduleAvailability[], { date: string; doctor?: string }>({
            query: (params) => ({ url: '/appointments/availability', params: cleanParams(params) }),
            transformResponse: (r: ApiResponse<ScheduleAvailability[]>) => r.data,
            providesTags: listTags,
        }),

        getAppointments: builder.query<Paginated<Appointment>, AppointmentQuery | void>({
            query: (params) => ({
                url: '/appointments',
                params: cleanParams({
                    page: 1,
                    limit: 100,
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Appointment>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({ type: 'Appointments' as const, id: _id })),
                          ...listTags,
                      ]
                    : listTags,
        }),

        getAppointment: builder.query<Appointment, string>({
            query: (id) => ({ url: `/appointments/${id}` }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            providesTags: (_r, _e, id) => [{ type: 'Appointments', id }],
        }),

        createAppointment: builder.mutation<Appointment, BookingInput>({
            query: (body) => ({ url: '/appointments', method: 'POST', body }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: billingTags,
        }),

        checkInAppointment: builder.mutation<Appointment, string>({
            query: (id) => ({ url: `/appointments/${id}/check-in`, method: 'POST' }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: workTags,
        }),

        cancelAppointment: builder.mutation<Appointment, { id: string; reason: string; refund?: boolean }>({
            query: ({ id, reason, refund }) => ({
                url: `/appointments/${id}/cancel`,
                method: 'POST',
                body: { reason, refund },
            }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: billingTags,
        }),

        noShowAppointment: builder.mutation<Appointment, string>({
            query: (id) => ({ url: `/appointments/${id}/no-show`, method: 'POST' }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: workTags,
        }),

        completeAppointment: builder.mutation<Appointment, string>({
            query: (id) => ({ url: `/appointments/${id}/complete`, method: 'POST' }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: workTags,
        }),

        requestCancelAppointment: builder.mutation<Appointment, { id: string; reason: string }>({
            query: ({ id, reason }) => ({
                url: `/appointments/${id}/cancel-request`,
                method: 'POST',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: workTags,
        }),

        approveCancelAppointment: builder.mutation<Appointment, { id: string; note?: string; refund?: boolean }>({
            query: ({ id, note, refund }) => ({
                url: `/appointments/${id}/cancel-request/approve`,
                method: 'POST',
                body: { note, refund },
            }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: billingTags,
        }),

        markInformed: builder.mutation<{ informed: number }, { ids?: string[] } | void>({
            query: (arg) => ({
                url: '/appointments/callback/done',
                method: 'POST',
                body: { ids: arg?.ids },
            }),
            transformResponse: (r: ApiResponse<{ informed: number }>) => r.data,
            invalidatesTags: workTags,
        }),

        acknowledgeCancelOutcomes: builder.mutation<{ acknowledged: number }, { ids?: string[] } | void>({
            query: (arg) => ({
                url: '/appointments/cancel-request/ack',
                method: 'POST',
                body: { ids: arg?.ids },
            }),
            transformResponse: (r: ApiResponse<{ acknowledged: number }>) => r.data,
            invalidatesTags: listTags,
        }),

        rejectCancelAppointment: builder.mutation<Appointment, { id: string; note: string }>({
            query: ({ id, note }) => ({
                url: `/appointments/${id}/cancel-request/reject`,
                method: 'POST',
                body: { note },
            }),
            transformResponse: (r: ApiResponse<Appointment>) => r.data,
            invalidatesTags: workTags,
        }),
    }),
});

export const {
    useGetAvailabilityQuery,
    useGetAppointmentsQuery,
    useGetAppointmentQuery,
    useCreateAppointmentMutation,
    useCheckInAppointmentMutation,
    useCancelAppointmentMutation,
    useNoShowAppointmentMutation,
    useCompleteAppointmentMutation,
    useRequestCancelAppointmentMutation,
    useApproveCancelAppointmentMutation,
    useRejectCancelAppointmentMutation,
    useAcknowledgeCancelOutcomesMutation,
    useMarkInformedMutation,
} = appointmentsApi;
