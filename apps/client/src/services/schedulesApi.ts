import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';

export type ScheduleStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export type Schedule = {
    _id: string;
    doctor: { _id: string; name: string; doctorCode: string; specialty: string };
    /** Midnight at the start of the Dhaka day. */
    date: string;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    fee: number;
    status: ScheduleStatus;
    declineReason?: string;
    cancelReason?: string;
    slotCount: number;
    /** On a schedule list: how many of its slots are taken (a cancelled booking frees its slot). */
    bookedCount?: number;
    /** Slots the doctor has taken out of the schedule. */
    blockedCount?: number;
    blockedSlots?: { slotIndex: number; reason: string; blockedByName: string }[];
    createdAt: string;
    /** Only on the response to a cancel or a block: bookings that were released. */
    cancelledAppointments?: {
        _id: string;
        appointmentNumber: string;
        serialNo: number;
        startTime: string;
        patientName: string;
        patientPhone: string;
        invoiceNumber?: string;
        /** Money already taken that has to be refunded by hand; 0 when nothing was paid. */
        refundDue: number;
    }[];
};

export type ScheduleSlotState = 'free' | 'booked' | 'blocked' | 'past';

export type ScheduleSlot = {
    slotIndex: number;
    serialNo: number;
    startTime: string;
    endTime: string;
    state: ScheduleSlotState;
    appointment?: {
        _id: string;
        appointmentNumber: string;
        status: string;
        patientName: string;
        patientAge: number;
        patientGender: string;
    };
    blocked?: { reason: string; blockedByName: string };
};

export type ScheduleChange = {
    date?: string;
    startTime?: string;
    endTime?: string;
    slotMinutes?: number;
    /** Admin only: a doctor cannot change their own fee. */
    fee?: number;
};

export type ScheduleQuery = ListQuery & {
    status?: ScheduleStatus;
    doctor?: string;
};

export type ScheduleInput = {
    doctor: string;
    /** YYYY-MM-DD */
    date: string;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    fee?: number;
};

export const schedulesApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getSchedules: builder.query<Paginated<Schedule>, ScheduleQuery | void>({
            query: (params) => ({
                url: '/schedules',
                params: cleanParams({ page: 1, limit: 100, ...(params ?? {}), search: undefined }),
            }),
            transformResponse: toPaginated<Schedule>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({ type: 'Schedules' as const, id: _id })),
                          { type: 'Schedules' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Schedules', id: 'LIST' }],
        }),

        createSchedule: builder.mutation<Schedule, ScheduleInput>({
            query: (body) => ({ url: '/schedules', method: 'POST', body }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: [{ type: 'Schedules', id: 'LIST' }, { type: 'Dashboard' }],
        }),

        approveSchedule: builder.mutation<Schedule, string>({
            query: (id) => ({ url: `/schedules/${id}/approve`, method: 'POST' }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: [{ type: 'Schedules', id: 'LIST' }, { type: 'Dashboard' }],
        }),

        declineSchedule: builder.mutation<Schedule, { id: string; reason: string }>({
            query: ({ id, reason }) => ({
                url: `/schedules/${id}/decline`,
                method: 'POST',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: [{ type: 'Schedules', id: 'LIST' }, { type: 'Dashboard' }],
        }),

        getScheduleSlots: builder.query<{ schedule: Schedule; slots: ScheduleSlot[] }, string>({
            query: (id) => ({ url: `/schedules/${id}/slots` }),
            transformResponse: (r: ApiResponse<{ schedule: Schedule; slots: ScheduleSlot[] }>) => r.data,
            // A booking or a cancellation elsewhere changes who is in each slot.
            providesTags: (_r, _e, id) => [
                { type: 'Schedules', id: `SLOTS-${id}` },
                { type: 'Appointments', id: 'LIST' },
            ],
        }),

        updateSchedule: builder.mutation<Schedule, { id: string; data: ScheduleChange }>({
            query: ({ id, data }) => ({ url: `/schedules/${id}`, method: 'PATCH', body: data }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Schedules', id: 'LIST' },
                { type: 'Schedules', id: `SLOTS-${id}` },
                { type: 'Dashboard' },
            ],
        }),

        blockSlot: builder.mutation<Schedule, { id: string; slotIndex: number; reason: string }>({
            query: ({ id, slotIndex, reason }) => ({
                url: `/schedules/${id}/slots/${slotIndex}/block`,
                method: 'POST',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Schedules', id: 'LIST' },
                { type: 'Schedules', id: `SLOTS-${id}` },
                { type: 'Appointments', id: 'LIST' },
                { type: 'Dashboard' },
            ],
        }),

        unblockSlot: builder.mutation<Schedule, { id: string; slotIndex: number }>({
            query: ({ id, slotIndex }) => ({
                url: `/schedules/${id}/slots/${slotIndex}/block`,
                method: 'DELETE',
            }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Schedules', id: 'LIST' },
                { type: 'Schedules', id: `SLOTS-${id}` },
                { type: 'Dashboard' },
            ],
        }),

        cancelSchedule: builder.mutation<Schedule, { id: string; reason?: string }>({
            query: ({ id, reason }) => ({
                url: `/schedules/${id}/cancel`,
                method: 'POST',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Schedule>) => r.data,
            invalidatesTags: [{ type: 'Schedules', id: 'LIST' }, { type: 'Appointments', id: 'LIST' }, { type: 'Dashboard' }],
        }),
    }),
});

export const {
    useGetSchedulesQuery,
    useCreateScheduleMutation,
    useApproveScheduleMutation,
    useDeclineScheduleMutation,
    useCancelScheduleMutation,
    useGetScheduleSlotsQuery,
    useUpdateScheduleMutation,
    useBlockSlotMutation,
    useUnblockSlotMutation,
} = schedulesApi;
