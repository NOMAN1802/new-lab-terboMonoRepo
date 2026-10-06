import { useState } from 'react';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import ReasonModal from '@/components/common/ReasonModal';
import type { ReasonRequest } from '@/components/common/ReasonModal';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { apiErrorMessage, formatDate, money } from '@/lib/format';
import {
    useBlockSlotMutation,
    useGetScheduleSlotsQuery,
    useUnblockSlotMutation,
} from '@/services/schedulesApi';
import type { Schedule, ScheduleSlot } from '@/services/schedulesApi';

type Props = {
    schedule: Schedule | null;
    onClose: () => void;
};

/**
 * One schedule slot by slot: who is in each, and which are blocked. A doctor
 * (or an admin) can take any slot that has not passed out of the schedule, for
 * a break or an emergency, and reopen it later. Blocking a booked slot releases
 * that patient and tells the desk to phone them.
 */
const ScheduleSlotsModal = ({ schedule, onClose }: Props) => {
    const { data, isLoading, isError, refetch } = useGetScheduleSlotsQuery(schedule?._id ?? '', {
        skip: !schedule,
    });
    const [blockSlot, { isLoading: isBlocking }] = useBlockSlotMutation();
    const [unblockSlot, { isLoading: isUnblocking }] = useUnblockSlotMutation();
    const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);

    const askBlock = (slot: ScheduleSlot) => {
        if (!schedule) return;
        const booked = slot.state === 'booked';
        setReasonRequest({
            title: `Block the ${slot.startTime} slot`,
            description: `${formatDate(schedule.date)} · serial ${slot.serialNo}`,
            warning: booked
                ? `${slot.appointment?.patientName} is booked here. Their appointment will be cancelled and the desk will be told to phone them.`
                : 'Nobody will be able to book this time until you reopen it.',
            confirmLabel: 'Block slot',
            onConfirm: async (reason) => {
                try {
                    const result = await blockSlot({ id: schedule._id, slotIndex: slot.slotIndex, reason }).unwrap();
                    const released = result.cancelledAppointments ?? [];
                    if (released.length > 0) {
                        const refund = released.filter((item) => item.refundDue > 0);
                        toast.warning(
                            `Slot blocked. ${released.map((item) => item.patientName).join(', ')} will be phoned by the desk.` +
                                (refund.length > 0
                                    ? ` A refund of ${refund.map((item) => money(item.refundDue)).join(', ')} is due.`
                                    : ''),
                            { duration: 15000 }
                        );
                    } else {
                        toast.success('Slot blocked');
                    }
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not block the slot'));
                }
            },
        });
    };

    const reopen = async (slot: ScheduleSlot) => {
        if (!schedule) return;
        try {
            await unblockSlot({ id: schedule._id, slotIndex: slot.slotIndex }).unwrap();
            toast.success(`The ${slot.startTime} slot is open for booking again`);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not reopen the slot'));
        }
    };

    const slots = data?.slots ?? [];
    const editable = schedule?.status === 'approved';

    return (
        <>
            <Modal
                open={Boolean(schedule)}
                onClose={onClose}
                width={720}
                title={schedule ? `${formatDate(schedule.date)} · ${schedule.startTime}–${schedule.endTime}` : undefined}
                subtitle={
                    schedule
                        ? `${schedule.doctor.name} · ${schedule.slotMinutes} minutes per patient`
                        : undefined
                }
            >
                {isLoading ? (
                    <Loader message="Loading slots..." />
                ) : isError ? (
                    <ErrorState title="Could not load the slots" onRetry={refetch} />
                ) : (
                    <DataTable<ScheduleSlot & { id: string }>
                        dense
                        minWidth="34rem"
                        empty="This schedule has no slots."
                        rows={slots.map((slot) => ({ ...slot, id: String(slot.slotIndex) }))}
                        columns={[
                            {
                                key: 'serial',
                                header: 'Serial',
                                mono: true,
                                render: (slot) => <span style={{ fontWeight: 700, color: 'var(--brand)' }}>#{slot.serialNo}</span>,
                            },
                            {
                                key: 'time',
                                header: 'Time',
                                render: (slot) => (
                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                        {slot.startTime}–{slot.endTime}
                                    </span>
                                ),
                            },
                            { key: 'state', header: 'Status', render: (slot) => <StatusBadge status={slot.state} /> },
                            {
                                key: 'detail',
                                header: 'Details',
                                render: (slot) =>
                                    slot.appointment ? (
                                        <span>
                                            <strong style={{ color: 'var(--text-heading)' }}>{slot.appointment.patientName}</strong>
                                            <span style={{ color: 'var(--text-faint)' }}>
                                                {' '}
                                                · {slot.appointment.patientAge} · {slot.appointment.patientGender}
                                            </span>
                                        </span>
                                    ) : slot.blocked ? (
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {slot.blocked.reason}
                                            <span style={{ color: 'var(--text-faint)' }}> · {slot.blocked.blockedByName}</span>
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                                    ),
                            },
                            {
                                key: 'actions',
                                header: '',
                                align: 'right',
                                render: (slot) =>
                                    !editable || slot.state === 'past' ? null : slot.state === 'blocked' ? (
                                        <Button size="sm" variant="secondary" disabled={isUnblocking} onClick={() => reopen(slot)}>
                                            Reopen
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="secondary" disabled={isBlocking} onClick={() => askBlock(slot)}>
                                            Block
                                        </Button>
                                    ),
                            },
                        ]}
                    />
                )}
            </Modal>

            <ReasonModal request={reasonRequest} busy={isBlocking} onClose={() => setReasonRequest(null)} />
        </>
    );
};

export default ScheduleSlotsModal;
