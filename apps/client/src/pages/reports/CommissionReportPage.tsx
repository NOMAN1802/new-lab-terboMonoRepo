import { useState } from 'react';
import DateRangePicker from '@/components/common/DateRangePicker';
import { rangeForDays } from '@/lib/dateRange';
import ErrorState from '@/components/common/ErrorState';
import ExportButtons from '@/components/common/ExportButtons';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import DataTable from '@/components/ui/DataTable';
import Panel from '@/components/ui/Panel';
import { money } from '@/lib/format';
import { useT } from '@/i18n/useLanguage';
import type { TranslationKey } from '@/i18n/translations';
import { useGetReferralCommissionReportQuery } from '@/services/reportsApi';
import type { ReferralCommissionRow } from '@/services/reportsApi';

/** Export columns carry keys; header text is resolved at render. */
const COLUMN_DEFS: { key: TranslationKey; accessor: (row: ReferralCommissionRow) => string | number }[] = [
    { key: 'col.code', accessor: (r) => r.referrerCode },
    { key: 'col.referrer', accessor: (r) => r.referrerName },
    { key: 'crep.hospital', accessor: (r) => r.hospital ?? '' },
    { key: 'col.invoices', accessor: (r) => r.invoiceCount },
    { key: 'crep.grossBilled', accessor: (r) => r.grossBilled },
    { key: 'crep.discountGiven', accessor: (r) => r.discountGiven },
    { key: 'rep.netBilled', accessor: (r) => r.netBilled },
    { key: 'rep.commissionAccrued', accessor: (r) => r.commissionAccrued },
    { key: 'crep.commissionAwaiting', accessor: (r) => r.commissionAwaiting },
    { key: 'crep.commissionPaid', accessor: (r) => r.commissionPaid },
    { key: 'crep.commissionPending', accessor: (r) => r.commissionPending },
];

const CommissionReportPage = () => {
    const [range, setRange] = useState(rangeForDays(29));
    const t = useT();
    const { data, isLoading, isError, refetch } = useGetReferralCommissionReportQuery(range);

    const columns = COLUMN_DEFS.map((column) => ({ header: t(column.key), accessor: column.accessor }));

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('crep.title')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', maxWidth: 620 }}>
                        {t('crep.subtitle')}
                    </p>
                </div>
                <ExportButtons
                    title={t('crep.exportTitle')}
                    subtitle={`${range.startDate} to ${range.endDate}`}
                    filename={`commission-${range.startDate}-to-${range.endDate}`}
                    columns={columns}
                    rows={data?.rows ?? []}
                />
            </div>

            <DateRangePicker value={range} onChange={setRange} />

            {isLoading ? (
                <Loader message={t('crep.loading')} />
            ) : isError || !data ? (
                <ErrorState title={t('crep.loadError')} onRetry={refetch} />
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <StatCard label={t('crep.referrers')} value={data.summary.referrers} icon="user-round-search" accent="brand" />
                        <StatCard label={t('rep.discountsGiven')} value={money(data.summary.discountGiven)} icon="percent" accent="neutral" />
                        <StatCard
                            label={t('rep.commissionAccrued')}
                            value={money(data.summary.commissionAccrued)}
                            icon="banknote"
                            accent="neutral"
                            caption={
                                data.summary.commissionAwaiting > 0
                                    ? `+ ${money(data.summary.commissionAwaiting)} ${t('comm.awaiting')}`
                                    : undefined
                            }
                        />
                        <StatCard label={t('crep.commissionPending')} value={money(data.summary.commissionPending)} icon="hourglass" accent="warning" />
                    </div>

                    <Panel padding="0">
                        <DataTable<ReferralCommissionRow & { id: string }>
                            minWidth="70rem"
                            empty={t('crep.empty')}
                            rows={data.rows.map((row) => ({ ...row, id: row._id }))}
                            columns={[
                                {
                                    key: 'referrerName',
                                    header: t('col.referrer'),
                                    render: (row) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.referrerName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                                {row.referrerCode}
                                            </p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'hospital',
                                    header: t('crep.hospital'),
                                    render: (row) => row.hospital || <span style={{ color: 'var(--text-faint)' }}>—</span>,
                                },
                                { key: 'invoiceCount', header: t('col.invoices'), align: 'right' },
                                { key: 'grossBilled', header: t('crep.gross'), align: 'right', render: (row) => money(row.grossBilled) },
                                {
                                    key: 'discountGiven',
                                    header: t('crep.discount'),
                                    align: 'right',
                                    render: (row) => <span style={{ color: 'var(--warning-strong)' }}>{money(row.discountGiven)}</span>,
                                },
                                {
                                    key: 'netBilled',
                                    header: t('col.net'),
                                    align: 'right',
                                    render: (row) => <span style={{ color: 'var(--text-heading)' }}>{money(row.netBilled)}</span>,
                                },
                                { key: 'commissionAccrued', header: t('crep.accrued'), align: 'right', render: (row) => money(row.commissionAccrued) },
                                {
                                    key: 'commissionAwaiting',
                                    header: t('crep.awaiting'),
                                    align: 'right',
                                    render: (row) => (
                                        <span
                                            style={{ color: row.commissionAwaiting > 0 ? 'var(--text-muted)' : 'var(--text-faint)' }}
                                            title={t('crep.awaitingNote')}
                                        >
                                            {money(row.commissionAwaiting)}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'commissionPaid',
                                    header: t('col.paid'),
                                    align: 'right',
                                    render: (row) => <span style={{ color: 'var(--success-strong)' }}>{money(row.commissionPaid)}</span>,
                                },
                                {
                                    key: 'commissionPending',
                                    header: t('col.pending'),
                                    align: 'right',
                                    render: (row) => (
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                color: row.commissionPending > 0 ? 'var(--danger-strong)' : 'var(--text-faint)',
                                            }}
                                        >
                                            {money(row.commissionPending)}
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Panel>
                </>
            )}
        </>
    );
};

export default CommissionReportPage;
