import { useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { apiErrorMessage, money } from '@/lib/format';
import { useRefundPaymentMutation } from '@/services/paymentsApi';

export type RefundTarget = {
    /** The invoice the money was paid against. */
    _id: string;
    invoiceNumber: string;
    paidAmount: number;
    patientName: string;
};

type Props = {
    target: RefundTarget | null;
    /** Tick "cancel the invoice too" from the start, for an appointment that is already cancelled. */
    defaultCancel?: boolean;
    onClose: () => void;
};

const RefundForm = ({ target, defaultCancel, onClose }: { target: RefundTarget; defaultCancel: boolean; onClose: () => void }) => {
    const [refund, { isLoading }] = useRefundPaymentMutation();
    const [amount, setAmount] = useState(String(target.paidAmount));
    const [reason, setReason] = useState('');
    const [cancelInvoice, setCancelInvoice] = useState(defaultCancel);

    const value = Number(amount);
    const valid = Number.isFinite(value) && value > 0 && value <= target.paidAmount;
    const clearsEverything = valid && value === target.paidAmount;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!valid || reason.trim().length < 3) return;

        try {
            const result = await refund({
                invoice: target._id,
                amount: value,
                reason: reason.trim(),
                cancelInvoice: clearsEverything && cancelInvoice ? true : undefined,
            }).unwrap();
            toast.success(
                `${money(value)} refunded to ${target.patientName} (${result.payment.receiptNumber})` +
                    (result.invoice.isCancelled ? '. The invoice is cancelled.' : '')
            );
            onClose();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not record the refund'));
        }
    };

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <InlineAlert tone="warning">
                Give {target.patientName} the cash back before you confirm. This is recorded as money paid out, on the
                invoice and in the till.
            </InlineAlert>

            <TextField
                label="Amount to refund (৳)"
                type="number"
                min={1}
                max={target.paidAmount}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                hint={`${money(target.paidAmount)} has been paid on ${target.invoiceNumber}`}
                error={amount && !valid ? `Enter an amount up to ${money(target.paidAmount)}` : undefined}
            />

            <Textarea
                label="Reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being refunded?"
                hint="Kept with the refund and in the activity log"
            />

            {clearsEverything && (
                <Checkbox
                    accent="brand"
                    label="Also cancel this invoice"
                    checked={cancelInvoice}
                    onChange={(e) => setCancelInvoice(e.target.checked)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <Button type="button" variant="secondary" disabled={isLoading} onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" variant="danger" loading={isLoading} disabled={!valid || reason.trim().length < 3}>
                    Refund {valid ? money(value) : ''}
                </Button>
            </div>
        </form>
    );
};

/**
 * Hands money back against an invoice. A full refund can cancel the invoice in
 * the same step, which is what a cancelled appointment usually needs.
 */
const RefundModal = ({ target, defaultCancel = false, onClose }: Props) => (
    <Modal
        open={Boolean(target)}
        onClose={onClose}
        width={480}
        title={target ? `Refund ${target.invoiceNumber}` : undefined}
        subtitle={target?.patientName}
    >
        {target && <RefundForm key={target._id} target={target} defaultCancel={defaultCancel} onClose={onClose} />}
    </Modal>
);

export default RefundModal;
