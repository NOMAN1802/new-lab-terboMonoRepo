import { useGetInvoicesQuery } from '@/services/invoicesApi';

/**
 * The unpaid invoices behind the topbar bell and the sidebar's Billing count.
 * One query, shared through RTK Query's cache, so both read the same figure.
 */
export const useUnpaidInvoices = (limit = 5) => {
    const { data, isLoading } = useGetInvoicesQuery({ paymentStatus: 'unpaid', limit, sortBy: '-visitDate' });

    return {
        invoices: data?.items ?? [],
        total: data?.meta.total ?? 0,
        isLoading,
    };
};

export default useUnpaidInvoices;
