import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import ReasonModal from '@/components/common/ReasonModal';
import type { ReasonRequest } from '@/components/common/ReasonModal';
import StatusBadge from '@/components/common/StatusBadge';
import RefundModal from '@/pages/billing/RefundModal';
import type { RefundTarget } from '@/pages/billing/RefundModal';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import DataTable from '@/components/ui/DataTable';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { apiErrorMessage, formatDate, money, toDhakaDateInput } from '@/lib/format';
import {
    useCancelAppointmentMutation,
    useCheckInAppointmentMutation,
    useCompleteAppointmentMutation,
    useGetAppointmentsQuery,
    useApproveCancelAppointmentMutation,
    useMarkInformedMutation,
    useNoShowAppointmentMutation,
    useRejectCancelAppointmentMutation,
    useRequestCancelAppointmentMutation,
} from '@/services/appointmentsApi';
import type { Appointment, AppointmentStatus } from '@/services/appointmentsApi';
import { useGetDoctorsQuery } from '@/services/doctorsApi';

type Filter = AppointmentStatus | 'all';

const FILTERS: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Booked', value: 'booked' },
    { label: 'Checked in', value: 'checked_in' },
    { label: 'Completed', value: 'completed' },
    { label: 'No-show', value: 'no_show' },
    { label: 'Cancelled', value: 'cancelled' },
];

/** Money still on the appointment invoice, which a cancellation has to hand back. */
const paidOn = (appointment: Appointment): number =>
    appointment.invoice && !appointment.invoice.isCancelled ? appointment.invoice.paidAmount : 0;

const AppointmentsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAdmin, isDoctor } = useRole();
    const isDesk = !isDoctor;

    const [date, setDate] = useState(searchParams.get('date') ?? toDhakaDateInput());
    const [doctor, setDoctor] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);
    // Admin shortcut: every request waiting for an answer, on any day.
    const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);
    const [requestsOnly, setRequestsOnly] = useState(isAdmin && searchParams.get('requests') === '1');
    // Desk shortcut: patients whose appointment the doctor cancelled and who still have to be told.
    const [callbacksOnly, setCallbacksOnly] = useState(!isDoctor && searchParams.get('callbacks') === '1');

    const { data, isLoading, isError, refetch } = useGetAppointmentsQuery(
        requestsOnly
            ? { cancelRequest: 'pending' }
            : callbacksOnly
              ? { callback: 'pending' }
              : {
                  date: date || undefined,
                  status: filter === 'all' ? undefined : filter,
                  doctor: doctor || undefined,
                  search: search.trim() || undefined,
              }
    );
    // Only an admin answers requests, so only an admin needs the count.
    const { data: waiting } = useGetAppointmentsQuery({ cancelRequest: 'pending', limit: 1 }, { skip: !isAdmin });
    const waitingCount = waiting?.meta.total ?? 0;
    const { data: toPhone } = useGetAppointmentsQuery({ callback: 'pending', limit: 1 }, { skip: isDoctor });
    const toPhoneCount = toPhone?.meta.total ?? 0;
    const focusOnly = requestsOnly || callbacksOnly;
    // A doctor has no access to the doctor list, and asking would force a logout.
    const { data: doctorData } = useGetDoctorsQuery(undefined, { skip: isDoctor });
    const [checkIn] = useCheckInAppointmentMutation();
    const [noShow] = useNoShowAppointmentMutation();
    const [complete] = useCompleteAppointmentMutation();
    const [cancel, { isLoading: isCancelling }] = useCancelAppointmentMutation();
    const [requestCancel, { isLoading: isRequesting }] = useRequestCancelAppointmentMutation();
    const [approveCancel] = useApproveCancelAppointmentMutation();
    const [markInformed] = useMarkInformedMutation();
    const [rejectCancel, { isLoading: isRefusing }] = useRejectCancelAppointmentMutation();

    const appointments = data?.items ?? [];
    const doctors = (doctorData?.items ?? []).filter((item) => item.isActive);

    const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
        try {
            await action();
            toast.success(success);
        } catch (error) {
            toast.error(apiErrorMessage(error, failure));
        }
    };

    const askCancel = (appointment: Appointment) =>
        setReasonRequest({
            title: 'Cancel this appointment',
            description: `${appointment.patientInfo.name} · serial ${appointment.serialNo} · ${appointment.startTime}`,
            warning:
                paidOn(appointment) > 0
                    ? `${money(paidOn(appointment))} already paid will be refunded to the patient. The slot goes back on offer.`
                    : 'The slot goes back on offer for someone else.',
            confirmLabel: paidOn(appointment) > 0 ? `Cancel and refund ${money(paidOn(appointment))}` : 'Cancel appointment',
            onConfirm: async (reason) => {
                try {
                    await cancel({ id: appointment._id, reason, refund: paidOn(appointment) > 0 }).unwrap();
                    toast.success('Appointment cancelled');
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not cancel appointment'));
                }
            },
        });

    const askRequestCancel = (appointment: Appointment) =>
        setReasonRequest({
            title: 'Request cancellation',
            description: `${appointment.patientInfo.name} · serial ${appointment.serialNo} · ${appointment.startTime}`,
            warning: 'An admin has to approve this. The appointment stays booked until they do.',
            confirmLabel: 'Send request',
            onConfirm: async (reason) => {
                try {
                    await requestCancel({ id: appointment._id, reason }).unwrap();
                    toast.success('Request sent to an admin');
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not send the request'));
                }
            },
        });

    const askRefuse = (appointment: Appointment) =>
        setReasonRequest({
            title: 'Refuse this cancellation',
            description: `${appointment.patientInfo.name} · asked by ${appointment.cancellation?.requestedByName}: ${appointment.cancellation?.reason}`,
            warning: 'The appointment stays booked. The desk sees your reason.',
            confirmLabel: 'Refuse request',
            onConfirm: async (note) => {
                try {
                    await rejectCancel({ id: appointment._id, note }).unwrap();
                    toast.success('Request refused');
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not refuse the request'));
                }
            },
        });

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                        {isDoctor ? 'My appointments' : 'Appointments'}
                    </h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {isDoctor
                            ? 'Patients who have checked in are ready to be seen. Mark each consultation complete when done.'
                            : 'Check patients in as they arrive. Serial numbers follow the booked time.'}
                    </p>
                </div>
                {isDesk && (
                    <Button icon="plus" onClick={() => navigate('/appointments/new')}>
                        Book appointment
                    </Button>
                )}
            </div>

            {isAdmin && (waitingCount > 0 || requestsOnly) && (
                <InlineAlert tone="warning">
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span>
                            {requestsOnly
                                ? `Showing ${waitingCount} cancellation request${waitingCount === 1 ? '' : 's'} waiting for you, across all days.`
                                : `${waitingCount} cancellation request${waitingCount === 1 ? '' : 's'} waiting for your decision.`}
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => {
                                setRequestsOnly((current) => !current);
                                setCallbacksOnly(false);
                            }}>
                            {requestsOnly ? 'Back to the day' : 'Review requests'}
                        </Button>
                    </span>
                </InlineAlert>
            )}

            {!isDoctor && (toPhoneCount > 0 || callbacksOnly) && (
                <InlineAlert tone="warning">
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span>
                            {callbacksOnly
                                ? `Showing ${toPhoneCount} patient${toPhoneCount === 1 ? '' : 's'} whose appointment was cancelled by the doctor. Phone each one, then mark them informed.`
                                : `${toPhoneCount} patient${toPhoneCount === 1 ? '' : 's'} still to be told their appointment was cancelled.`}
                        </span>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setCallbacksOnly((current) => !current);
                                setRequestsOnly(false);
                            }}
                        >
                            {callbacksOnly ? 'Back to the day' : 'Show them'}
                        </Button>
                    </span>
                </InlineAlert>
            )}

            <div style={{ display: focusOnly ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%),1fr))', gap: 16 }}>
                <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} hint="Clear to see every day" />
                {isDesk && (
                    <Select
                        label="Doctor"
                        value={doctor}
                        placeholder="All doctors"
                        options={doctors.map((item) => ({ label: item.name, value: item._id }))}
                        onChange={(e) => setDoctor(e.target.value)}
                    />
                )}
                <TextField
                    label="Search"
                    icon="search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Patient, phone or number"
                />
            </div>

            <div style={{ overflowX: 'auto', display: focusOnly ? 'none' : 'block' }}>
                <SegmentedControl options={FILTERS} value={filter} onChange={(value) => setFilter(value as Filter)} />
            </div>

            {isLoading ? (
                <Loader message="Loading appointments..." />
            ) : isError ? (
                <ErrorState title="Could not load appointments" onRetry={refetch} />
            ) : (
                <Panel padding="0">
                    <DataTable<Appointment & { id: string }>
                        minWidth="52rem"
                        empty={date ? `No appointments on ${formatDate(date)}.` : 'No appointments found.'}
                        rows={appointments.map((appointment) => ({ ...appointment, id: appointment._id }))}
                        columns={[
                            {
                                key: 'serial',
                                header: 'Serial',
                                mono: true,
                                render: (appointment) => (
                                    <span style={{ fontWeight: 700, color: 'var(--brand)', opacity: appointment.status === 'cancelled' ? 0.5 : 1 }}>
                                        #{appointment.serialNo}
                                    </span>
                                ),
                            },
                            {
                                key: 'time',
                                header: date ? 'Time' : 'When',
                                render: (appointment) => (
                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                        {date ? '' : `${formatDate(appointment.date)} · `}
                                        {appointment.startTime}–{appointment.endTime}
                                    </span>
                                ),
                            },
                            {
                                key: 'patient',
                                header: 'Patient',
                                render: (appointment) => (
                                    <div>
                                        <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                                            {appointment.patientInfo.name}
                                        </p>
                                        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                            {appointment.patientInfo.patientId} · {appointment.patientInfo.phone}
                                        </p>
                                        {appointment.notes && (
                                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, maxWidth: 240 }}>{appointment.notes}</p>
                                        )}
                                    </div>
                                ),
                            },
                            ...(isDesk
                                ? [
                                      {
                                          key: 'doctor',
                                          header: 'Doctor',
                                          render: (appointment: Appointment) => (
                                              <div>
                                                  <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                                                      {appointment.doctor.name}
                                                  </p>
                                                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                                      {appointment.doctor.specialty}
                                                  </p>
                                              </div>
                                          ),
                                      },
                                      {
                                          key: 'billing',
                                          header: 'Fee',
                                          align: 'right' as const,
                                          render: (appointment: Appointment) => {
                                              const invoice = appointment.invoice;
                                              return (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                                      <span style={{ fontWeight: 600 }}>{money(appointment.fee)}</span>
                                                      {invoice && (
                                                          <>
                                                              <StatusBadge status={invoice.isCancelled ? 'cancelled' : invoice.paymentStatus} />
                                                              <Link
                                                                  to={`/billing/${invoice._id}`}
                                                                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                                                              >
                                                                  {invoice.invoiceNumber}
                                                              </Link>
                                                          </>
                                                      )}
                                                  </div>
                                              );
                                          },
                                      },
                                  ]
                                : []),
                            {
                                key: 'status',
                                header: 'Status',
                                render: (appointment) => (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                        <StatusBadge status={appointment.status} />
                                        {appointment.cancelReason && (
                                            <span style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 200 }}>{appointment.cancelReason}</span>
                                        )}
                                        {appointment.status !== 'cancelled' && appointment.cancellation?.status === 'pending' && (
                                            <span style={{ fontSize: 11, color: 'var(--warning-strong)', maxWidth: 220 }}>
                                                Cancel requested by {appointment.cancellation.requestedByName}: {appointment.cancellation.reason}
                                            </span>
                                        )}
                                        {appointment.status !== 'cancelled' && appointment.cancellation?.status === 'rejected' && (
                                            <span style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 220 }}>
                                                Cancel refused{appointment.cancellation.reviewNote ? `: ${appointment.cancellation.reviewNote}` : ''}
                                            </span>
                                        )}
                                        {isDesk && appointment.callback && !appointment.callback.doneAt && (
                                            <span style={{ fontSize: 11, color: 'var(--danger-strong)', maxWidth: 220 }}>
                                                Phone the patient: {appointment.patientInfo.phone}
                                            </span>
                                        )}
                                        {appointment.callback?.doneAt && (
                                            <span style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 220 }}>
                                                Patient informed{appointment.callback.doneByName ? ` by ${appointment.callback.doneByName}` : ''}
                                            </span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'actions',
                                header: 'Actions',
                                align: 'right',
                                render: (appointment) => (
                                    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {isAdmin && appointment.status === 'cancelled' && paidOn(appointment) > 0 && appointment.invoice && (
                                            <Button
                                                size="sm"
                                                icon="rotate-ccw"
                                                onClick={() =>
                                                    setRefundTarget({
                                                        _id: appointment.invoice!._id,
                                                        invoiceNumber: appointment.invoice!.invoiceNumber,
                                                        paidAmount: paidOn(appointment),
                                                        patientName: appointment.patientInfo.name,
                                                    })
                                                }
                                            >
                                                Refund {money(paidOn(appointment))}
                                            </Button>
                                        )}
                                        {isDesk && appointment.callback && !appointment.callback.doneAt && (
                                            <Button
                                                size="sm"
                                                icon="phone"
                                                onClick={() =>
                                                    run(
                                                        () => markInformed({ ids: [appointment._id] }).unwrap(),
                                                        `${appointment.patientInfo.name} marked as informed`,
                                                        'Could not mark as informed'
                                                    )
                                                }
                                            >
                                                Mark informed
                                            </Button>
                                        )}
                                        {isDesk &&
                                            appointment.invoice &&
                                            !appointment.invoice.isCancelled &&
                                            appointment.invoice.dueAmount > 0 &&
                                            appointment.status !== 'cancelled' && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    icon="credit-card"
                                                    onClick={() => navigate(`/billing/${appointment.invoice!._id}`)}
                                                >
                                                    Take {money(appointment.invoice.dueAmount)}
                                                </Button>
                                            )}
                                        {isDesk && appointment.status === 'booked' && (
                                            <Button
                                                size="sm"
                                                icon="check"
                                                onClick={() =>
                                                    run(
                                                        () => checkIn(appointment._id).unwrap(),
                                                        `${appointment.patientInfo.name} checked in`,
                                                        'Could not check in'
                                                    )
                                                }
                                            >
                                                Check in
                                            </Button>
                                        )}
                                        {(isDoctor || isAdmin) && appointment.status === 'checked_in' && (
                                            <Button
                                                size="sm"
                                                icon="check"
                                                onClick={() =>
                                                    run(
                                                        () => complete(appointment._id).unwrap(),
                                                        'Consultation completed',
                                                        'Could not complete'
                                                    )
                                                }
                                            >
                                                Complete
                                            </Button>
                                        )}
                                        {isDesk && appointment.status === 'booked' && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    run(
                                                        () => noShow(appointment._id).unwrap(),
                                                        'Marked as no-show',
                                                        'Could not mark as no-show'
                                                    )
                                                }
                                            >
                                                No-show
                                            </Button>
                                        )}
                                        {isDesk && (appointment.status === 'booked' || appointment.status === 'checked_in') && (
                                            appointment.cancellation?.status === 'pending' ? (
                                                isAdmin && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            icon="check"
                                                            onClick={() =>
                                                                run(
                                                                    () => approveCancel({ id: appointment._id, refund: paidOn(appointment) > 0 }).unwrap(),
                                                                    'Cancellation approved. The slot is free again.',
                                                                    'Could not approve the cancellation'
                                                                )
                                                            }
                                                        >
                                                            {paidOn(appointment) > 0 ? `Approve and refund ${money(paidOn(appointment))}` : 'Approve cancel'}
                                                        </Button>
                                                        <Button size="sm" variant="secondary" onClick={() => askRefuse(appointment)}>
                                                            Refuse
                                                        </Button>
                                                    </>
                                                )
                                            ) : isAdmin ? (
                                                <Button size="sm" variant="secondary" onClick={() => askCancel(appointment)}>
                                                    Cancel
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="secondary" onClick={() => askRequestCancel(appointment)}>
                                                    Request cancel
                                                </Button>
                                            )
                                        )}
                                        {isDesk && appointment.status !== 'cancelled' && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                icon="printer"
                                                aria-label={`Print slip for ${appointment.patientInfo.name}`}
                                                onClick={() => navigate(`/appointments/${appointment._id}/print`)}
                                            >
                                                Slip
                                            </Button>
                                        )}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </Panel>
            )}

            <ReasonModal request={reasonRequest} busy={isCancelling || isRequesting || isRefusing} onClose={() => setReasonRequest(null)} />

            <RefundModal target={refundTarget} defaultCancel onClose={() => setRefundTarget(null)} />
        </>
    );
};

export default AppointmentsPage;
