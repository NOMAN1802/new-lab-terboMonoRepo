import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { useT } from '@/i18n/useLanguage';
import ReportPreviewModal from '@/components/common/ReportPreviewModal';
import { useReportPreview } from '@/hooks/useReportPreview';
import { apiErrorMessage, formatDate, formatDateTime, money } from '@/lib/format';
import {
    useGetInvoiceQuery,
    useMarkReportDeliveredMutation,
    useUploadReportMutation,
} from '@/services/invoicesApi';
import type { InvoiceItem } from '@/services/invoicesApi';
import { useGetInvoicePaymentsQuery } from '@/services/paymentsApi';

/** Mirrors the server's multer filter, so the picker offers only what is accepted. */
const ACCEPTED_REPORT_TYPES = 'application/pdf,image/png,image/jpeg,image/webp';

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

type InvoiceViewModalProps = {
    invoiceId: string | null;
    onClose: () => void;
};

const row = (label: string, value: string, strong = false, color?: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontWeight: strong ? 700 : 500, color: color ?? 'var(--text-heading)' }}>{value}</span>
    </div>
);

/**
 * Read-only summary of an invoice for the "eye" action on the list — the
 * full InvoiceDetailPage stays the place for payments, uploads and voids.
 */
const InvoiceViewModal = ({ invoiceId, onClose }: InvoiceViewModalProps) => {
    const navigate = useNavigate();
    const t = useT();
    const open = Boolean(invoiceId);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

    const { data: invoice, isLoading, isError, refetch } = useGetInvoiceQuery(invoiceId!, { skip: !invoiceId });
    const { data: payments = [] } = useGetInvoicePaymentsQuery(invoiceId!, { skip: !invoiceId });

    const [uploadReport, { isLoading: isUploading }] = useUploadReportMutation();
    const [markDelivered] = useMarkReportDeliveredMutation();
    const { preview, openPreview, closePreview, downloadReport, downloadPreview } = useReportPreview();

    const pickFile = (itemId: string) => {
        setUploadingItemId(itemId);
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const itemId = uploadingItemId;
        event.target.value = '';

        if (!file || !itemId || !invoiceId) return;

        try {
            await uploadReport({ invoiceId, itemId, file }).unwrap();
            toast.success('Report uploaded');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not upload the report'));
        } finally {
            setUploadingItemId(null);
        }
    };

    /** The stored name if we have it, else something recognisable on disk. */
    const reportName = (itemId: string) => {
        const item = invoice?.items.find((entry) => entry._id === itemId);
        return (
            item?.reportFile?.originalName ??
            `${invoice?.patientInfo.name ?? 'Patient'} - ${item?.testName ?? 'report'}`
        );
    };

    const reportTarget = (item: InvoiceItem) => ({
        invoiceId: invoiceId!,
        itemId: item._id,
        fileName: reportName(item._id),
        caption: `${invoice?.patientInfo.name ?? 'Patient'} · ${item.testName}`,
    });

    const handleDeliver = async (itemId: string) => {
        if (!invoiceId) return;
        try {
            await markDelivered({ invoiceId, itemId }).unwrap();
            toast.success('Marked as delivered');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not update the report'));
        }
    };

    return (
        <>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_REPORT_TYPES} onChange={handleFileSelected} hidden />

            <ReportPreviewModal preview={preview} onClose={closePreview} onDownload={downloadPreview} />
        <Modal
            open={open}
            onClose={onClose}
            width={760}
            title={invoice?.invoiceNumber ?? 'Invoice'}
            subtitle={invoice ? `${formatDate(invoice.visitDate)} · ${invoice.patientInfo.name} (${invoice.patientInfo.patientId})` : undefined}
            footer={
                invoice && (
                    <>
                        <Button variant="secondary" icon="printer" onClick={() => navigate(`/billing/${invoice._id}/print`)}>
                            {t('ctrl.print')}
                        </Button>
                        <Button icon="receipt-text" onClick={() => navigate(`/billing/${invoice._id}`)}>
                            {t('inv.openFull')}
                        </Button>
                    </>
                )
            }
        >
            {isLoading ? (
                <Loader message={t('inv.loading')} />
            ) : isError || !invoice ? (
                <ErrorState title={t('inv.loadError')} onRetry={refetch} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusBadge status={invoice.isCancelled ? 'cancelled' : invoice.paymentStatus} />
                        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                            {invoice.referrerInfo?.name ?? 'Walk-in'}
                        </span>
                    </div>

                    <div>
                        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 8 }}>{t('col.tests')}</h3>
                        <DataTable<InvoiceItem & { id: string }>
                            dense
                            minWidth="30rem"
                            rows={invoice.items.map((item) => ({ ...item, id: item._id }))}
                            columns={[
                                { key: 'testName', header: t('col.test'), render: (r) => r.testName },
                                { key: 'price', header: t('col.price'), align: 'right', render: (r) => money(r.price) },
                                { key: 'reportStatus', header: t('col.report'), render: (r) => <StatusBadge status={r.reportStatus} /> },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (item) => (
                                        <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                                            {item.reportFile && (
                                                <>
                                                    <button
                                                        type="button"
                                                        aria-label={`View the ${item.testName} report`}
                                                        title={t('ttl.viewReport')}
                                                        onClick={() => openPreview(reportTarget(item))}
                                                        style={{ ...actionIconStyle, color: 'var(--brand)' }}
                                                    >
                                                        <Icon name="eye" size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Download the ${item.testName} report`}
                                                        title={t('ttl.downloadReport')}
                                                        onClick={() => downloadReport(reportTarget(item))}
                                                        style={{ ...actionIconStyle, color: 'var(--text-muted)' }}
                                                    >
                                                        <Icon name="download" size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {!invoice.isCancelled && (
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    aria-label={
                                                        item.reportFile
                                                            ? `Replace the ${item.testName} report`
                                                            : `Upload the ${item.testName} report`
                                                    }
                                                    onClick={() => pickFile(item._id)}
                                                    style={{
                                                        ...actionIconStyle,
                                                        color: 'var(--text-muted)',
                                                        opacity: isUploading ? 0.5 : 1,
                                                    }}
                                                >
                                                    <Icon name="upload" size={16} />
                                                </button>
                                            )}
                                            {item.reportStatus === 'uploaded' && (
                                                <button
                                                    type="button"
                                                    disabled={invoice.dueAmount > 0}
                                                    aria-label={`Mark the ${item.testName} report delivered`}
                                                    title={
                                                        invoice.dueAmount > 0
                                                            ? `${money(invoice.dueAmount)} still due — collect it before handing the report over`
                                                            : `Mark the ${item.testName} report delivered`
                                                    }
                                                    onClick={() => handleDeliver(item._id)}
                                                    style={{
                                                        ...actionIconStyle,
                                                        color: 'var(--success-strong)',
                                                        opacity: invoice.dueAmount > 0 ? 0.4 : 1,
                                                        cursor: invoice.dueAmount > 0 ? 'not-allowed' : 'pointer',
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
                    </div>

                    <div>
                        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>{t('inv.billing')}</h3>
                        {row(t('inv.gross'), money(invoice.grossAmount))}
                        {invoice.discountAmount > 0 &&
                            row(`Discount (${invoice.discountPercent}%)`, `-${money(invoice.discountAmount)}`, false, 'var(--warning-strong)')}
                        {row(t('inv.netPayable'), money(invoice.netPayable), true)}
                        {row(t('col.paid'), money(invoice.paidAmount), false, 'var(--success-strong)')}
                        {row(t('col.due'), money(invoice.dueAmount), true, invoice.dueAmount > 0 ? 'var(--danger-strong)' : 'var(--success-strong)')}
                    </div>

                    <div>
                        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 8 }}>{t('inv.paymentHistory')}</h3>
                        {payments.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('inv.noPayments')}</p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {payments.map((payment) => (
                                    <li
                                        key={payment._id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: 12,
                                            padding: '6px 0',
                                            borderBottom: '1px solid var(--surface-muted)',
                                        }}
                                    >
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {formatDateTime(payment.paymentDate)} · {payment.receivedByName}
                                        </span>
                                        <span style={{ fontWeight: 600, color: payment.isVoided ? 'var(--text-faint)' : 'var(--text-heading)' }}>
                                            {money(payment.amount)}
                                            {payment.isVoided && ' · Voided'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </Modal>
        </>
    );
};

export default InvoiceViewModal;
