import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import Panel from '@/components/ui/Panel';
import DataTable from '@/components/ui/DataTable';
import SegmentedControl from '@/components/ui/SegmentedControl';
import AreaTrendChart from '@/components/ui/AreaTrendChart';
import GaugeMeter from '@/components/ui/GaugeMeter';
import Icon from '@/components/ui/Icon';
import { useAppSelector } from '@/hooks/store';
import { useT } from '@/i18n/useLanguage';
import { formatDate, formatDateTime, money, toDhakaDateInput } from '@/lib/format';
import { isAdminDashboard, useGetDashboardQuery } from '@/services/dashboardApi';
import type { ReferrerSummaryRow } from '@/services/dashboardApi';
import { useGetInvoicesQuery } from '@/services/invoicesApi';
import type { Invoice } from '@/services/invoicesApi';
import type { TranslationKey } from '@/i18n/translations';

const RECENT_INVOICES = 6;

const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return toDhakaDateInput(date);
};

const RANGES: { key: TranslationKey; value: string }[] = [
    // 0 = today only: daysAgo(0) is today, and the range is inclusive of both
    // ends, so start and end land on the same Dhaka day.
    { key: 'ctrl.today', value: '0' },
    { key: 'ctrl.7days', value: '6' },
    { key: 'ctrl.30days', value: '29' },
    { key: 'ctrl.90days', value: '89' },
];

/** Axis labels stay short: the API sends a full ISO day per point. */
const shortDay = (iso: string) => {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? iso : formatDate(parsed).replace(/,.*$/, '');
};

const compactMoney = (value: number) => `৳${Math.round(value / 1000)}K`;

