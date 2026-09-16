import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import Panel from '@/components/ui/Panel';
import { useT } from '@/i18n/useLanguage';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TextField from '@/components/ui/TextField';
import { apiErrorMessage, commissionBasis, percent } from '@/lib/format';
import {
    useCreateReferrerMutation,
    useDeleteReferrerMutation,
    useGetReferrersQuery,
    useUpdateReferrerMutation,
} from '@/services/referrersApi';
import type { Referrer, ReferrerInput } from '@/services/referrersApi';
import type { CommissionType } from '@/services/invoicesApi';

const EMPTY: ReferrerInput = {
    referrerCode: '',
    name: '',
    designation: '',
    hospital: '',
    phone: '',
    address: '',
    defaultDiscountPercent: 0,
    defaultCommissionType: 'percent',
    defaultCommissionValue: 0,
    isActive: true,
};

const rowAction: React.CSSProperties = {
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

const ReferrersPage = () => {
    const t = useT();
    const [search, setSearch] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Referrer | null>(null);
    const [form, setForm] = useState<ReferrerInput>(EMPTY);

    const { data, isLoading, isError, refetch } = useGetReferrersQuery({
        search: search.trim() || undefined,
    });
    const [createReferrer, { isLoading: isCreating }] = useCreateReferrerMutation();
    const [updateReferrer, { isLoading: isUpdating }] = useUpdateReferrerMutation();
    const [deleteReferrer] = useDeleteReferrerMutation();

    const startCreate = () => {
        // Clearing `editing` matters: without it, opening the form after an
        // edit would submit an update instead of creating a new referrer.
        setEditing(null);
        setForm(EMPTY);
        setFormOpen(true);
    };

    const startEdit = (referrer: Referrer) => {
        setEditing(referrer);
        setForm({
            referrerCode: referrer.referrerCode,
            name: referrer.name,
            designation: referrer.designation ?? '',
            hospital: referrer.hospital ?? '',
            phone: referrer.phone,
            address: referrer.address ?? '',
            defaultDiscountPercent: referrer.defaultDiscountPercent ?? 0,
            defaultCommissionType: referrer.defaultCommissionType ?? 'percent',
            defaultCommissionValue: referrer.defaultCommissionValue ?? 0,
            isActive: referrer.isActive,
        });
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditing(null);
        setForm(EMPTY);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!form.referrerCode.trim() || !form.name.trim() || !form.phone.trim()) {
            toast.error('Code, name and phone are required');
            return;
        }

        const payload: ReferrerInput = {
            ...form,
            referrerCode: form.referrerCode.trim().toUpperCase(),
            name: form.name.trim(),
            phone: form.phone.trim(),
            designation: form.designation?.trim() || undefined,
            hospital: form.hospital?.trim() || undefined,
            address: form.address?.trim() || undefined,
        };

        try {
            if (editing) {
                await updateReferrer({ id: editing._id, data: payload }).unwrap();
                toast.success('Referrer updated. Existing invoices keep their original rates.');
            } else {
                await createReferrer(payload).unwrap();
                toast.success('Referrer added');
            }
            closeForm();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not save referrer'));
        }
    };

    const handleDelete = async (referrer: Referrer) => {
        if (!window.confirm(`Deactivate ${referrer.name}? Past invoices and any unpaid commission stay on record.`)) {
            return;
        }
        try {
            await deleteReferrer(referrer._id).unwrap();
            toast.success('Referrer deactivated');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not deactivate referrer'));
        }
    };

    const referrers = data?.items ?? [];
    const isSaving = isCreating || isUpdating;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>Referrers (RFE)</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('jsx.defaultRatesNote')}
                    </p>
                </div>
                <Button icon="plus" onClick={startCreate}>
                    {t('jsx.addReferrer')}
                </Button>
            </div>

            <div style={{ maxWidth: 420 }}>
                <TextField
                    icon="search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('ph.searchReferrer')}
                />
            </div>

            {isFormOpen && (
                <Panel title={editing ? `Edit ${editing.name}` : 'New referrer'} style={{ borderColor: 'var(--indigo-200)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                            <TextField
                                label={t('fld.code')}
                                value={form.referrerCode}
                                onChange={(e) => setForm({ ...form, referrerCode: e.target.value })}
                                placeholder="RFE-001"
                            />
                            <TextField
                                label={t('col.name')}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Dr. Rakesh Shaha"
                            />
                            <TextField
                                label={t('fld.designation')}
                                optional
                                value={form.designation}
                                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                placeholder="MBBS, FCPS"
                            />
                            <TextField
                                label={t('fld.hospital')}
                                optional
                                value={form.hospital}
                                onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                            />
                            <TextField
                                label={t('col.phone')}
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="01XXXXXXXXX"
                            />
                            <TextField
                                label={t('fld.address')}
                                optional
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                            />
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))',
                                gap: 18,
                                background: 'var(--warning-bg)',
                                borderRadius: 'var(--radius-md)',
                                padding: 20,
                            }}
                        >
                            <TextField
                                label={t('fld.defaultDiscount')}
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={form.defaultDiscountPercent ?? 0}
                                onChange={(e) => setForm({ ...form, defaultDiscountPercent: Number(e.target.value) })}
                                hint={t('hint.discount')}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <span style={{ font: 'var(--type-label)', color: 'var(--text-body)' }}>Default commission</span>
                                <SegmentedControl
                                    options={[
                                        { label: '% of paid', value: 'percent' },
                                        { label: 'Fixed ৳', value: 'fixed' },
                                    ]}
                                    value={form.defaultCommissionType ?? 'percent'}
                                    onChange={(value) => setForm({ ...form, defaultCommissionType: value as CommissionType })}
                                />
                                <TextField
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.defaultCommissionValue ?? 0}
                                    onChange={(e) => setForm({ ...form, defaultCommissionValue: Number(e.target.value) })}
                                    hint={t('hint.commissionRate')}
                                />
                            </div>
                        </div>

                        <Checkbox
                            accent="brand"
                            label={t('fld.availableSelect')}
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button variant="secondary" onClick={closeForm}>
                                {t('ctrl.cancel')}
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Add referrer'}
                            </Button>
                        </div>

                        {editing && (
                            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                                <Icon name="info" size={14} />
                                {t('jsx.rateChangeNote')}
                            </p>
                        )}
                    </form>
                </Panel>
            )}

            {isLoading ? (
                <Loader message={t('ld.referrers')} />
            ) : isError ? (
                <ErrorState title={t('err.referrers')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<Referrer & { id: string }>
                            minWidth="48rem"
                            empty={search ? `No referrers match "${search}".` : 'No referrers added yet.'}
                            rows={referrers.map((referrer) => ({ ...referrer, id: referrer._id }))}
                            columns={[
                                {
                                    key: 'referrerCode',
                                    header: t('col.code'),
                                    mono: true,
                                    render: (referrer) => (
                                        <span style={{ fontWeight: 600, color: 'var(--brand)', opacity: referrer.isActive ? 1 : 0.5 }}>
                                            {referrer.referrerCode}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'name',
                                    header: t('col.referrer'),
                                    render: (referrer) => (
                                        <div style={{ opacity: referrer.isActive ? 1 : 0.5 }}>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{referrer.name}</p>
                                            {referrer.designation && (
                                                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{referrer.designation}</p>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'hospital',
                                    header: 'Hospital',
                                    render: (referrer) => referrer.hospital || <span style={{ color: 'var(--text-faint)' }}>—</span>,
                                },
                                {
                                    key: 'phone',
                                    header: t('col.phone'),
                                    render: (referrer) => (
                                        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{referrer.phone}</span>
                                    ),
                                },
                                {
                                    key: 'discount',
                                    header: 'Discount',
                                    align: 'right',
                                    render: (referrer) => (
                                        <span style={{ color: 'var(--warning-strong)' }}>{percent(referrer.defaultDiscountPercent)}</span>
                                    ),
                                },
                                {
                                    key: 'commission',
                                    header: t('col.commission'),
                                    align: 'right',
                                    render: (referrer) => (
                                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                                            {commissionBasis(referrer.defaultCommissionType, referrer.defaultCommissionValue)}
                                        </span>
                                    ),
                                },
                                { key: 'status', header: t('col.status'), render: (referrer) => <StatusBadge status={referrer.isActive ? 'active' : 'inactive'} /> },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (referrer) => (
                                        <span style={{ display: 'inline-flex', gap: 4 }}>
                                            <Link
                                                to={`/commission?referrer=${referrer._id}`}
                                                aria-label={`Commission for ${referrer.name}`}
                                                style={{ ...rowAction, color: 'var(--success-strong)' }}
                                            >
                                                <Icon name="banknote" size={16} />
                                            </Link>
                                            <button
                                                type="button"
                                                aria-label={`Edit ${referrer.name}`}
                                                onClick={() => startEdit(referrer)}
                                                style={{ ...rowAction, color: 'var(--brand)' }}
                                            >
                                                <Icon name="pencil" size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Deactivate ${referrer.name}`}
                                                onClick={() => handleDelete(referrer)}
                                                style={{ ...rowAction, color: 'var(--danger-strong)' }}
                                            >
                                                <Icon name="power-off" size={16} />
                                            </button>
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Panel>

                    <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                        <Icon name="info" size={14} />
                        {t('jsx.deactivateNote')}
                    </p>
                </>
            )}
        </>
    );
};

export default ReferrersPage;
