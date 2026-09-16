import { useState } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '@/components/common/DateRangePicker';
import { rangeForDays } from '@/lib/dateRange';
import ErrorState from '@/components/common/ErrorState';
import ExportButtons from '@/components/common/ExportButtons';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import Panel from '@/components/ui/Panel';
import { formatDate, money } from '@/lib/format';
import { useT } from '@/i18n/useLanguage';
import type { TranslationKey } from '@/i18n/translations';
import { useGetDuesReportQuery } from '@/services/reportsApi';
import type { DuesReportRow } from '@/services/reportsApi';

/** Export columns carry keys; header text is resolved at render. */
const COLUMN_DEFS: { key: TranslationKey; accessor: (row: DuesReportRow) => string | number }[] = [
    { key: 'col.invoice', accessor: (r) => r.invoiceNumber },
    { key: 'col.date', accessor: (r) => formatDate(r.visitDate) },
    { key: 'col.patientId', accessor: (r) => r.patientInfo.patientId },
    { key: 'col.patient', accessor: (r) => r.patientInfo.name },
    { key: 'col.phone', accessor: (r) => r.patientInfo.phone },
    { key: 'col.referrer', accessor: (r) => r.referrerInfo?.name ?? '' },
    { key: 'dues.netPayable', accessor: (r) => r.netPayable },
    { key: 'col.paid', accessor: (r) => r.paidAmount },
    { key: 'col.due', accessor: (r) => r.dueAmount },
];

const DuesReportPage = () => {
    const [range, setRange] = useState(rangeForDays(89));
    const t = useT();
    const { data, isLoading, isError, refetch } = useGetDuesReportQuery(range);

    const columns = COLUMN_DEFS.map((column) => ({ header: t(column.key), accessor: column.accessor }));

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('dues.title')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', maxWidth: 620 }}>
                        Every invoice still carrying a balance, largest first.
                    </p>
                </div>
                <ExportButtons
                    title={t('dues.title')}
                    subtitle={`${range.startDate} to ${range.endDate}`}
                    filename={`dues-${range.startDate}-to-${range.endDate}`}
                    columns={columns}
                    rows={data?.rows ?? []}
                />
            </div>

            <DateRangePicker value={range} onChange={setRange} />

            {isLoading ? (
                <Loader message={t('dues.loading')} />
            ) : isError || !data ? (
                <ErrorState title={t('dues.loadError')} onRetry={refetch} />
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <StatCard
                            label={t('dues.totalOutstanding')}
                            value={money(data.summary.totalDue)}
                            icon="triangle-alert"
                            accent="danger"
                            caption={t('dues.acrossRange')}
                        />
                        <StatCard label={t('dues.withBalance')} value={data.summary.invoiceCount} icon="receipt-text" accent="warning" />
                    </div>

                    <Panel padding="0">
                        <DataTable<DuesReportRow & { id: string }>
                            minWidth="56rem"
                            empty={t('dues.empty')}
                            rows={data.rows.map((row) => ({ ...row, id: row._id }))}
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
                                    key: 'visitDate',
                                    header: t('col.date'),
                                    render: (row) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.visitDate)}</span>,
                                },
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
                                    render: (row) => row.referrerInfo?.name ?? <span style={{ color: 'var(--text-faint)' }}>Walk-in</span>,
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
                                    render: (row) => <span style={{ fontWeight: 600, color: 'var(--danger-strong)' }}>{money(row.dueAmount)}</span>,
                                },
                                { key: 'paymentStatus', header: t('col.status'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
                            ]}
                        />
                    </Panel>
                </>
            )}
        </>
    );
};

export default DuesReportPage;
