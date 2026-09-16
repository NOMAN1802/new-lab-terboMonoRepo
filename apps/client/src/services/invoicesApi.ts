import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';
import type { Patient } from './patientsApi';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type CommissionType = 'percent' | 'fixed';
export type ReportStatus = 'pending' | 'uploaded' | 'delivered';

export type ReportFile = {
    url: string;
    publicId: string;
    resourceType: string;
    mimeType: string;
    originalName: string;
    size: number;
    uploadedAt: string;
};

export type InvoiceItem = {
    _id: string;
    test: string;
    testCode: string;
    testName: string;
    categoryName?: string;
    price: number;
    reportStatus: ReportStatus;
    reportFile?: ReportFile;
    deliveredAt?: string;

    /**
     * A test called off after booking. The line stays on the invoice, struck
     * through with its reason, and drops out of the totals.
     */
    isCancelled?: boolean;
    cancelledAt?: string;
    cancelReason?: string;
};

/**
 * Per-invoice figures come through in full for both roles — the commission
 * line prints on the invoice. commission* stays optional because a walk-in
 * with no referrer accrues none; render it only when present rather than
 * falling back to 0.
 */
export type Invoice = {
    _id: string;
    invoiceNumber: string;
    visitDate: string;

    patient: string | Patient;
    patientInfo: {
        patientId: string;
        name: string;
        age: number;
        gender: string;
        phone: string;
        address?: string;
    };

    referrer?: string;
    referrerInfo?: {
        referrerCode: string;
        name: string;
        designation?: string;
        hospital?: string;
    };

    items: InvoiceItem[];

    grossAmount: number;
    discountPercent: number;
    discountAmount: number;
    netPayable: number;

    paidAmount: number;
    dueAmount: number;
    paymentStatus: PaymentStatus;

    commissionType?: CommissionType;
    commissionValue?: number;
    commissionAmount?: number;
    commissionStatus?: 'pending' | 'paid';

    notes?: string;
    createdBy?: { _id: string; name: string; email: string } | string;
    isCancelled?: boolean;
    cancelReason?: string;
    /** Encoded into the QR on the printed invoice. Absent on list payloads. */
    publicToken?: string;
    createdAt: string;
};

export type CreateInvoiceInput = {
    patient: string;
    referrer?: string;
    testIds: string[];
    visitDate?: string;
    /** Omit to take the referrer's default. Admin-only override. */
    discountPercent?: number;
    notes?: string;
    /** Take the whole net payable as cash immediately, issuing a receipt. */
    collectFullPayment?: boolean;
    /**
     * Take part of it instead, leaving the rest due for the patient to settle
     * over as many later payments as they need. Ignored when collectFullPayment
     * is set, and clamped server-side to what is actually owed.
     */
    advanceAmount?: number;
};

export type PatientHistory = {
    patient: Patient;
    invoices: Invoice[];
};

