import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import { useT } from '@/i18n/useLanguage';
import type { ReportPreview } from '@/hooks/useReportPreview';

type ReportPreviewModalProps = {
    preview: ReportPreview | null;
    onClose: () => void;
    onDownload: () => void;
};

/**
 * Shows the report where the user is, rather than handing it to the browser.
 *
 * A PDF goes in an iframe and an image in an <img>; both read the object URL
 * directly, so nothing is fetched twice. It opens before the file arrives and
 * renders whichever state it is in — loading, failed, or ready — so the action
 * always visibly does something.
 */
const ReportPreviewModal = ({ preview, onClose, onDownload }: ReportPreviewModalProps) => {
    const isPdf = preview?.mimeType === 'application/pdf';
    const t = useT();
    const isImage = preview?.mimeType?.startsWith('image/') ?? false;

    return (
        <Modal
            open={Boolean(preview)}
            onClose={onClose}
            width={900}
            title={t('inv.reportTitle')}
            subtitle={preview?.caption ?? preview?.fileName}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {t('ctrl.close')}
                    </Button>
                    {/* Some browsers refuse to render a PDF inline. The URL is
                        already in hand, so this opens straight from the click
                        and no popup blocker gets involved. */}
                    <Button
                        variant="secondary"
                        disabled={!preview?.url}
                        onClick={() => preview?.url && window.open(preview.url, '_blank', 'noopener,noreferrer')}
                    >
                        {t('inv.openNewTab')}
                    </Button>
                    <Button icon="download" disabled={!preview?.url} onClick={onDownload}>
                        {t('ctrl.download')}
                    </Button>
                </>
            }
        >
            {preview && (
                <div
                    style={{
                        background: 'var(--surface-sunken)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-card)',
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '55vh',
                    }}
                >
                    {preview.error ? (
                        <div style={{ padding: 'var(--space-6)', maxWidth: 560 }}>
                            <InlineAlert tone="error">{preview.error}</InlineAlert>
                        </div>
                    ) : !preview.url ? (
                        <Loader message={t('inv.openingReport')} />
                    ) : isPdf ? (
                        <iframe
                            src={preview.url}
                            title={preview.fileName}
                            style={{ width: '100%', height: '70vh', border: 0, display: 'block' }}
                        />
                    ) : isImage ? (
                        <img
                            src={preview.url}
                            alt={preview.fileName}
                            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                        />
                    ) : (
                        <p
                            style={{
                                padding: 'var(--space-8)',
                                textAlign: 'center',
                                fontSize: 'var(--text-13)',
                                color: 'var(--text-muted)',
                            }}
                        >
                            {t('inv.noPreview')}
                        </p>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default ReportPreviewModal;