const DashboardPage = () => {
    const user = useAppSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const t = useT();
    const [rangeDays, setRangeDays] = useState(29);

    const { data, isLoading, isError, refetch } = useGetDashboardQuery({
        startDate: daysAgo(rangeDays),
        endDate: toDhakaDateInput(),
        groupBy: 'daily',
    });

    // The dashboard payload carries no invoice list of its own.
    const { data: recentInvoices } = useGetInvoicesQuery({ limit: RECENT_INVOICES, sortBy: '-visitDate' });

    if (isLoading) return <Loader message={t('dash.loading')} />;
    if (isError || !data) {
        return <ErrorState title={t('dash.loadError')} onRetry={refetch} />;
    }

    const greeting = `${t('dash.greeting')}, ${user?.name?.split(' ')[0] ?? ''}`.trim();

    // ---- Receptionist view: operational only, no revenue figures ----
    if (!isAdminDashboard(data)) {
        return (
            <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{greeting}</h2>
                        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                            {t('dash.todayAtCentre')} · {formatDate(new Date())} · Asia/Dhaka
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="secondary" icon="user-round-plus" onClick={() => navigate('/patients/new')}>
                            {t('patients.register')}
                        </Button>
                        <Button icon="plus" onClick={() => navigate('/billing/new')}>
                            {t('invoices.newBooking')}
                        </Button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                    <StatCard label={t('dash.bookingsToday')} value={data.today.bookings} icon="clipboard-list" />
                    <StatCard label={t('dash.myCollection')} value={money(data.today.myCollection)} icon="banknote" accent="accent" />
                    <StatCard label={t('dash.reportsPending')} value={data.reports.pending} icon="file-text" accent="warning" />
                    <StatCard label={t('dash.reportsDelivered')} value={data.reports.delivered} icon="file-text" accent="brand" />
                </div>

                <Panel title={t('dash.outstandingPayments')} subtitle={t('dash.outstandingBody')}>
                    {data.pendingPayments.length === 0 ? (
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
                            {t('dash.nothingOutstanding')}
                        </p>
                    ) : (
                        <DataTable
                            minWidth="46rem"
                            rows={data.pendingPayments.map((invoice) => ({ ...invoice, id: invoice._id }))}
                            columns={[
                                {
                                    key: 'invoiceNumber',
                                    header: t('col.invoice'),
                                    mono: true,
                                    render: (row) => (
                                        <Link to={`/billing/${row._id}`} style={{ fontWeight: 600 }}>
                                            {row.invoiceNumber}
                                        </Link>
                                    ),
                                },
                                {
                                    key: 'patient',
                                    header: t('col.patient'),
                                    render: (row) => (
                                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.patientInfo.name}</span>
                                    ),
                                },
                                { key: 'visitDate', header: t('col.date'), render: (row) => formatDate(row.visitDate) },
                                { key: 'paymentStatus', header: t('col.status'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
                                {
                                    key: 'dueAmount',
                                    header: t('col.due'),
                                    align: 'right',
                                    render: (row) => (
                                        <span style={{ fontWeight: 600, color: 'var(--danger-strong)' }}>{money(row.dueAmount)}</span>
                                    ),
                                },
                            ]}
                        />
                    )}
                </Panel>
            </>
        );
    }

    // ---- Admin view: full financial overview ----
    const trend = data.trend.map((point) => ({ label: shortDay(point._id), value: point.collected }));
    const rangeLabel = t(RANGES.find((range) => Number(range.value) === rangeDays)?.key ?? 'ctrl.30days');

    // Collection rate is derived, not stored: cash in over what was actually billed.
    const collectionRate = data.period.net > 0 ? (data.period.collected / data.period.net) * 100 : 0;
    // Every non-cancelled test booked in the window, so "pending" reads as a
    // share of the workload rather than as a bare number.
    const totalTests =
        data.period.reports.pending + data.period.reports.uploaded + data.period.reports.delivered;

    // The API already sends five; the slice keeps the panel honest if that changes.
    const recentActivity = data.recentActivity.slice(0, 5);

    const tiles: [string, string, string][] = [
        [t('dash.collectedInPeriod'), money(data.period.collected), 'var(--brand)'],
        [t('dash.revenueLessCommission'), money(data.period.revenue), 'var(--accent)'],
        [t('dash.discountsGiven'), money(data.period.discount), 'var(--warning)'],
    ];

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{greeting}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('dash.financialOverview')} · {formatDate(new Date())} · Asia/Dhaka
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <SegmentedControl options={RANGES.map((r) => ({ label: t(r.key), value: r.value }))} value={String(rangeDays)} onChange={(value) => setRangeDays(Number(value))} />
                    <Button icon="plus" onClick={() => navigate('/billing/new')}>
                        {t('invoices.newBooking')}
                    </Button>
                </div>
            </div>

            {/* Fixed at three columns rather than auto-fit, so the six tiles
                always read as two rows of three instead of reflowing to 4+2. */}
            <div className="stat-grid-3">
                <StatCard
                    label={t('dash.collectedRange')}
                    value={money(data.period.collected)}
                    icon="banknote"
                    accent="accent"
                    caption={rangeLabel}
                />
                <StatCard
                    label={t('dash.bookingsRange')}
                    value={data.period.invoiceCount}
                    icon="clipboard-list"
                    caption={rangeLabel}
                />
                <StatCard
                    label={t('dash.newPatientsRange')}
                    value={data.period.newPatients}
                    icon="user-round-plus"
                    accent="brand"
                    caption={rangeLabel}
                />
                <StatCard
                    label={t('dash.totalPaid')}
                    value={money(data.period.paid)}
                    icon="circle-check"
                    accent="accent"
                    caption={`${t('dash.ofTests')} ${money(data.period.net)} ${t('dash.invoicesSettled')}`}
                />
                <StatCard
                    label={t('dash.pendingReport')}
                    value={data.period.reports.pending}
                    icon="file-text"
                    accent="warning"
                    caption={`${t('dash.ofTests')} ${totalTests} ${t('dash.testsWord')}`}
                />
                <StatCard
                    label={t('dash.totalOutstanding')}
                    value={money(data.period.due)}
                    icon="triangle-alert"
                    accent="danger"
                    caption={`${t('dash.acrossInvoices')} ${data.outstanding.invoiceCount} ${t('dash.invoicesWord')}`}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                <Panel
                    title={t('dash.cashCollected')}
                    subtitle={`${t('dash.last')} ${rangeLabel} · ${t('dash.groupedOn')}`}
                    action={
                        <span
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: 'var(--text-heading)',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {money(data.period.collected)}
                        </span>
                    }
                >
                    {trend.length === 0 ? (
                        <p style={{ padding: '48px 0', textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>
                            {t('jsx.noPaymentsPeriod')}
                        </p>
                    ) : (
                        <AreaTrendChart data={trend} height={214} valueFormat={(v) => compactMoney(Number(v))} />
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12, marginTop: 18 }}>
                        {tiles.map(([label, value, color]) => (
                            <div
                                key={label}
                                style={{
                                    border: '1px solid var(--border-card)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px 14px',
                                    borderBottom: `3px solid ${color}`,
                                }}
                            >
                                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>
                                    {value}
                                </p>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
                            </div>
                        ))}
                    </div>
                </Panel>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
                    <Panel title={t('dash.collectionRate')} subtitle={t('dash.collectionRateBody')}>
                        <GaugeMeter value={collectionRate} size={210} caption={`${money(data.period.collected)} of ${money(data.period.net)}`} />
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                            <Button variant="secondary" size="sm" onClick={() => navigate('/reports/financial')}>
                                {t('dash.showDetails')}
                            </Button>
                        </div>
                    </Panel>
                    <Panel title={t('dash.commission')} subtitle={t('dash.commissionBody')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                [t('dash.accrued'), money(data.commission.accrued), 'var(--text-heading)'],
                                [t('dash.paidOut'), money(data.commission.paid), 'var(--success-strong)'],
                                [t('dash.pending'), money(data.commission.pending), 'var(--warning-strong)'],
                            ].map(([label, value, color]) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                                    <span style={{ fontSize: 15, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>

            <Panel
                title={t('dash.recentInvoices')}
                action={
                    <Link to="/billing" style={{ fontSize: 12, fontWeight: 600 }}>
                        {t('dash.viewAll')}
                    </Link>
                }
            >
                <DataTable<Invoice & { id: string }>
                    dense
                    minWidth="52rem"
                    empty={t('dash.noInvoices')}
                    rows={(recentInvoices?.items ?? []).map((invoice) => ({ ...invoice, id: invoice._id }))}
                    onRowClick={(row) => navigate(`/billing/${row._id}`)}
                    columns={[
                        {
                            key: 'invoiceNumber',
                            header: t('col.invoice'),
                            render: (row) => (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>
                                    {row.invoiceNumber}
                                </span>
                            ),
                        },
                        { key: 'visitDate', header: t('col.date'), render: (row) => formatDate(row.visitDate) },
                        {
                            key: 'patientInfo',
                            header: t('col.patient'),
                            render: (row) => (
                                <div>
                                    <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.patientInfo.name}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                                        {row.patientInfo.patientId} · {row.patientInfo.phone}
                                    </p>
                                </div>
                            ),
                        },
                        {
                            key: 'referrerInfo',
                            header: t('col.referrer'),
                            render: (row) =>
                                row.referrerInfo ? (
                                    row.referrerInfo.name
                                ) : (
                                    <span style={{ color: 'var(--text-faint)' }}>{t('col.walkIn')}</span>
                                ),
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
                                <span style={{ color: row.dueAmount > 0 ? 'var(--danger-strong)' : 'var(--text-faint)', fontWeight: 600 }}>
                                    {money(row.dueAmount)}
                                </span>
                            ),
                        },
                        {
                            key: 'paymentStatus',
                            header: t('col.status'),
                            render: (row) => <StatusBadge status={row.paymentStatus} />,
                        },
                    ]}
                />
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                <Panel title={t('dash.topReferrers')} subtitle={t('dash.topReferrersBody')}>
                    <DataTable<ReferrerSummaryRow & { id: string }>
                        dense
                        minWidth="30rem"
                        empty={t('dash.noReferred')}
                        rows={data.byReferrer.slice(0, 8).map((row) => ({ ...row, id: row._id }))}
                        columns={[
                            {
                                key: 'referrerName',
                                header: t('col.referrer'),
                                render: (row) => (
                                    <div>
                                        <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.referrerName}</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{row.referrerCode}</p>
                                    </div>
                                ),
                            },
                            { key: 'invoiceCount', header: t('col.invoices'), align: 'right' },
                            { key: 'net', header: t('col.net'), align: 'right', render: (row) => money(row.net) },
                            {
                                key: 'commission',
                                header: t('col.commission'),
                                align: 'right',
                                render: (row) => (
                                    <span style={{ color: 'var(--warning-strong)', fontWeight: 600 }}>{money(row.commission)}</span>
                                ),
                            },
                        ]}
                    />
                </Panel>

                <Panel
                    title={t('dash.recentActivity')}
                    action={
                        <Link to="/activity" style={{ fontSize: 12, fontWeight: 600 }}>
                            {t('dash.viewAll')}
                        </Link>
                    }
                >
                    {recentActivity.length === 0 ? (
                        <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>
                            {t('dash.nothingRecorded')}
                        </p>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                            {recentActivity.map((entry, i) => (
                                <li
                                    key={entry._id}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        padding: '11px 0',
                                        borderBottom: i === recentActivity.length - 1 ? 'none' : '1px solid var(--surface-muted)',
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 28,
                                            height: 28,
                                            borderRadius: 8,
                                            background: 'var(--surface-muted)',
                                            color: 'var(--text-muted)',
                                            flex: '0 0 auto',
                                        }}
                                    >
                                        <Icon name="history" size={15} />
                                    </span>
                                    <div>
                                        <p style={{ fontSize: 13, color: 'var(--text-body)' }}>{entry.summary}</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                            {entry.actorName} · {formatDateTime(entry.at)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </>
    );
};

export default DashboardPage;
