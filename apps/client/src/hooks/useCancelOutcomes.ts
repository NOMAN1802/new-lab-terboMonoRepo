import { useRole } from '@/hooks/useRole';
import { useGetAppointmentsQuery } from '@/services/appointmentsApi';

/**
 * Answers to the cancellation requests this person raised that they have not
 * looked at yet, behind the bell and the sidebar count. The server scopes the
 * list to whoever is logged in, so a receptionist only ever sees the outcomes
 * of their own requests. Admins do not raise requests, so they skip the call.
 *
 * Polled because the answer is given on an admin screen elsewhere.
 */
export const useCancelOutcomes = () => {
    const { isReceptionist } = useRole();
    const { data } = useGetAppointmentsQuery(
        { cancelOutcome: 'unseen', limit: 5, sortBy: '-updatedAt' },
        { skip: !isReceptionist, pollingInterval: 60000 }
    );

    return {
        outcomes: data?.items ?? [],
        total: data?.meta.total ?? 0,
    };
};

export default useCancelOutcomes;
