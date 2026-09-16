import { useState } from 'react';
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
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { apiErrorMessage, money } from '@/lib/format';
import { useGetTestCategoriesQuery } from '@/services/testCategoriesApi';
import { useCreateTestMutation, useDeleteTestMutation, useGetTestsQuery, useUpdateTestMutation } from '@/services/testsApi';
import type { LabTest, LabTestInput } from '@/services/testsApi';

const EMPTY: LabTestInput = {
    testCode: '',
    name: '',
    category: '',
    price: 0,
    sampleType: '',
    reportDeliveryDays: 1,
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

const TestsPage = () => {
    const t = useT();
    const { isAdmin } = useRole();
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<LabTest | null>(null);
    const [isFormOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<LabTestInput>(EMPTY);

    const { data, isLoading, isError, refetch } = useGetTestsQuery({
        search: search.trim() || undefined,
    });
    const { data: categoryData } = useGetTestCategoriesQuery();

    const [createTest, { isLoading: isCreating }] = useCreateTestMutation();
    const [updateTest, { isLoading: isUpdating }] = useUpdateTestMutation();
    const [deleteTest] = useDeleteTestMutation();

    const startCreate = () => {
        // Clearing `editing` matters: without it, opening the form after an
        // edit would submit an update instead of creating a new test.
        setEditing(null);
        setForm(EMPTY);
        setFormOpen(true);
    };

    const startEdit = (test: LabTest) => {
        const categoryId = typeof test.category === 'object' ? test.category?._id : test.category;

        setEditing(test);
        setForm({
            testCode: test.testCode,
            name: test.name,
            category: categoryId ?? '',
            price: test.price,
            sampleType: test.sampleType ?? '',
            reportDeliveryDays: test.reportDeliveryDays ?? 1,
            isActive: test.isActive,
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

        if (!form.testCode.trim() || !form.name.trim()) {
            toast.error('Test code and name are required');
            return;
        }
        if (form.price < 0) {
            toast.error('Price cannot be negative');
            return;
        }

        const payload: LabTestInput = {
            ...form,
            testCode: form.testCode.trim().toUpperCase(),
            name: form.name.trim(),
            category: form.category || undefined,
            sampleType: form.sampleType?.trim() || undefined,
        };

        try {
            if (editing) {
                await updateTest({ id: editing._id, data: payload }).unwrap();
                toast.success('Test updated');
            } else {
                await createTest(payload).unwrap();
                toast.success('Test added to the catalogue');
            }
            closeForm();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not save test'));
        }
    };

    const handleDelete = async (test: LabTest) => {
        if (!window.confirm(`Remove "${test.name}" from the catalogue?`)) return;
        try {
            await deleteTest(test._id).unwrap();
            toast.success('Test removed');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not remove test'));
        }
    };

    const tests = data?.items ?? [];
    const categories = categoryData?.items ?? [];
    const isSaving = isCreating || isUpdating;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>Test catalogue</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {tests.length} tests · prices apply to every new booking
                    </p>
                </div>
                {isAdmin && (
                    <Button icon="plus" onClick={startCreate}>
                        {t('jsx.addTest')}
                    </Button>
                )}
            </div>

            <div style={{ maxWidth: 420 }}>
                <TextField icon="search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('ph.searchNameCode')} />
            </div>

            {isFormOpen && isAdmin && (
                <Panel title={editing ? `Edit ${editing.name}` : 'New test'} style={{ borderColor: 'var(--indigo-200)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                            <TextField
                                label={t('fld.testCode')}
                                value={form.testCode}
                                onChange={(e) => setForm({ ...form, testCode: e.target.value })}
                                placeholder="CBC"
                            />
                            <TextField
                                label={t('fld.testName')}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Complete Blood Count"
                            />
                            <Select
                                label={t('col.department')}
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                placeholder={t('ph.unassigned')}
                                options={categories.map((category) => ({ label: category.name, value: category._id }))}
                            />
                            <TextField
                                label={t('fld.priceTk')}
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.price || ''}
                                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                            />
                            <TextField
                                label={t('fld.sampleType')}
                                optional
                                value={form.sampleType}
                                onChange={(e) => setForm({ ...form, sampleType: e.target.value })}
                                placeholder={t('ph.sample')}
                            />
                            <TextField
                                label={t('fld.reportDays')}
                                type="number"
                                min={0}
                                value={form.reportDeliveryDays ?? ''}
                                onChange={(e) => setForm({ ...form, reportDeliveryDays: Number(e.target.value) })}
                            />
                        </div>

                        <Checkbox
                            accent="brand"
                            label={t('fld.availableBooking')}
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button variant="secondary" onClick={closeForm}>
                                {t('ctrl.cancel')}
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Add test'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            )}

            {isLoading ? (
                <Loader message={t('ld.catalogue')} />
            ) : isError ? (
                <ErrorState title={t('err.catalogue')} onRetry={refetch} />
            ) : (
                <Panel padding="0">
                    <DataTable<LabTest & { id: string }>
                        minWidth="52rem"
                        empty={search ? `No tests match "${search}".` : 'The catalogue is empty.'}
                        rows={tests.map((test) => ({ ...test, id: test._id }))}
                        columns={[
                            {
                                key: 'testCode',
                                header: t('col.code'),
                                mono: true,
                                render: (test) => (
                                    <span style={{ fontWeight: 600, color: 'var(--brand)', opacity: test.isActive ? 1 : 0.5 }}>{test.testCode}</span>
                                ),
                            },
                            {
                                key: 'name',
                                header: t('col.test'),
                                render: (test) => (
                                    <span style={{ opacity: test.isActive ? 1 : 0.5 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{test.name}</span>
                                        {!test.isActive && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-faint)' }}>(inactive)</span>}
                                    </span>
                                ),
                            },
                            {
                                key: 'category',
                                header: t('col.department'),
                                render: (test) =>
                                    test.categoryName ?? (typeof test.category === 'object' ? test.category?.name : null) ?? (
                                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                                    ),
                            },
                            {
                                key: 'sampleType',
                                header: t('col.sample'),
                                render: (test) => <span style={{ color: 'var(--text-muted)' }}>{test.sampleType || '—'}</span>,
                            },
                            {
                                key: 'reportDeliveryDays',
                                header: t('col.reportIn'),
                                align: 'right',
                                render: (test) => {
                                    const days = test.reportDeliveryDays ?? 1;
                                    return `${days} ${days === 1 ? 'day' : 'days'}`;
                                },
                            },
                            { key: 'status', header: t('col.status'), render: (test) => <StatusBadge status={test.isActive ? 'active' : 'inactive'} /> },
                            {
                                key: 'price',
                                header: t('col.price'),
                                align: 'right',
                                render: (test) => <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{money(test.price)}</span>,
                            },
                            ...(isAdmin
                                ? [
                                      {
                                          key: 'actions',
                                          header: t('col.actions'),
                                          align: 'right' as const,
                                          render: (test: LabTest) => (
                                              <span style={{ display: 'inline-flex', gap: 4 }}>
                                                  <button
                                                      type="button"
                                                      aria-label={`Edit ${test.name}`}
                                                      onClick={() => startEdit(test)}
                                                      style={{ ...rowAction, color: 'var(--brand)' }}
                                                  >
                                                      <Icon name="pencil" size={16} />
                                                  </button>
                                                  <button
                                                      type="button"
                                                      aria-label={`Remove ${test.name}`}
                                                      onClick={() => handleDelete(test)}
                                                      style={{ ...rowAction, color: 'var(--danger-strong)' }}
                                                  >
                                                      <Icon name="trash-2" size={16} />
                                                  </button>
                                              </span>
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </Panel>
            )}
        </>
    );
};

export default TestsPage;
