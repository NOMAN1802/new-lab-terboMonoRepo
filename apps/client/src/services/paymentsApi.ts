import { baseApi } from './baseApi';
import { cleanParams, toPaginated } from './types';
import type { ApiResponse, ListQuery, Paginated } from './types';
import type { Invoice } from './invoicesApi';

export type Payment = {
    _id: string;
    receiptNumber: string;
    invoice: string;
    invoiceNumber: string;
    patient: string;
    patientName: string;
    amount: number;
    method: 'cash';
    paymentDate: string;
    receivedBy: { _id: string; name: string; email: string } | string;
    receivedByName: string;
    note?: string;
    isVoided: boolean;
    voidedAt?: string;
    voidReason?: string;
    createdAt: string;
};

export type CreatePaymentInput = {
    invoice: string;
    amount: number;
    paymentDate?: string;
    note?: string;
};

/** Both mutations return the payment plus the invoice with re-derived totals. */
type PaymentResult = { payment: Payment; invoice: Invoice };

export const paymentsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPayments: builder.query<Paginated<Payment>, ListQuery | void>({
            query: (params) => ({
                url: '/payments',
                params: cleanParams({
                    page: 1,
                    limit: 20,
                    sortBy: '-paymentDate',
                    ...(params ?? {}),
                    searchTerm: params?.search,
                    search: undefined,
                }),
            }),
            transformResponse: toPaginated<Payment>,
            providesTags: [{ type: 'Payments', id: 'LIST' }],
        }),

        getInvoicePayments: builder.query<Payment[], string>({
            query: (invoiceId) => ({ url: `/payments/invoice/${invoiceId}` }),
            transformResponse: (r: ApiResponse<Payment[]>) => r.data,
            providesTags: (_r, _e, invoiceId) => [
                { type: 'Payments', id: `INVOICE-${invoiceId}` },
            ],
        }),

        createPayment: builder.mutation<PaymentResult, CreatePaymentInput>({
            query: (body) => ({ url: '/payments', method: 'POST', body }),
            transformResponse: (r: ApiResponse<PaymentResult>) => r.data,
            invalidatesTags: (_r, _e, { invoice }) => [
                { type: 'Payments', id: 'LIST' },
                { type: 'Payments', id: `INVOICE-${invoice}` },
                { type: 'Invoices', id: invoice },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),

        voidPayment: builder.mutation<
            PaymentResult,
            { id: string; reason: string; invoiceId: string }
        >({
            query: ({ id, reason }) => ({
                url: `/payments/${id}/void`,
                method: 'PATCH',
                body: { reason },
            }),
            transformResponse: (r: ApiResponse<PaymentResult>) => r.data,
            invalidatesTags: (_r, _e, { invoiceId }) => [
                { type: 'Payments', id: 'LIST' },
                { type: 'Payments', id: `INVOICE-${invoiceId}` },
                { type: 'Invoices', id: invoiceId },
                { type: 'Invoices', id: 'LIST' },
                { type: 'Dashboard', id: 'ALL' },
                { type: 'Reports' },
            ],
        }),
    }),
});

export const {
    useGetPaymentsQuery,
    useGetInvoicePaymentsQuery,
    useCreatePaymentMutation,
    useVoidPaymentMutation,
} = paymentsApi;
