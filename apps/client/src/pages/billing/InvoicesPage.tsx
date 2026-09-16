import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import Panel from '@/components/ui/Panel';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TextField from '@/components/ui/TextField';
import Icon from '@/components/ui/Icon';
import { useT } from '@/i18n/useLanguage';
import { formatDate, money, toDhakaDateInput } from '@/lib/format';
import { useGetInvoicesQuery } from '@/services/invoicesApi';
import type { Invoice, PaymentStatus } from '@/services/invoicesApi';
import type { CSSProperties } from 'react';
import type { TranslationKey } from '@/i18n/translations';
import InvoiceViewModal from './InvoiceViewModal';
import TakePaymentModal from './TakePaymentModal';

const PAGE_SIZE = 20;

const actionIconStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: 0,
    background: 'transparent',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-control)',
};

const STATUS_FILTERS: { key: TranslationKey; value: PaymentStatus | '' }[] = [
    { key: 'ctrl.all', value: '' },
    { key: 'invoices.unpaid', value: 'unpaid' },
    { key: 'invoices.partiallyPaid', value: 'partial' },
    { key: 'invoices.paid', value: 'paid' },
];

const InvoicesPage = () => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<PaymentStatus | ''>('');
    const [date, setDate] = useState('');
    const [page, setPage] = useState(1);
    const [viewingId, setViewingId] = useState<string | null>(null);
    const [paying, setPaying] = useState<Invoice | null>(null);
    const navigate = useNavigate();
    const t = useT();

    const { data, isLoading, isFetching, isError, refetch } = useGetInvoicesQuery({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        paymentStatus: status || undefined,
        date: date || undefined,
    });

    const invoices = data?.items ?? [];
    const total = data?.meta.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const resetTo = (updater: () => void) => {
        updater();
        setPage(1);
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('invoices.title')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {total} {total === 1 ? t('invoices.one') : t('invoices.many')} · {invoices.length} {t('invoices.shown')}
                    </p>
                </div>
                <Button icon="plus" onClick={() => navigate('/billing/new')}>
                    {t('invoices.newBooking')}
                </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
                    <TextField
                        icon="search"
                        type="search"
                        value={search}
                        onChange={(e) => resetTo(() => setSearch(e.target.value))}
                        placeholder={t('invoices.searchPlaceholder')}
                    />
                </div>

                <TextField
                    type="date"
                    value={date}
                    max={toDhakaDateInput()}
                    onChange={(e) => resetTo(() => setDate(e.target.value))}
                    style={{ width: 180 }}
                />
                {date && (
                    <Button variant="ghost" size="sm" onClick={() => resetTo(() => setDate(''))}>
                        {t('invoices.clearDate')}
                    </Button>
                )}

                <SegmentedControl
                    options={STATUS_FILTERS.map((filter) => ({ label: t(filter.key), value: filter.value }))}
                    value={status}
                    onChange={(value) => resetTo(() => setStatus(value as PaymentStatus | ''))}
                />
            </div>

            {isLoading ? (
                <Loader message={t('invoices.loading')} />
            ) : isError ? (
                <ErrorState title={t('invoices.loadError')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<Invoice & { id: string }>
                            minWidth="56rem"
                            empty={t('invoices.noneMatch')}
                            rows={invoices.map((invoice) => ({ ...invoice, id: invoice._id }))}
                            columns={[
                                {
                                    key: 'invoiceNumber',
                                    header: t('col.invoice'),
                                    mono: true,
                                    render: (row) => (
                                        <Link to={`/billing/${row._id}`} style={{ fontWeight: 600, opacity: row.isCancelled ? 0.5 : 1 }}>
                                            {row.invoiceNumber}
                                        </Link>
                                    ),
                                },
                                { key: 'visitDate', header: t('col.date'), render: (row) => formatDate(row.visitDate) },
                                {
                                    key: 'patient',
                                    header: t('col.patient'),
                                    render: (row) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.patientInfo.name}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                                {row.patientInfo.patientId} · {row.patientInfo.phone}
                                            </p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'referrer',
                                    header: t('col.referrer'),
                                    render: (row) => row.referrerInfo?.name ?? <span style={{ color: 'var(--text-faint)' }}>{t('col.walkIn')}</span>,
                                },
                                { key: 'netPayable', header: t('col.payable'), align: 'right', render: (row) => money(row.netPayable) },
                                {
                                    key: 'paidAmount',
                                    header: t('col.paid'),
                                    align: 'right',
                                    render: (row) => <span style={{ color: 'var(--success-strong)' }}>{money(row.paidAmount)}</span>,
                                },
                                {
                                    key: 'dueAmount',
                                    header: t('col.due'),
                                    align: 'right',
                                    render: (row) => (
                                        <span style={{ fontWeight: 600, color: row.dueAmount > 0 ? 'var(--danger-strong)' : 'var(--text-faint)' }}>
                                            {money(row.dueAmount)}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'paymentStatus',
                                    header: t('col.status'),
                                    render: (row) => <StatusBadge status={row.isCancelled ? 'cancelled' : row.paymentStatus} />,
                                },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (row) => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                            <button
                                                type="button"
                                                aria-label={`View invoice ${row.invoiceNumber}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingId(row._id);
                                                }}
                                                style={actionIconStyle}
                                            >
                                                <Icon name="eye" size={16} />
                                            </button>
                                            {!row.isCancelled && row.dueAmount > 0 && (
                                                <button
                                                    type="button"
                                                    aria-label={`Take payment on ${row.invoiceNumber}`}
                                                    title={`${money(row.dueAmount)} due — take a payment`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPaying(row);
                                                    }}
                                                    style={{ ...actionIconStyle, color: 'var(--success-strong)' }}
                                                >
                                                    <Icon name="banknote" size={16} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                aria-label={`Print invoice ${row.invoiceNumber}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/billing/${row._id}/print`);
                                                }}
                                                style={actionIconStyle}
                                            >
                                                <Icon name="printer" size={16} />
                                            </button>
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </Panel>

                    <Pagination page={page} totalPages={totalPages} busy={isFetching} onChange={setPage} />
                </>
            )}

            <InvoiceViewModal invoiceId={viewingId} onClose={() => setViewingId(null)} />

            <TakePaymentModal invoice={paying} onClose={() => setPaying(null)} />
        </>
    );
};

export default InvoicesPage;
