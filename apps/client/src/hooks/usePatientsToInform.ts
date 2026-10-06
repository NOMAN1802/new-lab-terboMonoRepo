import { useRole } from '@/hooks/useRole';
import { useGetAppointmentsQuery } from '@/services/appointmentsApi';

/**
 * Patients whose appointment was cancelled by the doctor or by a schedule
 * change, and who the desk has not yet told. Behind the bell and the sidebar
 * count. The desk raised none of these cancellations, so without this nobody
 * would know a patient was about to turn up for nothing.
 *
 * A doctor has no business phoning patients, so a doctor skips the call.
 * Polled because the cancellation happens on another screen.
 */
export const usePatientsToInform = () => {
    const { isDoctor } = useRole();
    const { data } = useGetAppointmentsQuery(
        { callback: 'pending', limit: 5, sortBy: '-updatedAt' },
        { skip: isDoctor, pollingInterval: 60000 }
    );

    return {
        patients: data?.items ?? [],
        total: data?.meta.total ?? 0,
    };
};

export default usePatientsToInform;
