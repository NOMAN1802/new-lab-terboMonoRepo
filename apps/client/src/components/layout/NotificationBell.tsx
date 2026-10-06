import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { useCancelOutcomes } from '@/hooks/useCancelOutcomes';
import { useCancelRequests } from '@/hooks/useCancelRequests';
import { usePatientsToInform } from '@/hooks/usePatientsToInform';
import { useUnpaidInvoices } from '@/hooks/useUnpaidInvoices';
import { formatDate, money, toDhakaDateInput } from '@/lib/format';
import { useAcknowledgeCancelOutcomesMutation } from '@/services/appointmentsApi';
import Icon from '@/components/ui/Icon';
import { useT } from '@/i18n/useLanguage';

const PREVIEW = 5;

/**
 * The design draws a bell with a count. There is no notifications feed, so it
 * is wired to what genuinely needs attention: invoices still carrying a
 * balance, for an admin the cancellation requests waiting for an answer, and
 * for a receptionist the answers to the requests they raised.
 */
const NotificationBell = () => {
    const t = useT();
    const navigate = useNavigate();
    const { invoices, total: unpaidTotal } = useUnpaidInvoices(PREVIEW);
    const { requests, total: requestTotal } = useCancelRequests();
    const { outcomes, total: outcomeTotal } = useCancelOutcomes();
    const { patients: toInform, total: informTotal } = usePatientsToInform();
    const [acknowledge] = useAcknowledgeCancelOutcomesMutation();
    const total = unpaidTotal + requestTotal + outcomeTotal + informTotal;

    // Opening an answer marks it read, so the count falls as the desk works through them.
    const openOutcome = (outcome: (typeof outcomes)[number]) => {
        void acknowledge({ ids: [outcome._id] });
        navigate(`/appointments?date=${toDhakaDateInput(new Date(outcome.date))}`);
    };

    return (
        <Menu as="div" style={{ position: 'relative' }}>
            <Menu.Button
                aria-label={`${total} notifications`}
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    border: '1px solid var(--border-card)',
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'var(--transition-control)',
                }}
            >
                <Icon name="bell" size={18} />
                {total > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            minWidth: '18px',
                            height: '18px',
                            padding: '0 5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--danger-strong)',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                            lineHeight: 1,
                        }}
                    >
                        {total > 99 ? '99+' : total}
                    </span>
                )}
            </Menu.Button>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        width: '320px',
                        maxWidth: 'calc(100vw - 24px)',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-pop)',
                        overflow: 'hidden',
                        zIndex: 60,
                        outline: 'none',
                    }}
                >
                    {informTotal > 0 && (
                        <>
                            <div
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: 'var(--danger-bg)',
                                    borderBottom: '1px solid var(--border-card)',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 'var(--text-13)',
                                        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                        color: 'var(--text-heading)',
                                    }}
                                >
                                    Patients to inform
                                </p>
                                <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                    {informTotal} cancelled by the doctor, still to be phoned
                                </p>
                            </div>

                            {toInform.map((appointment) => (
                                <Menu.Item key={appointment._id}>
                                    {({ active }) => (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/appointments?callbacks=1')}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px var(--space-4)',
                                                border: 0,
                                                background: active ? 'var(--surface-sunken)' : 'transparent',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontFamily: 'var(--font-sans)',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontSize: 'var(--text-13)',
                                                    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                                    color: 'var(--text-heading)',
                                                }}
                                            >
                                                {appointment.patientInfo.name} · {appointment.patientInfo.phone}
                                            </span>
                                            <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                                {formatDate(appointment.date)} {appointment.startTime} · {appointment.doctor.name}
                                            </span>
                                            <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--danger-strong)' }}>
                                                {appointment.callback?.reason}
                                            </span>
                                        </button>
                                    )}
                                </Menu.Item>
                            ))}

                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        type="button"
                                        onClick={() => navigate('/appointments?callbacks=1')}
                                        style={{
                                            width: '100%',
                                            padding: '10px var(--space-4)',
                                            border: 0,
                                            borderTop: '1px solid var(--border-card)',
                                            background: active ? 'var(--surface-sunken)' : 'transparent',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: 'var(--text-12)',
                                            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                            color: 'var(--brand)',
                                        }}
                                    >
                                        See patients to phone
                                    </button>
                                )}
                            </Menu.Item>
                        </>
                    )}

                    {outcomeTotal > 0 && (
                        <>
                            <div
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: 'var(--brand-light)',
                                    borderBottom: '1px solid var(--border-card)',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 'var(--text-13)',
                                        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                        color: 'var(--text-heading)',
                                    }}
                                >
                                    Your cancellation requests
                                </p>
                                <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                    {outcomeTotal} answered by an admin
                                </p>
                            </div>

                            {outcomes.map((outcome) => {
                                const approved = outcome.cancellation?.status === 'approved';
                                return (
                                    <Menu.Item key={outcome._id}>
                                        {({ active }) => (
                                            <button
                                                type="button"
                                                onClick={() => openOutcome(outcome)}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    padding: '10px var(--space-4)',
                                                    border: 0,
                                                    background: active ? 'var(--surface-sunken)' : 'transparent',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontFamily: 'var(--font-sans)',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: 'block',
                                                        fontSize: 'var(--text-13)',
                                                        fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                                        color: 'var(--text-heading)',
                                                    }}
                                                >
                                                    {outcome.patientInfo.name} · serial {outcome.serialNo}
                                                </span>
                                                <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                                    {formatDate(outcome.date)} {outcome.startTime} · {outcome.doctor.name}
                                                </span>
                                                <span
                                                    style={{
                                                        display: 'block',
                                                        fontSize: 'var(--text-12)',
                                                        color: approved ? 'var(--success-strong)' : 'var(--danger-strong)',
                                                    }}
                                                >
                                                    {approved
                                                        ? 'Approved: the appointment is cancelled'
                                                        : `Refused by ${outcome.cancellation?.reviewedByName ?? 'an admin'}${
                                                              outcome.cancellation?.reviewNote ? `: ${outcome.cancellation.reviewNote}` : ''
                                                          }`}
                                                </span>
                                            </button>
                                        )}
                                    </Menu.Item>
                                );
                            })}

                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        type="button"
                                        onClick={() => void acknowledge()}
                                        style={{
                                            width: '100%',
                                            padding: '10px var(--space-4)',
                                            border: 0,
                                            borderTop: '1px solid var(--border-card)',
                                            background: active ? 'var(--surface-sunken)' : 'transparent',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: 'var(--text-12)',
                                            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                            color: 'var(--brand)',
                                        }}
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </Menu.Item>
                        </>
                    )}

                    {requestTotal > 0 && (
                        <>
                            <div
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: 'var(--warning-bg)',
                                    borderBottom: '1px solid var(--border-card)',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 'var(--text-13)',
                                        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                        color: 'var(--text-heading)',
                                    }}
                                >
                                    Cancellation requests
                                </p>
                                <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                    {requestTotal} waiting for your decision
                                </p>
                            </div>

                            {requests.map((appointment) => (
                                <Menu.Item key={appointment._id}>
                                    {({ active }) => (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/appointments?requests=1')}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px var(--space-4)',
                                                border: 0,
                                                background: active ? 'var(--surface-sunken)' : 'transparent',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontFamily: 'var(--font-sans)',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontSize: 'var(--text-13)',
                                                    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                                    color: 'var(--text-heading)',
                                                }}
                                            >
                                                {appointment.patientInfo.name} · serial {appointment.serialNo}
                                            </span>
                                            <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                                {formatDate(appointment.date)} {appointment.startTime} · {appointment.doctor.name}
                                            </span>
                                            <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--warning-strong)' }}>
                                                {appointment.cancellation?.requestedByName}: {appointment.cancellation?.reason}
                                            </span>
                                        </button>
                                    )}
                                </Menu.Item>
                            ))}

                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        type="button"
                                        onClick={() => navigate('/appointments?requests=1')}
                                        style={{
                                            width: '100%',
                                            padding: '10px var(--space-4)',
                                            border: 0,
                                            borderTop: '1px solid var(--border-card)',
                                            background: active ? 'var(--surface-sunken)' : 'transparent',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: 'var(--text-12)',
                                            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                            color: 'var(--brand)',
                                        }}
                                    >
                                        Review cancellation requests
                                    </button>
                                )}
                            </Menu.Item>
                        </>
                    )}

                    <div
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            background: 'var(--surface-sunken)',
                            borderTop: requestTotal + outcomeTotal + informTotal > 0 ? '1px solid var(--border-card)' : undefined,
                            borderBottom: '1px solid var(--border-card)',
                        }}
                    >
                        <p
                            style={{
                                fontSize: 'var(--text-13)',
                                fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                color: 'var(--text-heading)',
                            }}
                        >
                            {t('shell.awaitingPayment')}
                        </p>
                        <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                            {unpaidTotal === 0 ? t('shell.allSettled') : `${unpaidTotal} · ${t('status.unpaid')}`}
                        </p>
                    </div>

                    {invoices.map((invoice) => (
                        <Menu.Item key={invoice._id}>
                            {({ active }) => (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/billing/${invoice._id}`)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        width: '100%',
                                        padding: '10px var(--space-4)',
                                        border: 0,
                                        background: active ? 'var(--surface-sunken)' : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontFamily: 'var(--font-sans)',
                                    }}
                                >
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: 'var(--text-13)',
                                                fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                                color: 'var(--text-heading)',
                                            }}
                                        >
                                            {invoice.invoiceNumber}
                                        </span>
                                        <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                            {invoice.patientInfo.name} · {formatDate(invoice.visitDate)}
                                        </span>
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 'var(--text-12)',
                                            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                            color: 'var(--danger-strong)',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {money(invoice.dueAmount)}
                                    </span>
                                </button>
                            )}
                        </Menu.Item>
                    ))}

                    <Menu.Item>
                        {({ active }) => (
                            <button
                                type="button"
                                onClick={() => navigate('/billing')}
                                style={{
                                    width: '100%',
                                    padding: '10px var(--space-4)',
                                    border: 0,
                                    borderTop: '1px solid var(--border-card)',
                                    background: active ? 'var(--surface-sunken)' : 'transparent',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 'var(--text-12)',
                                    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                    color: 'var(--brand)',
                                }}
                            >
                                {t('shell.viewAllInvoices')}
                            </button>
                        )}
                    </Menu.Item>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};

export default NotificationBell;
