import { Link, useNavigate, useParams } from 'react-router-dom';
import { useT } from '@/i18n/useLanguage';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import Panel from '@/components/ui/Panel';
import { useRole } from '@/hooks/useRole';
import { formatDate, money } from '@/lib/format';
import { useGetPatientHistoryQuery } from '@/services/invoicesApi';

/** Report state is a dot on the test chip: grey queued, blue uploaded, teal delivered. */
const REPORT_DOT: Record<string, string> = {
    delivered: 'var(--success)',
    uploaded: 'var(--brand)',
};

const PatientDetailPage = () => {
    const t = useT();
    const { id } = useParams();
    const { isAdmin } = useRole();
    const navigate = useNavigate();

    const { data, isLoading, isError, refetch } = useGetPatientHistoryQuery(id!);

    if (isLoading) return <Loader message={t('ld.visitHistory')} />;
    if (isError || !data) {
        return <ErrorState title={t('err.patient')} description={t('err.historyGone')} onRetry={refetch} />;
    }

    const { patient, invoices } = data;

    const totals = invoices.reduce(
        (acc, invoice) => ({
            billed: acc.billed + invoice.netPayable,
            paid: acc.paid + invoice.paidAmount,
            due: acc.due + invoice.dueAmount,
        }),
        { billed: 0, paid: 0, due: 0 },
    );

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{patient.name}</h2>
                        <span
                            style={{
                                background: 'var(--brand-light)',
                                color: 'var(--brand-dark)',
                                borderRadius: 'var(--radius-xs)',
                                padding: '3px 10px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            {patient.patientId}
                        </span>
                    </div>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {patient.age} years · {patient.gender} · {patient.phone}
                        {patient.address ? ` · ${patient.address}` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="secondary" icon="pencil" onClick={() => navigate(`/patients/${patient._id}/edit`)}>
                        {t('ctrl.edit')}
                    </Button>
                    <Button icon="plus" onClick={() => navigate(`/billing/new?patient=${patient._id}`)}>
                        {t('jsx.newVisit')}
                    </Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                <StatCard label={t('fld.visits')} value={invoices.length} icon="clipboard-list" />
                <StatCard label={t('fld.totalPaid')} value={money(totals.paid)} icon="banknote" accent="accent" />
                <StatCard
                    label={t('fld.outstanding')}
                    value={money(totals.due)}
                    icon="triangle-alert"
                    accent={totals.due > 0 ? 'danger' : 'neutral'}
                />
            </div>

            <Panel title={t('ttl.visitHistory')} subtitle={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'} on file`}>
                {invoices.length === 0 ? (
                    <p
                        style={{
                            border: '1px dashed var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-8)',
                            textAlign: 'center',
                            fontSize: 'var(--text-13)',
                            color: 'var(--text-muted)',
                        }}
                    >
                        {t('jsx.noVisitsPatient')}
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {invoices.map((invoice) => (
                            <article
                                key={invoice._id}
                                style={{
                                    border: `1px solid ${invoice.isCancelled ? 'var(--rose-100)' : 'var(--border-card)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-4)',
                                    opacity: invoice.isCancelled ? 0.7 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <Link to={`/billing/${invoice._id}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                                            {invoice.invoiceNumber}
                                        </Link>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(invoice.visitDate)}</span>
                                        <StatusBadge status={invoice.isCancelled ? 'cancelled' : invoice.paymentStatus} />
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 18,
                                            fontSize: 13,
                                            fontVariantNumeric: 'tabular-nums',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        {/* Gross and discount are withheld from receptionists. */}
                                        {isAdmin && invoice.discountAmount !== undefined && invoice.discountAmount > 0 && (
                                            <span style={{ color: 'var(--warning-strong)' }}>Discount {money(invoice.discountAmount)}</span>
                                        )}
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            Payable <strong style={{ color: 'var(--text-heading)' }}>{money(invoice.netPayable)}</strong>
                                        </span>
                                        {invoice.dueAmount > 0 && (
                                            <span style={{ color: 'var(--danger-strong)', fontWeight: 600 }}>Due {money(invoice.dueAmount)}</span>
                                        )}
                                    </div>
                                </div>

                                <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {invoice.items.map((item) => (
                                        <li
                                            key={item._id}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                background: 'var(--surface-muted)',
                                                borderRadius: 'var(--radius-pill)',
                                                padding: '4px 12px',
                                                fontSize: 12,
                                                color: 'var(--text-body)',
                                            }}
                                        >
                                            {item.testName}
                                            <span
                                                title={`Report ${item.reportStatus}`}
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: REPORT_DOT[item.reportStatus] ?? 'var(--slate-300)',
                                                }}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                )}
            </Panel>
        </>
    );
};

export default PatientDetailPage;
