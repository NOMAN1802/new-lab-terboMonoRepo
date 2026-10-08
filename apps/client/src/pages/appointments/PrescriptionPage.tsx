import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { apiErrorMessage, formatDate, toDhakaDateInput } from '@/lib/format';
import { useCompleteAppointmentMutation, useGetAppointmentQuery } from '@/services/appointmentsApi';
import type { Appointment } from '@/services/appointmentsApi';
import { useGetPrescriptionByAppointmentQuery, useSavePrescriptionMutation } from '@/services/prescriptionsApi';
import type { Medicine, Prescription } from '@/services/prescriptionsApi';

const BLANK: Medicine = { name: '', dose: '', frequency: '', duration: '', instruction: '' };

const FIELD_HINTS: { key: keyof Medicine; label: string; placeholder: string }[] = [
    { key: 'dose', label: 'Dose', placeholder: '500 mg' },
    { key: 'frequency', label: 'How often', placeholder: '1+0+1' },
    { key: 'duration', label: 'For', placeholder: '5 days' },
    { key: 'instruction', label: 'Instruction', placeholder: 'after meals' },
];

type After = 'stay' | 'print' | 'complete';

const PrescriptionForm = ({ appointment, existing }: { appointment: Appointment; existing: Prescription | null }) => {
    const navigate = useNavigate();
    const [save, { isLoading: isSaving }] = useSavePrescriptionMutation();
    const [complete, { isLoading: isCompleting }] = useCompleteAppointmentMutation();

    const [complaints, setComplaints] = useState(existing?.complaints ?? '');
    const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');
    const [medicines, setMedicines] = useState<Medicine[]>(existing?.medicines.length ? existing.medicines : [{ ...BLANK }]);
    const [tests, setTests] = useState((existing?.investigations ?? []).join('\n'));
    const [advice, setAdvice] = useState(existing?.advice ?? '');
    const [followUp, setFollowUp] = useState(existing?.followUpDate ? toDhakaDateInput(new Date(existing.followUpDate)) : '');

    const setMedicine = (index: number, patch: Partial<Medicine>) =>
        setMedicines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const submit = async (after: After) => {
        const cleaned = medicines
            .map((row) => ({
                name: row.name.trim(),
                dose: row.dose?.trim() || undefined,
                frequency: row.frequency?.trim() || undefined,
                duration: row.duration?.trim() || undefined,
                instruction: row.instruction?.trim() || undefined,
            }))
            .filter((row) => row.name);
        const investigations = tests
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        if (!cleaned.length && !investigations.length && !diagnosis.trim() && !advice.trim()) {
            toast.error('Write at least a diagnosis, a medicine, a test or some advice');
            return;
        }

        try {
            await save({
                appointmentId: appointment._id,
                complaints: complaints.trim() || undefined,
                diagnosis: diagnosis.trim() || undefined,
                medicines: cleaned,
                investigations,
                advice: advice.trim() || undefined,
                followUpDate: followUp || null,
            }).unwrap();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not save the prescription'));
            return;
        }

        if (after === 'complete') {
            try {
                await complete(appointment._id).unwrap();
                toast.success('Prescription saved and visit completed');
                navigate(`/appointments/${appointment._id}/prescription/print`);
            } catch (error) {
                toast.error(apiErrorMessage(error, 'Saved, but the visit could not be completed'));
            }
            return;
        }

        toast.success('Prescription saved');
        if (after === 'print') navigate(`/appointments/${appointment._id}/prescription/print`);
    };

    const busy = isSaving || isCompleting;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <Panel title="Visit">
                <p style={{ fontSize: 13, color: 'var(--text-body)' }}>
                    <strong>{appointment.patientInfo.name}</strong> · {appointment.patientInfo.age} y · {appointment.patientInfo.gender} ·{' '}
                    {appointment.patientInfo.patientId} · {appointment.patientInfo.phone}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Serial {appointment.serialNo} · {formatDate(appointment.date)} · {appointment.startTime}
                    {existing && ` · ${existing.prescriptionNumber}`}
                </p>
            </Panel>

            <Panel title="Findings">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%),1fr))', gap: 16 }}>
                    <Textarea label="Complaints" optional rows={3} value={complaints} onChange={(e) => setComplaints(e.target.value)} placeholder="What the patient reports" />
                    <Textarea label="Diagnosis" optional rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Your finding" />
                </div>
            </Panel>

            <Panel title="Medicines" subtitle="One row per medicine. Leave a row blank to skip it.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {medicines.map((row, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(180px, 2fr) repeat(4, minmax(110px, 1fr)) auto',
                                gap: 10,
                                alignItems: 'end',
                            }}
                        >
                            <TextField
                                label={index === 0 ? 'Medicine' : undefined}
                                value={row.name}
                                onChange={(e) => setMedicine(index, { name: e.target.value })}
                                placeholder="Name and strength"
                            />
                            {FIELD_HINTS.map((field) => (
                                <TextField
                                    key={field.key}
                                    label={index === 0 ? field.label : undefined}
                                    value={row[field.key] ?? ''}
                                    onChange={(e) => setMedicine(index, { [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                />
                            ))}
                            <Button
                                type="button"
                                variant="secondary"
                                icon="trash-2"
                                aria-label={`Remove medicine ${index + 1}`}
                                disabled={medicines.length === 1 && !row.name}
                                onClick={() => setMedicines((rows) => (rows.length === 1 ? [{ ...BLANK }] : rows.filter((_, i) => i !== index)))}
                            />
                        </div>
                    ))}
                    <div>
                        <Button type="button" variant="secondary" icon="plus" onClick={() => setMedicines((rows) => [...rows, { ...BLANK }])}>
                            Add medicine
                        </Button>
                    </div>
                </div>
            </Panel>

            <Panel title="Tests and advice">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%),1fr))', gap: 16 }}>
                    <Textarea label="Tests to be done" optional rows={4} value={tests} onChange={(e) => setTests(e.target.value)} placeholder={'One per line, e.g.\nCBC\nFasting blood sugar'} />
                    <Textarea label="Advice" optional rows={4} value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Rest, diet, warning signs" />
                </div>
                <div style={{ marginTop: 16, maxWidth: 260 }}>
                    <TextField label="Follow-up on" optional type="date" min={toDhakaDateInput()} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </div>
            </Panel>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate('/appointments')}>
                    Back
                </Button>
                <Button type="button" variant="secondary" loading={isSaving && !isCompleting} disabled={busy} onClick={() => submit('stay')}>
                    Save
                </Button>
                <Button type="button" variant={appointment.status === 'checked_in' ? 'secondary' : 'primary'} icon="printer" disabled={busy} onClick={() => submit('print')}>
                    Save and print
                </Button>
                {appointment.status === 'checked_in' && (
                    <Button type="button" icon="check" loading={isCompleting} disabled={busy} onClick={() => submit('complete')}>
                        Save and complete visit
                    </Button>
                )}
            </div>
        </div>
    );
};

