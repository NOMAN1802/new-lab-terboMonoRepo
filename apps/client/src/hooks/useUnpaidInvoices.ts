import { useRole } from '@/hooks/useRole';
import { useGetInvoicesQuery } from '@/services/invoicesApi';

/**
 * The unpaid invoices behind the topbar bell and the sidebar's Billing count.
 * One query, shared through RTK Query's cache, so both read the same figure.
 */
export const useUnpaidInvoices = (limit = 5) => {
    // A doctor has no access to invoices; asking would earn a 401 and a forced token refresh.
    const { isDoctor } = useRole();
    const { data, isLoading } = useGetInvoicesQuery(
        { paymentStatus: 'unpaid', limit, sortBy: '-visitDate' },
        { skip: isDoctor }
    );

    return {
        invoices: data?.items ?? [],
        total: data?.meta.total ?? 0,
        isLoading,
    };
};

export default useUnpaidInvoices;
