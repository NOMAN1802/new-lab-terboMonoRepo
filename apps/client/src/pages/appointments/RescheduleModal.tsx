import { useState } from 'react';
import { toast } from 'sonner';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import { apiErrorMessage, formatDate, toDhakaDateInput } from '@/lib/format';
import { useGetAvailabilityQuery, useRescheduleAppointmentMutation } from '@/services/appointmentsApi';
import type { Appointment, AvailabilitySlot } from '@/services/appointmentsApi';

type Choice = { scheduleId: string; slot: AvailabilitySlot };

const slotStyle = (state: AvailabilitySlot['state'], selected: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 76,
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${selected ? 'var(--brand)' : 'var(--border-card)'}`,
    background: selected ? 'var(--brand)' : state === 'free' ? 'var(--surface-card)' : 'var(--surface-sunken)',
    color: selected ? 'var(--white)' : state === 'free' ? 'var(--text-heading)' : 'var(--text-faint)',
    cursor: state === 'free' ? 'pointer' : 'not-allowed',
    textDecoration: state === 'free' ? 'none' : 'line-through',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-13)',
    fontVariantNumeric: 'tabular-nums',
});

const STATE_LABEL: Record<AvailabilitySlot['state'], string> = {
    free: '',
    taken: 'Booked',
    blocked: 'Unavailable',
    past: 'Passed',
};

const RescheduleForm = ({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) => {
    const [date, setDate] = useState(() => toDhakaDateInput(new Date(appointment.date)));
    const [choice, setChoice] = useState<Choice | null>(null);
    const [move, { isLoading: isMoving }] = useRescheduleAppointmentMutation();
    const { data: availability, isFetching, isError } = useGetAvailabilityQuery(
        { date, doctor: appointment.doctor._id },
        { skip: !date }
    );

    const submit = async () => {
        if (!choice) return;
        try {
            await move({ id: appointment._id, schedule: choice.scheduleId, slotIndex: choice.slot.slotIndex }).unwrap();
            toast.success(`${appointment.patientInfo.name} moved to ${formatDate(date)} at ${choice.slot.startTime}`);
            onClose();
        } catch (error) {
            // The slot may have just gone to someone else; the list refetches.
            setChoice(null);
            toast.error(apiErrorMessage(error, 'Could not move the appointment'));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <InlineAlert tone="info">
                Now {formatDate(appointment.date)}, {appointment.startTime}, serial {appointment.serialNo}. The fee and invoice
                stay as they are. Tell the patient the new time.
            </InlineAlert>

            <TextField
                label="Move to date"
                type="date"
                min={toDhakaDateInput()}
                value={date}
                onChange={(e) => {
                    setDate(e.target.value);
                    setChoice(null);
                }}
            />

            {isFetching ? (
                <Loader message="Finding free slots..." />
            ) : isError ? (
                <InlineAlert tone="warning">Could not load the doctor's slots for this day.</InlineAlert>
            ) : !availability || availability.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {appointment.doctor.name} has no approved schedule on {formatDate(date)}.
                </p>
            ) : (
                availability.map(({ schedule, slots, freeCount }) => (
                    <div key={schedule._id}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 8 }}>
                            {schedule.startTime}–{schedule.endTime} · {freeCount} free
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {slots.map((slot) => {
                                const selected = choice?.scheduleId === schedule._id && choice.slot.slotIndex === slot.slotIndex;
                                return (
                                    <button
                                        key={slot.slotIndex}
                                        type="button"
                                        disabled={slot.state !== 'free'}
                                        aria-pressed={selected}
                                        onClick={() => setChoice({ scheduleId: schedule._id, slot })}
                                        style={slotStyle(slot.state, selected)}
                                    >
                                        <strong>{slot.startTime}</strong>
                                        <span style={{ fontSize: 11 }}>{STATE_LABEL[slot.state] || `Serial ${slot.serialNo}`}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <Button type="button" variant="secondary" disabled={isMoving} onClick={onClose}>
                    Keep as is
                </Button>
                <Button type="button" loading={isMoving} disabled={!choice} onClick={submit}>
                    {choice ? `Move to ${choice.slot.startTime}` : 'Pick a slot'}
                </Button>
            </div>
        </div>
    );
};

/** Moves a booked patient to another free slot of the same doctor. */
const RescheduleModal = ({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) => (
    <Modal
        open={Boolean(appointment)}
        onClose={onClose}
        width={640}
        title={appointment ? 'Reschedule appointment' : undefined}
        subtitle={appointment ? `${appointment.patientInfo.name} · ${appointment.doctor.name}` : undefined}
    >
        {appointment && <RescheduleForm key={appointment._id} appointment={appointment} onClose={onClose} />}
    </Modal>
);

export default RescheduleModal;
