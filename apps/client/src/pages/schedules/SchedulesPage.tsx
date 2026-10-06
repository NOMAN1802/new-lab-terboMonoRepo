import { useState } from 'react';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import ReasonModal from '@/components/common/ReasonModal';
import type { ReasonRequest } from '@/components/common/ReasonModal';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { apiErrorMessage, formatDate, money, toDhakaDateInput } from '@/lib/format';
import { useGetDoctorsQuery } from '@/services/doctorsApi';
import {
    useApproveScheduleMutation,
    useCancelScheduleMutation,
    useCreateScheduleMutation,
    useDeclineScheduleMutation,
    useGetSchedulesQuery,
    useUpdateScheduleMutation,
} from '@/services/schedulesApi';
import type { Schedule, ScheduleStatus } from '@/services/schedulesApi';
import ScheduleSlotsModal from './ScheduleSlotsModal';

type Filter = ScheduleStatus | 'all';

const FILTERS: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Declined', value: 'declined' },
    { label: 'Cancelled', value: 'cancelled' },
];

type Form = {
    doctor: string;
    date: string;
    startTime: string;
    endTime: string;
    slotMinutes: string;
    fee: string;
};

const EMPTY: Form = { doctor: '', date: '', startTime: '09:00', endTime: '13:00', slotMinutes: '15', fee: '' };

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const slotsIn = (startTime: string, endTime: string, slotMinutes: number) => {
    const span = toMinutes(endTime) - toMinutes(startTime);
    return span > 0 && slotMinutes > 0 ? Math.floor(span / slotMinutes) : 0;
};

