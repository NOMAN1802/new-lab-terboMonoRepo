import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { useT } from '@/i18n/useLanguage';
import { apiErrorMessage, money } from '@/lib/format';
import { useCreateInvoiceMutation } from '@/services/invoicesApi';
import { useGetPatientsQuery } from '@/services/patientsApi';
import { useGetReferrersQuery } from '@/services/referrersApi';
import { useGetTestsQuery } from '@/services/testsApi';
import type { LabTest } from '@/services/testsApi';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** How much of the bill is taken at the counter, right now. */
type PayMode = 'full' | 'part' | 'none';

const testRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    padding: '9px 12px',
    border: 0,
    background: 'transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    textAlign: 'left',
};

const CreateBookingPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const t = useT();

    const [patientId, setPatientId] = useState(searchParams.get('patient') ?? '');
    const [patientSearch, setPatientSearch] = useState('');
    const [referrerId, setReferrerId] = useState('');
    const [selected, setSelected] = useState<LabTest[]>([]);
    const [testSearch, setTestSearch] = useState('');
    const [notes, setNotes] = useState('');
    // Blank means "use the referrer's standing terms".
    const [discountOverride, setDiscountOverride] = useState('');
    // Settling in full at the counter is the normal case, so it starts there.
    const [payMode, setPayMode] = useState<PayMode>('full');
    const [advance, setAdvance] = useState('');

    const { data: patientData, isLoading: loadingPatients } = useGetPatientsQuery({
        search: patientSearch.trim() || undefined,
        limit: 30,
    });
    const { data: referrerData } = useGetReferrersQuery({ limit: 200 });
    const { data: testData, isLoading: loadingTests } = useGetTestsQuery({
        search: testSearch.trim() || undefined,
        limit: 200,
    });

    const [createInvoice, { isLoading: isSubmitting }] = useCreateInvoiceMutation();

    const patients = patientData?.items ?? [];
    const referrers = (referrerData?.items ?? []).filter((r) => r.isActive);
    const tests = (testData?.items ?? []).filter((t) => t.isActive);

    const patient = patients.find((p) => p._id === patientId);
    const referrer = referrers.find((r) => r._id === referrerId);

    /**
     * Preview only — the server recomputes every figure from the catalogue on
     * submit, so a mismatch here can never change what the patient is billed.
     */
    const totals = (() => {
        const gross = round2(selected.reduce((sum, test) => sum + test.price, 0));

        // The discount comes off the patient's bill. It defaults from the
        // referrer, but can be given to a walk-in too.
        const discountPercent = discountOverride !== '' ? Number(discountOverride) : (referrer?.defaultDiscountPercent ?? 0);

        const discount = round2((gross * discountPercent) / 100);
        const net = round2(gross - discount);

        // Commission is deliberately absent: booking records who referred the
        // patient, and an Admin settles what they are owed from the Doctor's
        // Commission screen.
        return { gross, discountPercent, discount, net };
    })();

    /**
     * The part-payment, validated against the previewed net. The server clamps
     * it again to the net it computes, so this is convenience, not the guard.
     */
    const advanceTaken = payMode === 'part' && advance !== '' ? round2(Number(advance)) : 0;

    const advanceError =
        payMode !== 'part' || advance === ''
            ? undefined
            : !Number.isFinite(advanceTaken) || advanceTaken <= 0
              ? 'Enter an amount greater than zero'
              : advanceTaken > totals.net
                ? `Cannot take more than the ${money(totals.net)} payable`
                : undefined;

    const addTest = (test: LabTest) => setSelected((current) => [...current, test]);
    const removeTest = (index: number) => setSelected((current) => current.filter((_, i) => i !== index));

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!patientId) {
            toast.error('Select a patient first');
            return;
        }
        if (selected.length === 0) {
            toast.error('Add at least one test');
            return;
        }
        if (advanceError) {
            toast.error(advanceError);
            return;
        }
        if (payMode === 'part' && advanceTaken <= 0) {
            toast.error('Enter how much the patient is paying now');
            return;
        }

        try {
            const invoice = await createInvoice({
                patient: patientId,
                referrer: referrerId || undefined,
                testIds: selected.map((test) => test._id),
                notes: notes.trim() || undefined,
                collectFullPayment: payMode === 'full',
                advanceAmount: payMode === 'part' ? advanceTaken : undefined,
                // Blank is omitted so the server falls back to the referrer's
                // standing discount.
                discountPercent: discountOverride !== '' ? Number(discountOverride) : undefined,
            }).unwrap();

            toast.success(
                invoice.paymentStatus === 'paid'
                    ? `Invoice ${invoice.invoiceNumber} created and paid in full`
                    : invoice.paidAmount > 0
                      ? `Invoice ${invoice.invoiceNumber} created — ${money(invoice.paidAmount)} taken, ${money(invoice.dueAmount)} due`
                      : `Invoice ${invoice.invoiceNumber} created`,
            );
            navigate(`/billing/${invoice._id}`);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not create the invoice'));
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('booking.title')}</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('booking.subtitle')}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%),1fr))', gap: 'var(--gap-grid)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
                    <Panel title={t('booking.patient')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <TextField
                                icon="search"
                                type="search"
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                placeholder={t('patients.searchPlaceholder')}
                            />

                            {loadingPatients ? (
                                <Loader message={t('booking.loadingPatients')} />
                            ) : (
                                <Select
                                    value={patientId}
                                    onChange={(e) => setPatientId(e.target.value)}
                                    placeholder={t('booking.selectPatient')}
                                    options={patients.map((option) => ({
                                        label: `${option.patientId} · ${option.name} · ${option.phone}`,
                                        value: option._id,
                                    }))}
                                />
                            )}

                            {patient && (
                                <p
                                    style={{
                                        background: 'var(--brand-tint)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '10px 14px',
                                        fontSize: 13,
                                        color: 'var(--text-body)',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    <strong style={{ color: 'var(--text-heading)' }}>{patient.name}</strong> · {patient.age} yrs · {patient.gender} ·{' '}
                                    {patient.phone}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/patients/new')}
                                style={{
                                    alignSelf: 'flex-start',
                                    border: 0,
                                    background: 'transparent',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--brand)',
                                }}
                            >
                                {t('booking.registerNew')}
                            </button>
                        </div>
                    </Panel>

                    <Panel title={t('booking.referredBy')} subtitle={t('booking.referredBySub')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Select
                                value={referrerId}
                                onChange={(e) => {
                                    setReferrerId(e.target.value);
                                    // Fall back to the new referrer's own terms.
                                    setDiscountOverride('');
                                }}
                                placeholder={t('booking.walkInOption')}
                                options={referrers.map((option) => ({
                                    label: `${option.referrerCode} · ${option.name}${option.hospital ? ` · ${option.hospital}` : ''}`,
                                    value: option._id,
                                }))}
                            />

                            <TextField
                                label={t('booking.discount')}
                                id="discount"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={discountOverride}
                                onChange={(e) => setDiscountOverride(e.target.value)}
                                placeholder={referrer ? `Default ${referrer.defaultDiscountPercent ?? 0}%` : '0'}
                                hint={t('booking.discountHint')}
                            />

                            {referrer && (
                                <InlineAlert tone="info">{t('booking.commissionNote').replace('{name}', referrer.name)}</InlineAlert>
                            )}
                        </div>
                    </Panel>

                    <Panel title={t('booking.tests')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <TextField
                                icon="search"
                                type="search"
                                value={testSearch}
                                onChange={(e) => setTestSearch(e.target.value)}
                                placeholder={t('booking.searchTests')}
                            />

                            {loadingTests ? (
                                <Loader message={t('booking.loadingCatalogue')} />
                            ) : (
                                <ul
                                    style={{
                                        listStyle: 'none',
                                        margin: 0,
                                        padding: 0,
                                        maxHeight: 260,
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                    }}
                                >
                                    {tests.map((test) => (
                                        <li key={test._id}>
                                            <button
                                                type="button"
                                                onClick={() => addTest(test)}
                                                style={testRow}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-tint)')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
                                                        {test.testCode}
                                                    </span>{' '}
                                                    <span style={{ color: 'var(--text-body)' }}>{test.name}</span>
                                                </span>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        color: 'var(--text-muted)',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {money(test.price)}
                                                    <Icon name="plus" size={15} color="var(--brand)" />
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                    {tests.length === 0 && (
                                        <li style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                                            {t('jsx.noTestsMatch')}
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </Panel>
                </div>

                <Panel title={`${t('booking.selectedTests')} (${selected.length})`} style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {selected.length === 0 ? (
                            <p
                                style={{
                                    border: '1px dashed var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 28,
                                    textAlign: 'center',
                                    fontSize: 13,
                                    color: 'var(--text-muted)',
                                }}
                            >
                                {t('booking.noTests')}
                            </p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {selected.map((test, index) => (
                                    <li
                                        key={`${test._id}-${index}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                            background: 'var(--surface-sunken)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '10px 14px',
                                            fontSize: 13,
                                        }}
                                    >
                                        <span style={{ color: 'var(--text-body)' }}>{test.name}</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{money(test.price)}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeTest(index)}
                                                aria-label={`Remove ${test.name}`}
                                                style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                                            >
                                                <Icon name="trash-2" size={15} />
                                            </button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <dl
                            style={{
                                margin: 0,
                                borderTop: '1px solid var(--surface-muted)',
                                paddingTop: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                fontSize: 13,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <dt style={{ color: 'var(--text-muted)' }}>{t('booking.gross')}</dt>
                                <dd style={{ margin: 0, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{money(totals.gross)}</dd>
                            </div>
                            {totals.discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-strong)' }}>
                                    <dt>{t('booking.discountLine')} ({totals.discountPercent}%)</dt>
                                    <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>−{money(totals.discount)}</dd>
                                </div>
                            )}
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
                                <dt style={{ color: 'var(--text-heading)' }}>{t('booking.patientPays')}</dt>
                                <dd style={{ margin: 0, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{money(totals.net)}</dd>
                            </div>

                        </dl>

                        <Textarea label={t('booking.notes')} optional rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{t('booking.paymentNow')}</p>

                            <SegmentedControl
                                options={[
                                    { label: t('booking.full'), value: 'full' },
                                    { label: t('booking.part'), value: 'part' },
                                    { label: t('booking.none'), value: 'none' },
                                ]}
                                value={payMode}
                                onChange={(value) => setPayMode(value as PayMode)}
                            />

                            {payMode === 'part' && (
                                <TextField
                                    label={t('booking.amountTaken')}
                                    id="advance"
                                    type="number"
                                    min={0}
                                    max={totals.net}
                                    step="0.01"
                                    value={advance}
                                    onChange={(e) => setAdvance(e.target.value)}
                                    placeholder="0.00"
                                    hint={t('booking.advanceHint').replace('{amount}', money(totals.net))}
                                    error={advanceError}
                                />
                            )}

                            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                                {payMode === 'full'
                                    ? t('booking.takesInCash').replace('{amount}', money(totals.net))
                                    : payMode === 'part'
                                      ? t('booking.receiptsNow')
                                            .replace('{amount}', money(advanceTaken))
                                            .replace('{due}', money(round2(totals.net - advanceTaken)))
                                      : t('booking.leftUnpaid').replace('{amount}', money(totals.net))}
                            </p>
                        </div>

                        <Button
                            type="submit"
                            block
                            size="lg"
                            loading={isSubmitting}
                            disabled={selected.length === 0 || !patientId || Boolean(advanceError)}
                        >
                            {isSubmitting ? t('booking.creating') : payMode === 'none' ? t('booking.create') : t('booking.createAndPay')}
                        </Button>

                        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
                            {t('booking.laterNote')}
                        </p>
                    </div>
                </Panel>
            </div>
        </form>
    );
};

export default CreateBookingPage;
