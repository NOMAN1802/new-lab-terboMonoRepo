import { useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { useT } from '@/i18n/useLanguage';
import { apiErrorMessage, money } from '@/lib/format';
import type { Invoice } from '@/services/invoicesApi';
import { useCreatePaymentMutation } from '@/services/paymentsApi';

type TakePaymentModalProps = {
    invoice: Invoice | null;
    onClose: () => void;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Takes a payment against an invoice without leaving the list. Any amount up
 * to the outstanding due is allowed, so a patient can clear a balance over as
 * many visits as they need — each one gets its own receipt.
 */
const TakePaymentModal = ({ invoice, onClose }: TakePaymentModalProps) => {
    const [amount, setAmount] = useState('');
    const t = useT();
    const [note, setNote] = useState('');
    const [createPayment, { isLoading }] = useCreatePaymentMutation();

    const due = invoice?.dueAmount ?? 0;
    const entered = amount === '' ? 0 : round2(Number(amount));

    const error =
        amount === ''
            ? undefined
            : !Number.isFinite(entered) || entered <= 0
              ? 'Enter an amount greater than zero'
              : entered > due
                ? `Cannot take more than the ${money(due)} outstanding`
                : undefined;

    const close = () => {
        setAmount('');
        setNote('');
        onClose();
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!invoice) return;

        if (entered <= 0 || error) {
            toast.error(error ?? 'Enter how much the patient is paying');
            return;
        }

        try {
            const result = await createPayment({
                invoice: invoice._id,
                amount: entered,
                note: note.trim() || undefined,
            }).unwrap();

            toast.success(
                result.invoice.dueAmount > 0
                    ? `Receipt ${result.payment.receiptNumber} — ${money(result.invoice.dueAmount)} still due`
                    : `Receipt ${result.payment.receiptNumber} — invoice settled in full`,
            );
            close();
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Could not record the payment'));
        }
    };

    return (
        <Modal
            open={Boolean(invoice)}
            onClose={close}
            width={460}
            title={t('invoices.takePayment')}
            subtitle={invoice ? `${invoice.invoiceNumber} · ${invoice.patientInfo.name}` : undefined}
        >
            {invoice && (
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            background: 'var(--surface-sunken)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '12px 14px',
                            fontSize: 13,
                        }}
                    >
                        <span style={{ color: 'var(--text-muted)' }}>{t('inv.outstanding')}</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger-strong)', fontVariantNumeric: 'tabular-nums' }}>
                            {money(due)}
                        </span>
                    </div>

                    <TextField
                        label={t('booking.amountTaken')}
                        id="payment-amount"
                        type="number"
                        min={0}
                        max={due}
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        hint={t('hint.partPayment')}
                        error={error}
                    />

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setAmount(String(due))}>
                            {t('inv.payFull')} {money(due)}
                        </Button>
                        {due >= 2 && (
                            <Button type="button" variant="secondary" size="sm" onClick={() => setAmount(String(round2(due / 2)))}>
                                {t('inv.half')}
                            </Button>
                        )}
                    </div>

                    <Textarea label={t('inv.note')} optional rows={2} value={note} onChange={(event) => setNote(event.target.value)} />

                    {entered > 0 && !error && (
                        <InlineAlert tone="info">
                            Receipts {money(entered)} now, leaving {money(round2(due - entered))} due.
                        </InlineAlert>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <Button type="button" variant="secondary" onClick={close}>
                            {t('ctrl.cancel')}
                        </Button>
                        <Button type="submit" loading={isLoading} disabled={entered <= 0 || Boolean(error)}>
                            {t('inv.record')}
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default TakePaymentModal;