const SchedulesPage = () => {
    const { isAdmin, isDoctor } = useRole();
    const [filter, setFilter] = useState<Filter>('all');
    const [isFormOpen, setFormOpen] = useState(false);
    // The schedule being changed, or null when the form is making a new one.
    const [editing, setEditing] = useState<Schedule | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [slotsFor, setSlotsFor] = useState<Schedule | null>(null);
    const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);

    const { data, isLoading, isError, refetch } = useGetSchedulesQuery({
        status: filter === 'all' ? undefined : filter,
    });
    const { data: doctorData } = useGetDoctorsQuery(undefined, { skip: !isAdmin });
    const [createSchedule, { isLoading: isCreating }] = useCreateScheduleMutation();
    const [updateSchedule, { isLoading: isUpdating }] = useUpdateScheduleMutation();
    const [approveSchedule] = useApproveScheduleMutation();
    const [declineSchedule, { isLoading: isDeclining }] = useDeclineScheduleMutation();
    const [cancelSchedule, { isLoading: isCancelling }] = useCancelScheduleMutation();

    const schedules = data?.items ?? [];
    const activeDoctors = (doctorData?.items ?? []).filter((doctor) => doctor.isActive);
    const selectedDoctor = activeDoctors.find((doctor) => doctor._id === form.doctor);
    const previewSlots = slotsIn(form.startTime, form.endTime, Number(form.slotMinutes));
    const isSaving = isCreating || isUpdating;

    const closeForm = () => {
        setFormOpen(false);
        setEditing(null);
        setForm(EMPTY);
    };

    const startCreate = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormOpen(true);
    };

    const startEdit = (schedule: Schedule) => {
        setEditing(schedule);
        setForm({
            doctor: schedule.doctor._id,
            date: toDhakaDateInput(new Date(schedule.date)),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            slotMinutes: String(schedule.slotMinutes),
            fee: String(schedule.fee),
        });
        setFormOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!editing && (!form.doctor || !form.date)) {
            toast.error('Choose a doctor and a date');
            return;
        }
        if (previewSlots < 1) {
            toast.error('The time range is too short for even one slot');
            return;
        }

        try {
            if (editing) {
                await updateSchedule({
                    id: editing._id,
                    data: {
                        date: form.date,
                        startTime: form.startTime,
                        endTime: form.endTime,
                        slotMinutes: Number(form.slotMinutes),
                        // A doctor cannot change their own fee; only an admin sends one.
                        ...(isAdmin && form.fee !== '' ? { fee: Number(form.fee) } : {}),
                    },
                }).unwrap();
                toast.success('Schedule updated');
            } else {
                await createSchedule({
                    doctor: form.doctor,
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    slotMinutes: Number(form.slotMinutes),
                    fee: form.fee === '' ? undefined : Number(form.fee),
                }).unwrap();
                toast.success('Schedule sent to the doctor for approval');
            }
            closeForm();
        } catch (error) {
            toast.error(apiErrorMessage(error, editing ? 'Could not update schedule' : 'Could not create schedule'));
        }
    };

    const handleApprove = async (schedule: Schedule) => {
        try {
            await approveSchedule(schedule._id).unwrap();
            toast.success('Schedule approved. Patients can now be booked into it.');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not approve schedule'));
        }
    };

    const askDecline = (schedule: Schedule) =>
        setReasonRequest({
            title: 'Decline this schedule',
            description: `${formatDate(schedule.date)}, ${schedule.startTime}–${schedule.endTime}`,
            warning: 'It will not be offered to patients. The admin sees your reason.',
            confirmLabel: 'Decline schedule',
            onConfirm: async (reason) => {
                try {
                    await declineSchedule({ id: schedule._id, reason }).unwrap();
                    toast.success('Schedule declined');
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not decline schedule'));
                }
            },
        });

    const askCancel = (schedule: Schedule) =>
        setReasonRequest({
            title: 'Cancel this schedule',
            description: `${schedule.doctor.name} · ${formatDate(schedule.date)}, ${schedule.startTime}–${schedule.endTime}`,
            warning:
                schedule.status === 'approved'
                    ? isDoctor
                        ? 'Patients already booked will lose their appointments and the desk will phone them.'
                        : 'The doctor had already approved it.'
                    : undefined,
            confirmLabel: 'Cancel schedule',
            onConfirm: async (reason) => {
                try {
                    const result = await cancelSchedule({ id: schedule._id, reason }).unwrap();
                    const released = result.cancelledAppointments ?? [];
                    if (released.length > 0) {
                        const refunds = released.filter((item) => item.refundDue > 0);
                        toast.warning(
                            `Schedule cancelled. ${released.length} booked patient${released.length === 1 ? '' : 's'} released: ` +
                                released.map((item) => `${item.patientName} (${item.patientPhone})`).join(', ') +
                                (isDoctor ? '. The desk has been told to phone them.' : '. They must be called.') +
                                (refunds.length > 0 ? ` Refund due: ${refunds.map((item) => money(item.refundDue)).join(', ')}.` : ''),
                            { duration: 20000 }
                        );
                    } else {
                        toast.success('Schedule cancelled');
                    }
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not cancel schedule'));
                }
            },
        });

    // The party who agreed to a schedule may change it: the admin while it is
    // still a proposal, the doctor once it is approved (and while it is pending).
    const canEdit = (schedule: Schedule) =>
        schedule.status === 'pending' || (schedule.status === 'approved' && isDoctor);
    const canCancel = (schedule: Schedule) =>
        isAdmin
            ? schedule.status === 'pending' || schedule.status === 'approved'
            : isDoctor && schedule.status === 'approved';

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                        {isDoctor ? 'My schedules' : 'Doctor schedules'}
                    </h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {isDoctor
                            ? 'Approve the times you can see patients. Open an approved schedule to block single slots, or change or cancel it.'
                            : 'Propose a time for a doctor. It can be booked only after the doctor approves it.'}
                    </p>
                </div>
                {isAdmin && (
                    <Button icon="plus" onClick={startCreate}>
                        New schedule
                    </Button>
                )}
            </div>

            {isFormOpen && (isAdmin || editing) && (
                <Panel
                    title={editing ? `Edit ${formatDate(editing.date)}, ${editing.startTime}–${editing.endTime}` : 'New schedule'}
                    style={{ borderColor: 'var(--indigo-200)' }}
                >
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {editing?.status === 'approved' && (
                            <InlineAlert tone="info">
                                You can reshape this only while no patient is booked into it. Changing the times starts the
                                slots afresh, so any blocked slots are reopened. Otherwise block single slots, or cancel it.
                            </InlineAlert>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%),1fr))', gap: 18 }}>
                            {editing ? (
                                <TextField label="Doctor" value={editing.doctor.name} disabled onChange={() => undefined} />
                            ) : (
                                <Select
                                    label="Doctor"
                                    value={form.doctor}
                                    placeholder="Choose a doctor"
                                    options={activeDoctors.map((doctor) => ({
                                        label: `${doctor.name} — ${doctor.specialty}`,
                                        value: doctor._id,
                                    }))}
                                    onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                                />
                            )}
                            <TextField
                                label="Date"
                                type="date"
                                min={toDhakaDateInput()}
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                            />
                            <TextField
                                label="From"
                                type="time"
                                value={form.startTime}
                                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                            />
                            <TextField
                                label="To"
                                type="time"
                                value={form.endTime}
                                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                            />
                            <TextField
                                label="Minutes per patient"
                                type="number"
                                min={5}
                                max={120}
                                step="5"
                                value={form.slotMinutes}
                                onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })}
                            />
                            {isAdmin && (
                                <TextField
                                    label="Fee (৳)"
                                    optional
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={form.fee}
                                    onChange={(e) => setForm({ ...form, fee: e.target.value })}
                                    hint={
                                        editing
                                            ? undefined
                                            : selectedDoctor
                                              ? `Blank uses ${money(selectedDoctor.consultationFee)}`
                                              : 'Blank uses the doctor’s fee'
                                    }
                                />
                            )}
                        </div>

                        <p style={{ fontSize: 13, color: previewSlots > 0 ? 'var(--text-muted)' : 'var(--danger-strong)' }}>
                            {previewSlots > 0
                                ? `${previewSlots} patient slot${previewSlots === 1 ? '' : 's'}, serial 1–${previewSlots}`
                                : 'This time range does not fit a single slot.'}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button variant="secondary" onClick={closeForm}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Send for approval'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            )}

            <div style={{ overflowX: 'auto' }}>
                <SegmentedControl
                    options={FILTERS}
                    value={filter}
                    onChange={(value) => setFilter(value as Filter)}
                />
            </div>

            {isLoading ? (
                <Loader message="Loading schedules..." />
            ) : isError ? (
                <ErrorState title="Could not load schedules" onRetry={refetch} />
            ) : (
                <Panel padding="0">
                    <DataTable<Schedule & { id: string }>
                        minWidth="52rem"
                        empty={filter === 'all' ? 'No schedules yet.' : `No ${filter} schedules.`}
                        rows={schedules.map((schedule) => ({ ...schedule, id: schedule._id }))}
                        columns={[
                            {
                                key: 'date',
                                header: 'Date',
                                render: (schedule) => (
                                    <span style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                                        {formatDate(schedule.date)}
                                    </span>
                                ),
                            },
                            {
                                key: 'time',
                                header: 'Time',
                                render: (schedule) => (
                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                        {schedule.startTime}–{schedule.endTime}
                                    </span>
                                ),
                            },
                            ...(isAdmin
                                ? [
                                      {
                                          key: 'doctor',
                                          header: 'Doctor',
                                          render: (schedule: Schedule) => (
                                              <div>
                                                  <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                                                      {schedule.doctor.name}
                                                  </p>
                                                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                                      {schedule.doctor.specialty}
                                                  </p>
                                              </div>
                                          ),
                                      },
                                  ]
                                : []),
                            {
                                key: 'slots',
                                header: 'Slots',
                                align: 'right',
                                render: (schedule) => (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                        <span>
                                            {schedule.slotCount} × {schedule.slotMinutes}m
                                        </span>
                                        {schedule.status === 'approved' && (
                                            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                                                {schedule.bookedCount ?? 0} booked
                                                {schedule.blockedCount ? ` · ${schedule.blockedCount} blocked` : ''}
                                            </span>
                                        )}
                                    </div>
                                ),
                            },
                            { key: 'fee', header: 'Fee', align: 'right', render: (schedule) => money(schedule.fee) },
                            {
                                key: 'status',
                                header: 'Status',
                                render: (schedule) => (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                        <StatusBadge status={schedule.status} />
                                        {(schedule.declineReason || schedule.cancelReason) && (
                                            <span style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 220 }}>
                                                {schedule.declineReason ?? schedule.cancelReason}
                                            </span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'actions',
                                header: 'Actions',
                                align: 'right',
                                render: (schedule) => (
                                    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {isDoctor && schedule.status === 'pending' && (
                                            <>
                                                <Button size="sm" icon="check" onClick={() => handleApprove(schedule)}>
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => askDecline(schedule)}>
                                                    Decline
                                                </Button>
                                            </>
                                        )}
                                        {schedule.status === 'approved' && (
                                            <Button size="sm" icon="clock" onClick={() => setSlotsFor(schedule)}>
                                                Slots
                                            </Button>
                                        )}
                                        {canEdit(schedule) && (
                                            <Button size="sm" variant="secondary" icon="pencil" onClick={() => startEdit(schedule)}>
                                                Edit
                                            </Button>
                                        )}
                                        {canCancel(schedule) && (
                                            <Button size="sm" variant="secondary" onClick={() => askCancel(schedule)}>
                                                Cancel
                                            </Button>
                                        )}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </Panel>
            )}

            <ScheduleSlotsModal schedule={slotsFor} onClose={() => setSlotsFor(null)} />

            <ReasonModal
                request={reasonRequest}
                busy={isDeclining || isCancelling}
                onClose={() => setReasonRequest(null)}
            />
        </>
    );
};

export default SchedulesPage;
