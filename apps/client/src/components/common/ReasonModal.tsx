import { useState } from 'react';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { useT } from '@/i18n/useLanguage';

export type ReasonRequest = {
    title: string;
    /** What is about to happen, in the words the record will keep. */
    description?: string;
    /** Shown as a warning inside the dialog — consequences, not reassurance. */
    warning?: string;
    confirmLabel: string;
    onConfirm: (reason: string) => void | Promise<void>;
};

type ReasonModalProps = {
    request: ReasonRequest | null;
    busy?: boolean;
    onClose: () => void;
};

/**
 * Asks for a written reason before something irreversible.
 *
 * Replaces window.prompt, which could not be styled, could not validate an
 * empty answer, gave the reason a single cramped line, and announced the
 * hostname above every question. The reason ends up in the activity log, so
 * the field is a textarea and the confirm stays disabled until it is filled.
 */
const ReasonModal = ({ request, busy = false, onClose }: ReasonModalProps) => {
    const t = useT();
    const [reason, setReason] = useState('');

    // Each request starts from a blank field rather than the last answer.
    // Done during render rather than in an effect: an effect would paint the
    // previous reason for a frame before clearing it.
    const [openedFor, setOpenedFor] = useState(request);
    if (openedFor !== request) {
        setOpenedFor(request);
        setReason('');
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = reason.trim();
        if (!trimmed || busy) return;
        await request?.onConfirm(trimmed);
    };

    return (
        <Modal
            open={Boolean(request)}
            onClose={busy ? undefined : onClose}
            width={480}
            title={request?.title}
            subtitle={request?.description}
        >
            {request && (
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {request.warning && <InlineAlert tone="warning">{request.warning}</InlineAlert>}

                    <Textarea
                        label={t('reason.label')}
                        id="reason"
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={t('reason.placeholder')}
                        hint={t('reason.hint')}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
                            {t('ctrl.cancel')}
                        </Button>
                        <Button type="submit" loading={busy} disabled={!reason.trim()}>
                            {request.confirmLabel}
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default ReasonModal;