export const invoicesApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getInvoices: builder.query<
            Paginated<Invoice>,
            (ListQuery & { paymentStatus?: PaymentStatus }) | void
        >({
            query: (params) => ({
                url: '/invoices',
                params: cleanParams({
                    page: 1,
                    limit: 20,
                    sortBy: '-visitDate',
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Invoice>,
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ _id }) => ({
                              type: 'Invoices' as const,
                              id: _id,
                          })),
                          { type: 'Invoices' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Invoices', id: 'LIST' }],
        }),

        getInvoice: builder.query<Invoice, string>({
            query: (id) => ({ url: `/invoices/${id}` }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            providesTags: (_r, _e, id) => [{ type: 'Invoices', id }],
        }),

        getPatientHistory: builder.query<PatientHistory, string>({
            query: (patientId) => ({ url: `/invoices/patient/${patientId}` }),
            transformResponse: (r: ApiResponse<PatientHistory>) => r.data,
            providesTags: (_r, _e, patientId) => [
                { type: 'Invoices', id: `PATIENT-${patientId}` },
            ],
        }),

        createInvoice: builder.mutation<Invoice, CreateInvoiceInput>({
            query: (body) => ({ url: '/invoices', method: 'POST', body }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            // Booking can issue a receipt too, so the payment list is stale.
            invalidatesTags: [
                { type: 'Invoices', id: 'LIST' },
                { type: 'Payments', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        updateInvoiceItems: builder.mutation<
            Invoice,
            {
                id: string;
                testIds: string[];
                discountPercent?: number;
                commissionType?: CommissionType;
                commissionValue?: number;
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/invoices/${id}/items`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Invoices', id },
                { type: 'Invoices', id: 'LIST' },
            ],
        }),

        cancelInvoice: builder.mutation<Invoice, { id: string; reason: string }>({
            query: ({ id, reason }) => ({
                url: `/invoices/${id}/cancel`,
                method: 'PATCH',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            invalidatesTags: (_r, _e, { id }) => [
                { type: 'Invoices', id },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        uploadReport: builder.mutation<
            Invoice,
            { invoiceId: string; itemId: string; file: File }
        >({
            query: ({ invoiceId, itemId, file }) => {
                const formData = new FormData();
                formData.append('report', file);
                return {
                    url: `/invoices/${invoiceId}/items/${itemId}/report`,
                    method: 'POST',
                    body: formData,
                };
            },
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            invalidatesTags: (_r, _e, { invoiceId }) => [
                { type: 'Invoices', id: invoiceId },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        /** Calls off one test. Both roles; the reason lands in the activity log. */
        cancelInvoiceItem: builder.mutation<
            Invoice,
            { invoiceId: string; itemId: string; reason: string }
        >({
            query: ({ invoiceId, itemId, reason }) => ({
                url: `/invoices/${invoiceId}/items/${itemId}/cancel`,
                method: 'PATCH',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            invalidatesTags: (_r, _e, { invoiceId }) => [
                { type: 'Invoices', id: invoiceId },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        markReportDelivered: builder.mutation<
            Invoice,
            { invoiceId: string; itemId: string }
        >({
            query: ({ invoiceId, itemId }) => ({
                url: `/invoices/${invoiceId}/items/${itemId}/deliver`,
                method: 'PATCH',
            }),
            transformResponse: (r: ApiResponse<Invoice>) => r.data,
            invalidatesTags: (_r, _e, { invoiceId }) => [
                { type: 'Invoices', id: invoiceId },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        // Signed links are short-lived, so fetch on demand rather than caching.
        getReportLink: builder.mutation<
            { url: string; originalName: string },
            { invoiceId: string; itemId: string }
        >({
            query: ({ invoiceId, itemId }) => ({
                url: `/invoices/${invoiceId}/items/${itemId}/report`,
            }),
            transformResponse: (
                r: ApiResponse<{ url: string; originalName: string }>
            ) => r.data,
        }),

        /**
         * The report's bytes, streamed through our own API so the blob carries
         * the type and filename recorded at upload. Handed back as a Blob
         * rather than a URL: opening a storage link after an await trips the
         * browser's popup blocker, and a same-origin blob does not.
         */
        getReportFile: builder.mutation<Blob, { invoiceId: string; itemId: string }>({
            query: ({ invoiceId, itemId }) => ({
                url: `/invoices/${invoiceId}/items/${itemId}/report/file`,
                // Only a success is a file. A failure is our usual JSON error
                // envelope, and blobbing that would bury the message.
                responseHandler: (response: Response) =>
                    response.ok ? response.blob() : response.json(),
            }),
        }),
    }),
});

export const {
    useGetInvoicesQuery,
    useGetInvoiceQuery,
    useGetPatientHistoryQuery,
    useCreateInvoiceMutation,
    useUpdateInvoiceItemsMutation,
    useCancelInvoiceMutation,
    useCancelInvoiceItemMutation,
    useUploadReportMutation,
    useMarkReportDeliveredMutation,
    useGetReportLinkMutation,
    useGetReportFileMutation,
} = invoicesApi;
