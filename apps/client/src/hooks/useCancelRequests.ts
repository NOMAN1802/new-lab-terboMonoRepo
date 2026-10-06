import { useRole } from '@/hooks/useRole';
import { useGetAppointmentsQuery } from '@/services/appointmentsApi';

/**
 * Cancellation requests waiting for an admin, behind the sidebar count and the
 * topbar bell. Both read the same query, so they cost one request and always
 * agree. Only an admin answers requests, so everyone else skips the call.
 *
 * Polled because the request is raised on another person's screen: without it
 * an admin would only find out by reloading.
 */
export const useCancelRequests = () => {
    const { isAdmin } = useRole();
    const { data } = useGetAppointmentsQuery(
        { cancelRequest: 'pending', limit: 5, sortBy: 'date slotStart' },
        { skip: !isAdmin, pollingInterval: 60000 }
    );

    return {
        requests: data?.items ?? [],
        total: data?.meta.total ?? 0,
    };
};

export default useCancelRequests;
