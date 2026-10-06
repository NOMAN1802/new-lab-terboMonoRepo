import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { apiErrorMessage, formatDate, money, toDhakaDateInput } from '@/lib/format';
import { useCreateAppointmentMutation, useGetAvailabilityQuery } from '@/services/appointmentsApi';
import type { AvailabilitySlot, ScheduleAvailability } from '@/services/appointmentsApi';
import { useGetDoctorsQuery } from '@/services/doctorsApi';
import { useGetPatientsQuery } from '@/services/patientsApi';

type Choice = { scheduleId: string; slot: AvailabilitySlot };
type PayMode = 'later' | 'full' | 'advance';

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

const BookAppointmentPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [date, setDate] = useState(toDhakaDateInput());
    const [doctor, setDoctor] = useState('');
    const [choice, setChoice] = useState<Choice | null>(null);
    const [patientId, setPatientId] = useState(searchParams.get('patient') ?? '');
    const [patientSearch, setPatientSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [payMode, setPayMode] = useState<PayMode>('full');
    const [advance, setAdvance] = useState('');

    const { data: doctorData } = useGetDoctorsQuery();
    const {
        data: availability,
        isLoading,
        isError,
        refetch,
    } = useGetAvailabilityQuery({ date, doctor: doctor || undefined }, { skip: !date });
    const { data: patientData, isLoading: loadingPatients } = useGetPatientsQuery({
        search: patientSearch.trim() || undefined,
        limit: 30,
    });
    const [createAppointment, { isLoading: isBooking }] = useCreateAppointmentMutation();

    const doctors = (doctorData?.items ?? []).filter((item) => item.isActive);
    const patients = patientData?.items ?? [];
    const patient = patients.find((item) => item._id === patientId);
    const schedules = availability ?? [];
    const chosenSchedule: ScheduleAvailability | undefined = schedules.find(
        (item) => item.schedule._id === choice?.scheduleId
    );

    const pick = (scheduleId: string, slot: AvailabilitySlot) => {
        if (slot.state !== 'free') return;
        setChoice({ scheduleId, slot });
    };

    const changeFilter = (apply: () => void) => {
        // A slot picked under the old filter may no longer be on screen.
        apply();
        setChoice(null);
    };

    const fee = chosenSchedule?.schedule.fee ?? 0;
    const advanceValue = Number(advance);
    const advanceError =
        payMode === 'advance' && (!advance || Number.isNaN(advanceValue) || advanceValue <= 0 || advanceValue > fee)
            ? `Enter an amount between 1 and ${money(fee)}`
            : null;

    const handleBook = async () => {
        if (!choice || !patientId || advanceError) return;

        try {
            const appointment = await createAppointment({
                schedule: choice.scheduleId,
                slotIndex: choice.slot.slotIndex,
                patient: patientId,
                notes: notes.trim() || undefined,
                collectFullPayment: payMode === 'full' && fee > 0 ? true : undefined,
                advanceAmount: payMode === 'advance' ? advanceValue : undefined,
            }).unwrap();
            toast.success(`Booked — serial ${appointment.serialNo} at ${appointment.startTime}`);
            if (appointment.paymentWarning) {
                toast.warning(`The booking stands, but the payment was not taken: ${appointment.paymentWarning}`, {
                    duration: 15000,
                });
            }
            navigate(`/appointments/${appointment._id}/print`);
        } catch (error) {
            // The slot may have just gone to someone else; show what is free now.
            setChoice(null);
            refetch();
            toast.error(apiErrorMessage(error, 'Could not book this appointment'));
        }
    };

    return (
        <>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>Book an appointment</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    Only times a doctor has approved are shown. Pick a free slot, then the patient.
                </p>
            </div>

            <Panel title="1 · Choose a day and doctor">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                    <TextField
                        label="Date"
                        type="date"
                        min={toDhakaDateInput()}
                        value={date}
                        onChange={(e) => changeFilter(() => setDate(e.target.value))}
                    />
                    <Select
                        label="Doctor"
                        value={doctor}
                        placeholder="Any doctor"
                        options={doctors.map((item) => ({ label: `${item.name} — ${item.specialty}`, value: item._id }))}
                        onChange={(e) => changeFilter(() => setDoctor(e.target.value))}
                    />
                </div>
            </Panel>

            {isLoading ? (
                <Loader message="Loading available times..." />
            ) : isError ? (
                <ErrorState title="Could not load available times" onRetry={refetch} />
            ) : schedules.length === 0 ? (
                <InlineAlert tone="info">
                    No approved schedule on {formatDate(date)}
                    {doctor ? ' for this doctor' : ''}. Ask the admin to propose one, or pick another day.
                </InlineAlert>
            ) : (
                schedules.map(({ schedule, slots, freeCount }) => (
                    <Panel
                        key={schedule._id}
                        title={`${schedule.doctor.name} · ${schedule.doctor.specialty}`}
                        subtitle={`${schedule.startTime}–${schedule.endTime} · ${schedule.slotMinutes} min each · ${money(schedule.fee)} · ${freeCount} free`}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {slots.map((slot) => {
                                const selected =
                                    choice?.scheduleId === schedule._id && choice.slot.slotIndex === slot.slotIndex;
                                return (
                                    <button
                                        key={slot.slotIndex}
                                        type="button"
                                        disabled={slot.state !== 'free'}
                                        aria-pressed={selected}
                                        title={
                                            slot.state === 'taken'
                                                ? 'Already booked'
                                                : slot.state === 'blocked'
                                                  ? 'The doctor is not available at this time'
                                                  : slot.state === 'past'
                                                    ? 'This time has passed'
                                                    : undefined
                                        }
                                        onClick={() => pick(schedule._id, slot)}
                                        style={slotStyle(slot.state, selected)}
                                    >
                                        <strong>{slot.startTime}</strong>
                                        <span style={{ fontSize: 11 }}>
                                            {slot.state === 'taken'
                                                ? 'Booked'
                                                : slot.state === 'blocked'
                                                  ? 'Unavailable'
                                                  : slot.state === 'past'
                                                    ? 'Passed'
                                                    : `Serial ${slot.serialNo}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </Panel>
                ))
            )}

            {choice && chosenSchedule && (
                <Panel title="2 · Patient" style={{ borderColor: 'var(--indigo-200)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <InlineAlert tone="info">
                            {chosenSchedule.schedule.doctor.name} · {formatDate(date)} · {choice.slot.startTime}–{choice.slot.endTime} · serial{' '}
                            {choice.slot.serialNo} · fee {money(chosenSchedule.schedule.fee)}
                        </InlineAlert>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%),1fr))', gap: 18 }}>
                            <TextField
                                label="Find patient"
                                icon="search"
                                type="search"
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                placeholder="Name, phone or patient ID"
                            />
                            <Select
                                label="Patient"
                                value={patientId}
                                placeholder={loadingPatients ? 'Loading...' : patients.length ? 'Select a patient' : 'No patients found'}
                                options={patients.map((item) => ({
                                    label: `${item.patientId} · ${item.name} · ${item.phone}`,
                                    value: item._id,
                                }))}
                                onChange={(e) => setPatientId(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ font: 'var(--type-label)', color: 'var(--text-body)' }}>
                                Consultation fee {money(fee)}
                            </span>
                            <SegmentedControl
                                options={[
                                    { label: 'Collect in full', value: 'full' },
                                    { label: 'Advance', value: 'advance' },
                                    { label: 'Pay later', value: 'later' },
                                ]}
                                value={payMode}
                                onChange={(value) => setPayMode(value as PayMode)}
                            />
                            {payMode === 'advance' && (
                                <div style={{ maxWidth: 260 }}>
                                    <TextField
                                        label="Amount taken now (৳)"
                                        type="number"
                                        min={1}
                                        max={fee}
                                        step="1"
                                        value={advance}
                                        onChange={(e) => setAdvance(e.target.value)}
                                        error={advance ? advanceError : undefined}
                                    />
                                </div>
                            )}
                        </div>

                        <Textarea
                            label="Notes (optional)"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Reason for visit, anything the doctor should know"
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <Button variant="secondary" onClick={() => setChoice(null)}>
                                Change slot
                            </Button>
                            <Button icon="check" loading={isBooking} disabled={!patientId || Boolean(advanceError)} onClick={handleBook}>
                                {isBooking ? 'Booking...' : patient ? `Book for ${patient.name}` : 'Book appointment'}
                            </Button>
                        </div>
                    </div>
                </Panel>
            )}
        </>
    );
};

export default BookAppointmentPage;
