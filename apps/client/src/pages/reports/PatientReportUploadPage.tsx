import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatusBadge from '@/components/common/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import Pagination from '@/components/ui/Pagination';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { useT } from '@/i18n/useLanguage';
import { useReportPreview } from '@/hooks/useReportPreview';
import ReportPreviewModal from '@/components/common/ReportPreviewModal';
import { apiErrorMessage, formatDate, money } from '@/lib/format';
import { useGetInvoicesQuery, useMarkReportDeliveredMutation, useUploadReportMutation } from '@/services/invoicesApi';
import type { ReportStatus } from '@/services/invoicesApi';
import type { TranslationKey } from '@/i18n/translations';

const PAGE_SIZE = 20;

/** Mirrors the server's multer filter, so the picker offers only what will be accepted. */
const ACCEPTED = 'application/pdf,image/png,image/jpeg,image/webp';

const STATUS_FILTERS: { key: TranslationKey; value: ReportStatus | '' }[] = [
    { key: 'ctrl.all', value: '' },
    { key: 'delivery.awaiting', value: 'pending' },
    { key: 'delivery.ready', value: 'uploaded' },
    { key: 'delivery.delivered', value: 'delivered' },
];

const actionIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: 0,
    background: 'transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition-control)',
};

/** One booked test, flattened out of its invoice so the queue reads as a list of jobs. */
type ReportRow = {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    visitDate: string;
    patientName: string;
    patientId: string;
    itemId: string;
    testName: string;
    testCode: string;
    reportStatus: ReportStatus;
    hasFile: boolean;
    /** The name it was uploaded under, reused when saving it back down. */
    fileName: string;
    isCancelled: boolean;
    /** A report is not handed over until the whole invoice is settled. */
    dueAmount: number;
};

/**
 * The report queue: every booked test that still needs a PDF or scan attached,
 * across all invoices. The same upload lives on each invoice, but a lab does
 * this in batches — one screen beats opening invoices one at a time.
 */
