import { useState } from 'react';
import DateRangePicker from '@/components/common/DateRangePicker';
import { rangeForDays } from '@/lib/dateRange';
import ErrorState from '@/components/common/ErrorState';
import ExportButtons from '@/components/common/ExportButtons';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import Panel from '@/components/ui/Panel';
import { formatDate } from '@/lib/format';
import { useT } from '@/i18n/useLanguage';
import { useGetPatientReportQuery } from '@/services/reportsApi';
import type { PatientReportRow } from '@/services/reportsApi';
import type { TranslationKey } from '@/i18n/translations';

/** Export columns carry keys; the header text is resolved at render. */
const COLUMN_DEFS: { key: TranslationKey; accessor: (row: PatientReportRow) => string | number }[] = [
    { key: 'col.invoice', accessor: (row) => row.invoiceNumber },
    { key: 'col.date', accessor: (row) => formatDate(row.visitDate) },
    { key: 'col.patientId', accessor: (row) => row.patientId },
    { key: 'col.name', accessor: (row) => row.patientName },
    { key: 'pform.age', accessor: (row) => row.age },
    { key: 'pform.sex', accessor: (row) => row.gender },
    { key: 'col.phone', accessor: (row) => row.phone },
    { key: 'col.tests', accessor: (row) => row.tests.join(', ') },
    { key: 'col.pending', accessor: (row) => row.reportsPending },
    { key: 'col.payment', accessor: (row) => row.paymentStatus },
];

const PAGE_SIZE = 20;

const PatientReportPage = () => {
    const [range, setRange] = useState(rangeForDays(29));
    const t = useT();
    const { data, isLoading, isError, refetch } = useGetPatientReportQuery(range);

    /**
     * Paged here rather than on the server: the endpoint answers with the whole
     * range in one payload, and the PDF/Excel export below is built from that
     * same set. Paging the request would quietly reduce an export to whichever
     * page happened to be on screen.
     */
    const [page, setPage] = useState(1);
    const rows = data?.rows ?? [];
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

    // A new date range is a new result set, so the paging starts over.
    const [pagedFor, setPagedFor] = useState(range);
    if (pagedFor !== range) {
        setPagedFor(range);
        setPage(1);
    }

    const columns = COLUMN_DEFS.map((column) => ({ header: t(column.key), accessor: column.accessor }));

    const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('rep.patientTitle')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', maxWidth: 620 }}>
                        {t('rep.patientSub')}
                    </p>
                </div>
                <ExportButtons
                    title={t('rep.patientTitle')}
                    subtitle={`${range.startDate} to ${range.endDate}`}
                    filename={`patient-report-${range.startDate}-to-${range.endDate}`}
                    columns={columns}
                    rows={rows}
                />
            </div>

            <DateRangePicker value={range} onChange={setRange} />

            {isLoading ? (
                <Loader message={t('ld.report')} />
            ) : isError || !data ? (
                <ErrorState title={t('err.patientReport')} onRetry={refetch} />
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <StatCard label={t('rep.visits')} value={data.summary.visits} icon="clipboard-list" />
                        <StatCard label={t('rep.newPatients')} value={data.summary.newPatients} icon="user-round-plus" accent="brand" />
                        <StatCard label={t('rep.testsPerformed')} value={data.summary.testsPerformed} icon="flask-conical" accent="neutral" />
                        <StatCard label={t('rep.patientsOnFile')} value={data.summary.totalPatients} icon="users" accent="neutral" />
                    </div>

                    <Panel padding="0">
                        <DataTable<PatientReportRow & { id: string }>
                            minWidth="56rem"
                            empty={t('rep.noVisits')}
                            rows={visible.map((row) => ({ ...row, id: row.invoiceNumber }))}
                            columns={[
                                {
                                    key: 'invoiceNumber',
                                    header: t('col.invoice'),
                                    mono: true,
                                    render: (row) => <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{row.invoiceNumber}</span>,
                                },
                                {
                                    key: 'visitDate',
                                    header: t('col.date'),
                                    render: (row) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.visitDate)}</span>,
                                },
                                {
                                    key: 'patientName',
                                    header: t('col.patient'),
                                    render: (row) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.patientName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                                {row.patientId} · {row.phone}
                                            </p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'ageSex',
                                    header: t('col.ageSex'),
                                    render: (row) => (
                                        <span style={{ textTransform: 'capitalize' }}>
                                            {row.age} / {row.gender}
                                        </span>
                                    ),
                                },
                                { key: 'tests', header: t('col.tests'), render: (row) => row.tests.join(', ') },
                                { key: 'reportsPending', header: t('col.pending'), align: 'right' },
                                { key: 'paymentStatus', header: t('col.payment'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
                            ]}
                        />
                    </Panel>

                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

export default PatientReportPage;