/** The doctor's page for writing, or correcting, the prescription for one visit. */
const PrescriptionPage = () => {
    const { id } = useParams();
    const { data: appointment, isLoading, isError, refetch } = useGetAppointmentQuery(id!);
    const { data: existing, isLoading: loadingRx, isError: rxError } = useGetPrescriptionByAppointmentQuery(id!);

    if (isLoading || loadingRx) return <Loader message="Opening the visit..." />;
    if (isError || rxError || !appointment) return <ErrorState title="Could not open this visit" onRetry={refetch} />;

    const writable = appointment.status === 'checked_in' || appointment.status === 'completed';

    return (
        <>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                    {existing ? 'Edit prescription' : 'Write prescription'}
                </h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {appointment.patientInfo.name} · {appointment.appointmentNumber}
                </p>
            </div>

            {!writable ? (
                <InlineAlert tone="warning">
                    {appointment.status === 'booked'
                        ? 'Call the patient in from the appointments list before writing a prescription.'
                        : `This appointment is ${appointment.status.replace('_', ' ')}, so no prescription can be written.`}
                </InlineAlert>
            ) : (
                <PrescriptionForm key={existing?._id ?? 'new'} appointment={appointment} existing={existing ?? null} />
            )}
        </>
    );
};

export default PrescriptionPage;