const PatientReportUploadPage = () => {
    const { isAdmin } = useRole();
    const t = useT();

    // The two roles arrive for opposite reasons: an admin to attach reports the
    // lab has finished, a receptionist to hand over ones already attached.
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ReportStatus | ''>(isAdmin ? 'pending' : 'uploaded');
    const [page, setPage] = useState(1);
    const [target, setTarget] = useState<{ invoiceId: string; itemId: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading, isFetching, isError, refetch } = useGetInvoicesQuery({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        sortBy: '-visitDate',
    });

    const [uploadReport, { isLoading: isUploading }] = useUploadReportMutation();
    const [markDelivered] = useMarkReportDeliveredMutation();
    const { preview, openPreview, closePreview, downloadReport, downloadPreview } = useReportPreview();

    const invoices = data?.items ?? [];
    const total = data?.meta.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const rows: ReportRow[] = invoices
        .filter((invoice) => !invoice.isCancelled)
        .flatMap((invoice) =>
            invoice.items.map((item) => ({
                id: `${invoice._id}-${item._id}`,
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                visitDate: invoice.visitDate,
                patientName: invoice.patientInfo.name,
                patientId: invoice.patientInfo.patientId,
                itemId: item._id,
                testName: item.testName,
                testCode: item.testCode,
                reportStatus: item.reportStatus,
                hasFile: Boolean(item.reportFile),
                fileName: item.reportFile?.originalName ?? `${invoice.patientInfo.name} - ${item.testName}`,
                isCancelled: Boolean(invoice.isCancelled),
                dueAmount: invoice.dueAmount,
            })),
        )
        .filter((row) => !status || row.reportStatus === status);

    const pickFile = (invoiceId: string, itemId: string) => {
        setTarget({ invoiceId, itemId });
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const pending = target;
        event.target.value = '';

        if (!file || !pending) return;

        try {
            await uploadReport({ ...pending, file }).unwrap();
            toast.success('Report uploaded');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not upload the report'));
        } finally {
            setTarget(null);
        }
    };

    const reportTarget = (row: ReportRow) => ({
        invoiceId: row.invoiceId,
        itemId: row.itemId,
        fileName: row.fileName,
        caption: `${row.patientName} · ${row.testName} · ${row.invoiceNumber}`,
    });

    const handleDeliver = async (invoiceId: string, itemId: string) => {
        try {
            await markDelivered({ invoiceId, itemId }).unwrap();
            toast.success('Marked as delivered');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not update the report'));
        }
    };

    return (
        <>
            <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileSelected} hidden />

            <ReportPreviewModal preview={preview} onClose={closePreview} onDownload={downloadPreview} />

            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('delivery.title')}</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('delivery.subtitle')}
                </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
                    <TextField
                        icon="search"
                        type="search"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder={t('delivery.searchPlaceholder')}
                    />
                </div>

                <SegmentedControl
                    options={STATUS_FILTERS.map((filter) => ({ label: t(filter.key), value: filter.value }))}
                    value={status}
                    onChange={(value) => {
                        setStatus(value as ReportStatus | '');
                        setPage(1);
                    }}
                />
            </div>

            {isUploading && <InlineAlert tone="info">{t('delivery.uploading')}</InlineAlert>}

            {isLoading ? (
                <Loader message={t('delivery.loading')} />
            ) : isError ? (
                <ErrorState title={t('delivery.loadError')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<ReportRow>
                            minWidth="52rem"
                            empty={
                                status === 'pending'
                                    ? t('delivery.allAttached')
                                    : status === 'uploaded'
                                      ? t('delivery.nothingWaiting')
                                      : t('delivery.noMatch')
                            }
                            rows={rows}
                            columns={[
                                {
                                    key: 'invoiceNumber',
                                    header: t('col.invoice'),
                                    mono: true,
                                    render: (row) => (
                                        <Link to={`/billing/${row.invoiceId}`} style={{ fontWeight: 600 }}>
                                            {row.invoiceNumber}
                                        </Link>
                                    ),
                                },
                                { key: 'visitDate', header: t('col.date'), render: (row) => formatDate(row.visitDate) },
                                {
                                    key: 'patientName',
                                    header: t('col.patient'),
                                    render: (row) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.patientName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                                                {row.patientId}
                                            </p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'testName',
                                    header: t('col.test'),
                                    render: (row) => (
                                        <div>
                                            <p style={{ color: 'var(--text-heading)' }}>{row.testName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                                                {row.testCode}
                                            </p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'reportStatus',
                                    header: t('col.report'),
                                    render: (row) => <StatusBadge status={row.reportStatus} />,
                                },
                                {
                                    key: 'dueAmount',
                                    header: t('col.due'),
                                    align: 'right',
                                    render: (row) =>
                                        row.dueAmount > 0 ? (
                                            <span style={{ fontWeight: 600, color: 'var(--danger-strong)' }}>{money(row.dueAmount)}</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-faint)' }}>{t('col.settled')}</span>
                                        ),
                                },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (row) => (
                                        <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                                            {row.hasFile ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        aria-label={`View the ${row.testName} report`}
                                                        title={t('ttl.viewReport')}
                                                        onClick={() => openPreview(reportTarget(row))}
                                                        style={{ ...actionIconStyle, color: 'var(--brand)' }}
                                                    >
                                                        <Icon name="eye" size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Download the ${row.testName} report`}
                                                        title={t('ttl.downloadReport')}
                                                        onClick={() => downloadReport(reportTarget(row))}
                                                        style={{ ...actionIconStyle, color: 'var(--text-muted)' }}
                                                    >
                                                        <Icon name="download" size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    aria-label={`Upload the ${row.testName} report`}
                                                    title={t('ttl.attachReport')}
                                                    onClick={() => pickFile(row.invoiceId, row.itemId)}
                                                    style={{
                                                        ...actionIconStyle,
                                                        color: 'var(--text-muted)',
                                                        opacity: isUploading ? 0.5 : 1,
                                                    }}
                                                >
                                                    <Icon name="upload" size={16} />
                                                </button>
                                            )}
                                            {row.reportStatus === 'uploaded' && (
                                                <button
                                                    type="button"
                                                    disabled={row.dueAmount > 0}
                                                    aria-label={`Mark the ${row.testName} report delivered`}
                                                    title={
                                                        row.dueAmount > 0
                                                            ? `${money(row.dueAmount)} still due — collect it before handing the report over`
                                                            : `Mark the ${row.testName} report delivered`
                                                    }
                                                    onClick={() => handleDeliver(row.invoiceId, row.itemId)}
                                                    style={{
                                                        ...actionIconStyle,
                                                        color: 'var(--success-strong)',
                                                        opacity: row.dueAmount > 0 ? 0.4 : 1,
                                                        cursor: row.dueAmount > 0 ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    <Icon name="circle-check" size={16} />
                                                </button>
                                            )}
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Panel>

                    <Pagination page={page} totalPages={totalPages} busy={isFetching} onChange={setPage} />
                </>
            )}
        </>
    );
};

export default PatientReportUploadPage;
