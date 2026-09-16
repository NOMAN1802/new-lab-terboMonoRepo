import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import { useT } from '@/i18n/useLanguage';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { apiErrorMessage, commissionBasis, formatDate, money } from '@/lib/format';
import { useCreateCommissionPayoutMutation, useGetCommissionPayoutsQuery, useGetPendingCommissionQuery } from '@/services/commissionPayoutsApi';
import type { CommissionPayout } from '@/services/commissionPayoutsApi';
import { useGetReferrersQuery } from '@/services/referrersApi';

const CommissionPayoutsPage = () => {
    const t = useT();
    const [searchParams, setSearchParams] = useSearchParams();
    const referrerId = searchParams.get('referrer') ?? '';
    const [note, setNote] = useState('');

    const { data: referrerData } = useGetReferrersQuery({ limit: 200 });
    const { data: payoutData, isLoading, isError, refetch } = useGetCommissionPayoutsQuery();
    const { data: pending, isFetching: loadingPending } = useGetPendingCommissionQuery(referrerId, { skip: !referrerId });

    const [createPayout, { isLoading: isPaying }] = useCreateCommissionPayoutMutation();

    // Only settled invoices can be paid out, so this is what gates the control.
    const payable = (pending?.invoices.length ?? 0) > 0;

    const referrers = referrerData?.items ?? [];
    const payouts = payoutData?.items ?? [];

    const handlePayout = async () => {
        if (!pending || pending.invoices.length === 0) return;

        if (
            !window.confirm(
                `Record a payout of ${money(pending.totalPending)} to ${pending.referrer.name} covering ${pending.invoices.length} invoice(s)?`,
            )
        ) {
            return;
        }

        try {
            const payout = await createPayout({
                referrer: referrerId,
                invoiceIds: pending.invoices.map((invoice) => invoice._id),
                note: note.trim() || undefined,
            }).unwrap();

            toast.success(`Payout ${payout.payoutNumber} recorded`);
            setNote('');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not record the payout'));
        }
    };

    return (
        <>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('comm.title')}</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('comm.subtitle')}
                </p>
            </div>

            <Panel title={t('ttl.settleReferrer')} subtitle={t('ttl.payoutCovers')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <Select
                        value={referrerId}
                        onChange={(e) => {
                            const next = e.target.value;
                            setSearchParams(next ? { referrer: next } : {});
                        }}
                        placeholder={t('ph.selectReferrer')}
                        options={referrers.map((referrer) => ({
                            label: `${referrer.referrerCode} · ${referrer.name}`,
                            value: referrer._id,
                        }))}
                        style={{ maxWidth: 420 }}
                    />

                    {referrerId && loadingPending && <Loader message={t('ld.pendingCommission')} />}

                    {referrerId && pending && !loadingPending && (
                        <>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 16,
                                    flexWrap: 'wrap',
                                    background: 'var(--warning-bg)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '14px 20px',
                                }}
                            >
                                <div>
                                    <p style={{ fontSize: 13, color: 'var(--text-body)' }}>
                                        Pending for <strong style={{ color: 'var(--text-heading)' }}>{pending.referrer.name}</strong>
                                    </p>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {pending.invoices.length} {t('comm.readyToPay')}
                                    </p>
                                </div>
                                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>
                                    {money(pending.totalPending)}
                                </p>
                            </div>

                            {pending.awaitingSettlement.invoiceCount > 0 && (
                                <InlineAlert tone="info">
                                    {money(pending.awaitingSettlement.total)} {t('comm.awaiting')} ·{' '}
                                    {pending.awaitingSettlement.invoiceCount}{' '}
                                    {pending.awaitingSettlement.invoiceCount === 1
                                        ? t('invoices.one')
                                        : t('invoices.many')}
                                    . {t('comm.payableRule')}
                                </InlineAlert>
                            )}

                            {pending.invoices.length === 0 ? (
                                <p
                                    style={{
                                        border: '1px dashed var(--border-subtle)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 32,
                                        textAlign: 'center',
                                        fontSize: 13,
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    {pending.awaitingSettlement.invoiceCount > 0
                                        ? `${t('comm.nothingPayable')} ${t('comm.payableRule')}`
                                        : t('jsx.nothingOutstandingRef')}
                                </p>
                            ) : (
                                <>
                                    <div style={{ border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <DataTable
                                            dense
                                            minWidth="34rem"
                                            rows={pending.invoices.map((invoice) => ({ ...invoice, id: invoice._id }))}
                                            columns={[
                                                {
                                                    key: 'invoiceNumber',
                                                    header: t('col.invoice'),
                                                    mono: true,
                                                    render: (invoice) => (
                                                        <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{invoice.invoiceNumber}</span>
                                                    ),
                                                },
                                                {
                                                    key: 'visitDate',
                                                    header: t('col.date'),
                                                    render: (invoice) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(invoice.visitDate)}</span>,
                                                },
                                                { key: 'netPayable', header: t('col.net'), align: 'right', render: (invoice) => money(invoice.netPayable) },
                                                {
                                                    key: 'rate',
                                                    header: t('crep.rate'),
                                                    align: 'right',
                                                    render: (invoice) => (
                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                            {commissionBasis(invoice.commissionType, invoice.commissionValue)}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    key: 'commissionAmount',
                                                    header: t('col.commission'),
                                                    align: 'right',
                                                    render: (invoice) => (
                                                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                                                            {money(invoice.commissionAmount)}
                                                        </span>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </div>

                                </>
                            )}

                            {/*
                              The payout control stays put whether or not anything
                              is payable, and disables instead of disappearing: a
                              button that only exists sometimes reads as a bug, and
                              the disabled state is where the rule gets explained.
                            */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                                <TextField
                                    label={t('inv.note')}
                                    optional
                                    disabled={!payable}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={t('ph.paidCash')}
                                    hint={t('hint.payoutNote')}
                                    style={{ flex: 1, minWidth: 260 }}
                                />
                                <Button
                                    variant="accent"
                                    icon="circle-check"
                                    loading={isPaying}
                                    disabled={!payable}
                                    title={payable ? undefined : t('comm.payableRule')}
                                    onClick={handlePayout}
                                    style={{ height: 'var(--control-h)' }}
                                >
                                    {isPaying
                                        ? t('comm.recording')
                                        : payable
                                          ? `${t('comm.recordPayout')} ${money(pending.totalPending)}`
                                          : t('comm.nothingPayable')}
                                </Button>
                            </div>

                            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                                <Icon name="info" size={14} />
                                {t('comm.noReversal')}
                            </p>
                        </>
                    )}
                </div>
            </Panel>

            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Payout history</h3>

            {isLoading ? (
                <Loader message={t('ld.payouts')} />
            ) : isError ? (
                <ErrorState title={t('err.payouts')} onRetry={refetch} />
            ) : (
                <Panel padding="0">
                    <DataTable<CommissionPayout & { id: string }>
                        minWidth="46rem"
                        empty={t('empty.commission')}
                        rows={payouts.map((payout) => ({ ...payout, id: payout._id }))}
                        columns={[
                            {
                                key: 'payoutNumber',
                                header: 'Payout',
                                mono: true,
                                render: (payout) => <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{payout.payoutNumber}</span>,
                            },
                            {
                                key: 'referrerName',
                                header: t('col.referrer'),
                                render: (payout) => (
                                    <div>
                                        <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{payout.referrerName}</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                            {payout.referrerCode}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                key: 'paidOn',
                                header: 'Paid on',
                                render: (payout) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(payout.paidOn)}</span>,
                            },
                            {
                                key: 'note',
                                header: 'Note',
                                render: (payout) => payout.note || <span style={{ color: 'var(--text-faint)' }}>—</span>,
                            },
                            { key: 'invoiceCount', header: t('col.invoices'), align: 'right' },
                            {
                                key: 'amount',
                                header: 'Amount',
                                align: 'right',
                                render: (payout) => <span style={{ fontWeight: 600, color: 'var(--success-strong)' }}>{money(payout.amount)}</span>,
                            },
                        ]}
                    />
                </Panel>
            )}
        </>
    );
};

export default CommissionPayoutsPage;
