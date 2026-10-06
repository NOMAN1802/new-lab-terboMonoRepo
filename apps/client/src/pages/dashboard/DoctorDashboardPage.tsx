import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import ReasonModal from '@/components/common/ReasonModal';
import type { ReasonRequest } from '@/components/common/ReasonModal';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { apiErrorMessage, formatDate, toDhakaDateInput } from '@/lib/format';
import { useCompleteAppointmentMutation } from '@/services/appointmentsApi';
import { useGetDoctorDashboardQuery } from '@/services/dashboardApi';
import type { DoctorQueueEntry } from '@/services/dashboardApi';
import {
    useApproveScheduleMutation,
    useDeclineScheduleMutation,
    useGetSchedulesQuery,
} from '@/services/schedulesApi';
import type { ScheduleQuery } from '@/services/schedulesApi';

const greeting = () => {
    const hour = Number(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }).format(new Date())
    );
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

type Era = 'upcoming' | 'past';

const PAGE = 8;

/**
 * Every schedule this doctor has approved, upcoming or past, each with how many
 * of its slots are taken. Read from the same list as the Schedules page, which
 * the server already limits to the logged-in doctor.
 */
const ApprovedSchedules = () => {
    const [era, setEra] = useState<Era>('upcoming');
    const [limit, setLimit] = useState(PAGE);

    // Fixed when the panel opens, so a render never reads the clock.
    const [{ today, yesterday }] = useState(() => ({
        today: toDhakaDateInput(),
        yesterday: toDhakaDateInput(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    }));
    const query: ScheduleQuery =
        era === 'upcoming'
            ? { status: 'approved', startDate: today, limit }
            : { status: 'approved', endDate: yesterday, sortBy: '-date -startTime', limit };

    const { data, isLoading, isError, refetch } = useGetSchedulesQuery(query);
    const schedules = data?.items ?? [];
    const total = data?.meta.total ?? 0;

    return (
        <Panel title="Approved schedules" subtitle="Every time you have agreed to see patients">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SegmentedControl
                    options={[
                        { label: 'Upcoming', value: 'upcoming' },
                        { label: 'Past', value: 'past' },
                    ]}
                    value={era}
                    onChange={(value) => {
                        setEra(value as Era);
                        setLimit(PAGE);
                    }}
                />

                {isLoading ? (
                    <Loader message="Loading your schedules..." />
                ) : isError ? (
                    <ErrorState title="Could not load your schedules" onRetry={refetch} />
                ) : schedules.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {era === 'upcoming' ? 'No upcoming schedules you have approved.' : 'No past schedules yet.'}
                    </p>
                ) : (
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 14, listStyle: 'none', margin: 0, padding: 0 }}>
                        {schedules.map((schedule) => {
                            const booked = schedule.bookedCount ?? 0;
                            const blocked = schedule.blockedCount ?? 0;
                            // Blocked slots are not on offer, so they are not part of the capacity.
                            const capacity = Math.max(0, schedule.slotCount - blocked);
                            const fill = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : 0;
                            return (
                                <li key={schedule._id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                                        <Link
                                            to={`/appointments?date=${toDhakaDateInput(new Date(schedule.date))}`}
                                            style={{ fontWeight: 600, color: 'var(--text-heading)' }}
                                            title="See the appointments on this day"
                                        >
                                            {formatDate(schedule.date)} · {schedule.startTime}–{schedule.endTime}
                                        </Link>
                                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                            {booked}/{capacity} booked{blocked > 0 ? ` · ${blocked} blocked` : ''}
                                        </span>
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-valuenow={booked}
                                        aria-valuemin={0}
                                        aria-valuemax={capacity}
                                        aria-label={`${booked} of ${capacity} open slots booked`}
                                        style={{ marginTop: 6, height: 6, borderRadius: 999, background: 'var(--surface-sunken)', overflow: 'hidden' }}
                                    >
                                        <div style={{ width: `${fill}%`, height: '100%', background: 'var(--brand)' }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {schedules.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                            Showing {schedules.length} of {total}
                        </span>
                        {schedules.length < total && (
                            <Button size="sm" variant="secondary" onClick={() => setLimit((current) => current + PAGE)}>
                                Show more
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Panel>
    );
};

const DoctorDashboardPage = () => {
    const { data, isLoading, isError, refetch } = useGetDoctorDashboardQuery(undefined, {
        // A clinic changes minute to minute as the desk checks patients in.
        pollingInterval: 30000,
    });
    const [complete, { isLoading: isCompleting }] = useCompleteAppointmentMutation();
    const [approveSchedule] = useApproveScheduleMutation();
    const [declineSchedule, { isLoading: isDeclining }] = useDeclineScheduleMutation();
    const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);

    if (isLoading) return <Loader message="Opening your clinic..." />;
    if (isError || !data) return <ErrorState title="Could not load your dashboard" onRetry={refetch} />;

    const { doctor, today, nextUp, queue, pendingSchedules, completedLast30 } = data;

    const markComplete = async (entry: DoctorQueueEntry) => {
        try {
            await complete(entry._id).unwrap();
            toast.success(`${entry.patientName} marked as seen`);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not complete the consultation'));
        }
    };

    const approve = async (id: string) => {
        try {
            await approveSchedule(id).unwrap();
            toast.success('Schedule approved. Patients can now be booked into it.');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not approve schedule'));
        }
    };

    const askDecline = (schedule: (typeof pendingSchedules)[number]) =>
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

    return (
        <>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                    {greeting()}, {doctor.name}
                </h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {doctor.specialty} · {formatDate(today.date)}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                <StatCard label="Patients today" value={today.total} icon="users" accent="brand" />
                <StatCard
                    label="Waiting now"
                    value={today.checkedIn}
                    icon="hourglass"
                    accent="warning"
                    caption={today.checkedIn > 0 ? 'Checked in at the desk' : 'Nobody waiting'}
                />
                <StatCard label="Seen today" value={today.completed} icon="circle-check" accent="accent" />
                <StatCard
                    label="Still to arrive"
                    value={today.booked}
                    icon="clock"
                    accent="neutral"
                    caption={today.noShow > 0 ? `${today.noShow} no-show` : undefined}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%),1fr))', gap: 'var(--gap-grid)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
                    <Panel title="Next patient" style={nextUp ? { borderColor: 'var(--indigo-200)' } : undefined}>
                        {nextUp ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                <div
                                    style={{
                                        minWidth: 72,
                                        padding: '8px 16px',
                                        textAlign: 'center',
                                        border: '2px solid var(--brand)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--brand)',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 32,
                                        fontWeight: 700,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {nextUp.serialNo}
                                </div>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                    <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-heading)' }}>{nextUp.patientName}</p>
                                    <p style={{ marginTop: 2, fontSize: 13, color: 'var(--text-muted)' }}>
                                        {nextUp.age} yrs · {nextUp.gender} · {nextUp.startTime}–{nextUp.endTime}
                                    </p>
                                    {nextUp.notes && (
                                        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-body)' }}>“{nextUp.notes}”</p>
                                    )}
                                    <div style={{ marginTop: 8 }}>
                                        <StatusBadge status={nextUp.status} />
                                    </div>
                                </div>
                                {nextUp.status === 'checked_in' ? (
                                    <Button icon="check" loading={isCompleting} onClick={() => markComplete(nextUp)}>
                                        Mark seen
                                    </Button>
                                ) : (
                                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Not at the desk yet</span>
                                )}
                            </div>
                        ) : (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {today.total === 0 ? 'You have no appointments today.' : 'Everyone booked today has been seen.'}
                            </p>
                        )}
                    </Panel>

                    <Panel title="Today's queue" subtitle="In serial order" padding="0">
                        <DataTable<DoctorQueueEntry & { id: string }>
                            minWidth="30rem"
                            empty="No appointments today."
                            rows={queue.map((entry) => ({ ...entry, id: entry._id }))}
                            columns={[
                                {
                                    key: 'serial',
                                    header: 'Serial',
                                    mono: true,
                                    render: (entry) => <span style={{ fontWeight: 700, color: 'var(--brand)' }}>#{entry.serialNo}</span>,
                                },
                                {
                                    key: 'time',
                                    header: 'Time',
                                    render: (entry) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.startTime}</span>,
                                },
                                {
                                    key: 'patient',
                                    header: 'Patient',
                                    render: (entry) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{entry.patientName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                                {entry.age} · {entry.gender}
                                            </p>
                                        </div>
                                    ),
                                },
                                { key: 'status', header: 'Status', render: (entry) => <StatusBadge status={entry.status} /> },
                                {
                                    key: 'actions',
                                    header: '',
                                    align: 'right',
                                    render: (entry) =>
                                        entry.status === 'checked_in' ? (
                                            <Button size="sm" icon="check" disabled={isCompleting} onClick={() => markComplete(entry)}>
                                                Seen
                                            </Button>
                                        ) : null,
                                },
                            ]}
                        />
                    </Panel>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
                    <Panel
                        title="Waiting for your answer"
                        subtitle="Schedules the admin has proposed"
                        style={pendingSchedules.length > 0 ? { borderColor: 'var(--warning-strong)' } : undefined}
                    >
                        {pendingSchedules.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing is waiting for you.</p>
                        ) : (
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
                                {pendingSchedules.map((schedule) => (
                                    <li
                                        key={schedule._id}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                                    >
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{formatDate(schedule.date)}</p>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {schedule.startTime}–{schedule.endTime} · {schedule.slotCount} patients × {schedule.slotMinutes} min
                                            </p>
                                        </div>
                                        <span style={{ display: 'inline-flex', gap: 8 }}>
                                            <Button size="sm" icon="check" onClick={() => approve(schedule._id)}>
                                                Approve
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => askDecline(schedule)}>
                                                Decline
                                            </Button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <ApprovedSchedules />

                    <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {completedLast30} consultation{completedLast30 === 1 ? '' : 's'} completed in the last 30 days ·{' '}
                        <Link to="/appointments">All appointments</Link> · <Link to="/schedules">All schedules</Link>
                    </p>
                </div>
            </div>

            <ReasonModal request={reasonRequest} busy={isDeclining} onClose={() => setReasonRequest(null)} />
        </>
    );
};

export default DoctorDashboardPage;
