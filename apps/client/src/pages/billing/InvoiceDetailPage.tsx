import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { useT } from '@/i18n/useLanguage';
import { useReportPreview } from '@/hooks/useReportPreview';
import ReportPreviewModal from '@/components/common/ReportPreviewModal';
import ReasonModal from '@/components/common/ReasonModal';
import type { ReasonRequest } from '@/components/common/ReasonModal';
import { apiErrorMessage, commissionBasis, formatDate, formatDateTime, money } from '@/lib/format';
import {
    useCancelInvoiceItemMutation,
    useCancelInvoiceMutation,
    useGetInvoiceQuery,
    useMarkReportDeliveredMutation,
    useUploadReportMutation,
} from '@/services/invoicesApi';
import type { InvoiceItem } from '@/services/invoicesApi';
import { useCreatePaymentMutation, useGetInvoicePaymentsQuery, useVoidPaymentMutation } from '@/services/paymentsApi';

/** The item's own report state, mapped onto the badge vocabulary. */
const REPORT_BADGE: Record<string, string> = {
    uploaded: 'uploaded',
    delivered: 'delivered',
    pending: 'pending',
};

const linkButton = (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 0,
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 600,
    color,
});

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

const InvoiceDetailPage = () => {
    const { id } = useParams();
    const { isAdmin } = useRole();
    const navigate = useNavigate();
    const t = useT();

    const { data: invoice, isLoading, isError, refetch } = useGetInvoiceQuery(id!);
    const { data: payments = [] } = useGetInvoicePaymentsQuery(id!);

    const [createPayment, { isLoading: isPaying }] = useCreatePaymentMutation();
    const [voidPayment, { isLoading: isVoiding }] = useVoidPaymentMutation();
    const [uploadReport, { isLoading: isUploading }] = useUploadReportMutation();
    const [markDelivered] = useMarkReportDeliveredMutation();
    const { preview, openPreview, closePreview, downloadReport, downloadPreview } = useReportPreview();
    const [cancelInvoice, { isLoading: isCancellingInvoice }] = useCancelInvoiceMutation();
    const [cancelInvoiceItem, { isLoading: isCancellingItem }] = useCancelInvoiceItemMutation();

    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    /**
     * The three actions here that need a written reason share one dialog, so
     * only the request differs. Null means it is closed.
     */
    const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (isLoading) return <Loader message={t('inv.loading')} />;
    if (isError || !invoice) {
        return <ErrorState title={t('inv.loadError')} description={t('err.invoiceGone')} onRetry={refetch} />;
    }

    const handlePayment = async (event: React.FormEvent) => {
        event.preventDefault();
        const value = Number(amount);

        if (!Number.isFinite(value) || value <= 0) {
            toast.error('Enter an amount greater than zero');
            return;
        }
        // The server rejects this too; catching it here saves a round trip.
        if (value > invoice.dueAmount) {
            toast.error(`Amount exceeds the outstanding due of ${money(invoice.dueAmount)}`);
            return;
        }

        try {
            const result = await createPayment({
                invoice: invoice._id,
                amount: value,
                note: note.trim() || undefined,
            }).unwrap();

            toast.success(`Receipt ${result.payment.receiptNumber} recorded`);
            setAmount('');
            setNote('');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not record the payment'));
        }
    };

    const handleVoid = (paymentId: string, receiptNumber: string) =>
        setReasonRequest({
            title: t('inv.voidTitle').replace('{receipt}', receiptNumber),
            description: t('inv.voidBody'),
            warning: t('inv.voidWarning'),
            confirmLabel: t('inv.voidConfirm'),
            onConfirm: async (reason) => {
                try {
                    await voidPayment({ id: paymentId, reason, invoiceId: invoice._id }).unwrap();
                    toast.success(t('inv.paymentVoided'));
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, t('inv.voidFailed')));
                }
            },
        });

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const itemId = uploadingItemId;
        event.target.value = '';

        if (!file || !itemId) return;

        try {
            await uploadReport({ invoiceId: invoice._id, itemId, file }).unwrap();
            toast.success('Report uploaded');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not upload the report'));
        } finally {
            setUploadingItemId(null);
        }
    };

    /** The stored name if we have it, else something recognisable on disk. */
    const reportName = (item?: InvoiceItem) =>
        item?.reportFile?.originalName ?? `${invoice.patientInfo.name} - ${item?.testName ?? 'report'}`;

    const reportTarget = (item: InvoiceItem) => ({
        invoiceId: invoice._id,
        itemId: item._id,
        fileName: reportName(item),
        caption: `${invoice.patientInfo.name} · ${item.testName} · ${invoice.invoiceNumber}`,
    });

    /**
     * Calls off one test. The reason is required by the API and shows in the
     * activity log, so it is asked for rather than defaulted.
     */
    const handleCancelItem = (item: InvoiceItem) =>
        setReasonRequest({
            title: t('inv.cancelTestTitle').replace('{test}', item.testName),
            description: t('inv.cancelTestBody'),
            confirmLabel: t('inv.cancelTestConfirm'),
            onConfirm: async (reason) => {
                try {
                    await cancelInvoiceItem({ invoiceId: invoice._id, itemId: item._id, reason }).unwrap();
                    toast.success(t('inv.testCancelled'));
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, t('inv.cancelTestFailed')));
                }
            },
        });

    const handleDeliver = async (itemId: string) => {
        try {
            await markDelivered({ invoiceId: invoice._id, itemId }).unwrap();
            toast.success('Marked as delivered');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not update the report'));
        }
    };

    const handleCancel = () =>
        setReasonRequest({
            title: t('inv.cancelInvoiceTitle').replace('{invoice}', invoice.invoiceNumber),
            description: t('inv.cancelInvoiceBody'),
            warning: t('inv.cancelInvoiceWarning'),
            confirmLabel: t('inv.cancelInvoiceConfirm'),
            onConfirm: async (reason) => {
                try {
                    await cancelInvoice({ id: invoice._id, reason }).unwrap();
                    toast.success(t('inv.invoiceCancelled'));
                    setReasonRequest(null);
                } catch (error) {
                    toast.error(apiErrorMessage(error, t('inv.cancelInvoiceFailed')));
                }
            },
        });

    const patientId = typeof invoice.patient === 'string' ? invoice.patient : invoice.patient._id;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileSelected}
                hidden
            />

            <ReportPreviewModal preview={preview} onClose={closePreview} onDownload={downloadPreview} />

            <ReasonModal
                request={reasonRequest}
                busy={isCancellingItem || isVoiding || isCancellingInvoice}
                onClose={() => setReasonRequest(null)}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-heading)' }}>
                            {invoice.invoiceNumber}
                        </h2>
                        <StatusBadge status={invoice.isCancelled ? 'cancelled' : invoice.paymentStatus} />
                    </div>
                    <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(invoice.visitDate)} ·{' '}
                        <Link to={`/patients/${patientId}`} style={{ fontWeight: 600 }}>
                            {invoice.patientInfo.name}
                        </Link>{' '}
                        ({invoice.patientInfo.patientId})
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="secondary" icon="printer" onClick={() => navigate(`/billing/${invoice._id}/print`)}>
                        {t('ctrl.print')}
                    </Button>
                    {isAdmin && !invoice.isCancelled && invoice.paidAmount === 0 && (
                        <Button variant="danger" onClick={handleCancel}>
                            {t('inv.cancelInvoice')}
                        </Button>
                    )}
                </div>
            </div>

            {invoice.isCancelled && (
                <InlineAlert tone="error">
                    This invoice was cancelled.{invoice.cancelReason ? ` Reason: ${invoice.cancelReason}` : ''}
                </InlineAlert>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%),1fr))', gap: 'var(--gap-grid)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
                    <Panel title={t('inv.testsReports')} padding="var(--pad-panel) var(--pad-panel) 8px">
                        <DataTable<InvoiceItem & { id: string }>
                            minWidth="36rem"
                            rows={invoice.items.map((item) => ({ ...item, id: item._id }))}
                            columns={[
                                {
                                    key: 'testName',
                                    header: t('col.test'),
                                    render: (item) => (
                                        <span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
                                                {item.testCode}
                                            </span>{' '}
                                            <span style={{ color: 'var(--text-heading)' }}>{item.testName}</span>
                                        </span>
                                    ),
                                },
                                {
                                    key: 'price',
                                    header: t('col.price'),
                                    align: 'right',
                                    render: (item) => (
                                        <span
                                            style={{
                                                textDecoration: item.isCancelled ? 'line-through' : 'none',
                                                color: item.isCancelled ? 'var(--text-faint)' : 'inherit',
                                            }}
                                        >
                                            {money(item.price)}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'reportStatus',
                                    header: t('col.report'),
                                    render: (item) =>
                                        item.isCancelled ? (
                                            <StatusBadge status="cancelled" />
                                        ) : (
                                            <StatusBadge status={REPORT_BADGE[item.reportStatus] ?? item.reportStatus} />
                                        ),
                                },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (item) => (
                                        <span style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                                            {/*
                                              A cancelled line keeps no actions: there is nothing
                                              left to upload, deliver or call off.
                                            */}
                                            {!invoice.isCancelled && !item.isCancelled && (() => {
                                                const liveCount = invoice.items.filter((entry) => !entry.isCancelled).length;
                                                const reportDone = item.reportStatus !== 'pending';
                                                const isLast = liveCount <= 1;
                                                const blocked = reportDone || isLast;

                                                return (
                                                    <button
                                                        type="button"
                                                        disabled={blocked || isCancellingItem}
                                                        aria-label={`Cancel ${item.testName}`}
                                                        title={
                                                            reportDone
                                                                ? t('inv.reportDoneNoCancel')
                                                                : isLast
                                                                  ? t('inv.lastTestNoCancel')
                                                                  : t('inv.cancelTest')
                                                        }
                                                        onClick={() => handleCancelItem(item)}
                                                        style={{
                                                            ...actionIconStyle,
                                                            color: 'var(--danger-strong)',
                                                            opacity: blocked || isCancellingItem ? 0.35 : 1,
                                                            cursor: blocked ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        <Icon name="x" size={16} />
                                                    </button>
                                                );
                                            })()}
                                            {item.reportFile && (
                                                <>
                                                    <button
                                                        type="button"
                                                        aria-label={`View report for ${item.testName}`}
                                                        title={t('ttl.viewReport')}
                                                        onClick={() => openPreview(reportTarget(item))}
                                                        style={{ ...actionIconStyle, color: 'var(--brand)' }}
                                                    >
                                                        <Icon name="eye" size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Download report for ${item.testName}`}
                                                        title={t('ttl.downloadReport')}
                                                        onClick={() => downloadReport(reportTarget(item))}
                                                        style={{ ...actionIconStyle, color: 'var(--text-muted)' }}
                                                    >
                                                        <Icon name="download" size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {!invoice.isCancelled && !item.isCancelled && (
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    aria-label={item.reportFile ? `Replace report for ${item.testName}` : `Upload report for ${item.testName}`}
                                                    onClick={() => {
                                                        setUploadingItemId(item._id);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    style={{ ...actionIconStyle, color: 'var(--text-muted)', opacity: isUploading ? 0.5 : 1 }}
                                                >
                                                    <Icon name="upload" size={16} />
                                                </button>
                                            )}
                                            {item.reportStatus === 'uploaded' && !item.isCancelled && (
                                                <button
                                                    type="button"
                                                    disabled={invoice.dueAmount > 0}
                                                    aria-label={`Mark ${item.testName} delivered`}
                                                    title={
                                                        invoice.dueAmount > 0
                                                            ? `${money(invoice.dueAmount)} still due — collect it before handing the report over`
                                                            : `Mark ${item.testName} delivered`
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
                    </Panel>

                    <Panel title={t('inv.paymentHistory')} subtitle={t('inv.paymentHistorySub')}>
                        {payments.length === 0 ? (
                            <p
                                style={{
                                    border: '1px dashed var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-8)',
                                    textAlign: 'center',
                                    fontSize: 12,
                                    color: 'var(--text-muted)',
                                }}
                            >
                                {t('inv.noPayments')}
                            </p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {payments.map((payment) => (
                                    <li
                                        key={payment._id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                            flexWrap: 'wrap',
                                            background: payment.isVoided ? 'var(--danger-bg)' : 'var(--surface-sunken)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '10px 14px',
                                            fontSize: 12,
                                            textDecoration: payment.isVoided ? 'line-through' : 'none',
                                            opacity: payment.isVoided ? 0.7 : 1,
                                        }}
                                    >
                                        <div>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
                                                {payment.receiptNumber}
                                            </span>
                                            <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>{formatDateTime(payment.paymentDate)}</span>
                                            <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>by {payment.receivedByName}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>
                                                {money(payment.amount)}
                                            </span>
                                            {isAdmin && !payment.isVoided && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleVoid(payment._id, payment.receiptNumber)}
                                                    style={linkButton('var(--danger-strong)')}
                                                >
                                                    {t('inv.void')}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)', position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' }}>
                    <Panel title={t('inv.billing')}>
                        {invoice.referrerInfo && (
                            <p
                                style={{
                                    marginBottom: 16,
                                    background: 'var(--warning-bg)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '10px 14px',
                                    fontSize: 12,
                                    color: 'var(--text-body)',
                                }}
                            >
                                {t('inv.referredBy')} <strong style={{ color: 'var(--text-heading)' }}>{invoice.referrerInfo.name}</strong>
                                {invoice.referrerInfo.hospital ? ` · ${invoice.referrerInfo.hospital}` : ''}
                            </p>
                        )}

                        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <dt style={{ color: 'var(--text-muted)' }}>Gross</dt>
                                <dd style={{ margin: 0, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{money(invoice.grossAmount)}</dd>
                            </div>
                            {invoice.discountAmount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-strong)' }}>
                                    <dt>Discount ({invoice.discountPercent}%)</dt>
                                    <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>−{money(invoice.discountAmount)}</dd>
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    borderTop: '1px solid var(--surface-muted)',
                                    paddingTop: 8,
                                    fontWeight: 600,
                                }}
                            >
                                <dt style={{ color: 'var(--text-heading)' }}>Net payable</dt>
                                <dd style={{ margin: 0, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{money(invoice.netPayable)}</dd>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-strong)' }}>
                                <dt>Paid</dt>
                                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{money(invoice.paidAmount)}</dd>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    borderTop: '1px solid var(--surface-muted)',
                                    paddingTop: 10,
                                    fontSize: 16,
                                    fontWeight: 700,
                                }}
                            >
                                <dt style={{ color: 'var(--text-heading)' }}>Due</dt>
                                <dd
                                    style={{
                                        margin: 0,
                                        color: invoice.dueAmount > 0 ? 'var(--danger-strong)' : 'var(--success-strong)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {money(invoice.dueAmount)}
                                </dd>
                            </div>

                            {/* Below the line: what the centre pays the referrer.
                                It is not part of the patient's bill. */}
                            {invoice.referrerInfo && invoice.commissionAmount !== undefined && (
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        borderTop: '1px dashed var(--border-subtle)',
                                        marginTop: 4,
                                        paddingTop: 10,
                                        fontSize: 12,
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    <dt>
                                        {t('inv.referrerCommission')} ({commissionBasis(invoice.commissionType, invoice.commissionValue)}) ·{' '}
                                        {invoice.commissionStatus}
                                    </dt>
                                    <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{money(invoice.commissionAmount)}</dd>
                                </div>
                            )}
                        </dl>
                    </Panel>

                    {!invoice.isCancelled && invoice.dueAmount > 0 && (
                        <Panel title={t('inv.takeCash')} style={{ borderColor: 'var(--teal-200)' }}>
                            <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <TextField
                                        label={t('fld.amountTk')}
                                        type="number"
                                        min="0.01"
                                        max={invoice.dueAmount}
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder={String(invoice.dueAmount)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAmount(String(invoice.dueAmount))}
                                        style={{ ...linkButton('var(--brand)'), alignSelf: 'flex-start' }}
                                    >
                                        Pay full due ({money(invoice.dueAmount)})
                                    </button>
                                </div>

                                <TextField label={t('inv.note')} optional value={note} onChange={(e) => setNote(e.target.value)} />

                                <Button type="submit" variant="accent" block loading={isPaying}>
                                    {isPaying ? 'Recording...' : 'Record payment'}
                                </Button>
                            </form>
                        </Panel>
                    )}
                </div>
            </div>
        </>
    );
};

export default InvoiceDetailPage;
