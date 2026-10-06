import { useState } from 'react';
import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import { useT } from '@/i18n/useLanguage';

export type ConfirmRequest = {
    title: string;
    /** What is about to happen, and what is left untouched. */
    description?: ReactNode;
    /** Shown as a warning inside the dialog: consequences, not reassurance. */
    warning?: string;
    confirmLabel: string;
    /** Red for something that removes or cannot be undone. */
    tone?: 'danger' | 'primary';
    /** Report your own errors (a toast) -- the dialog closes when this settles. */
    onConfirm: () => void | Promise<void>;
};

type ConfirmModalProps = {
    request: ConfirmRequest | null;
    onClose: () => void;
};

/**
 * The in-app replacement for window.confirm. The browser dialog could not be
 * styled, announced the hostname above every question, and blocked the page
 * while it was open. This one matches the rest of the app, says what the button
 * will do, and shows progress while the action runs.
 *
 * It closes itself once the action settles, so a caller only describes the
 * question and what to do on yes.
 */
const ConfirmModal = ({ request, onClose }: ConfirmModalProps) => {
    const t = useT();
    const [busy, setBusy] = useState(false);

    const confirm = async () => {
        if (!request || busy) return;
        setBusy(true);
        try {
            await request.onConfirm();
        } finally {
            setBusy(false);
            onClose();
        }
    };

    return (
        <Modal
            open={Boolean(request)}
            onClose={busy ? undefined : onClose}
            width={460}
            title={request?.title}
            subtitle={request?.description}
        >
            {request && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {request.warning && <InlineAlert tone="warning">{request.warning}</InlineAlert>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
                            {t('ctrl.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant={request.tone === 'primary' ? 'primary' : 'danger'}
                            loading={busy}
                            onClick={confirm}
                        >
                            {request.confirmLabel}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ConfirmModal;
