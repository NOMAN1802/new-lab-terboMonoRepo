import { useState } from 'react';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import Panel from '@/components/ui/Panel';
import { useT } from '@/i18n/useLanguage';
import TextField from '@/components/ui/TextField';
import { apiErrorMessage } from '@/lib/format';
import {
    useCreateTestCategoryMutation,
    useDeleteTestCategoryMutation,
    useGetTestCategoriesQuery,
    useUpdateTestCategoryMutation,
} from '@/services/testCategoriesApi';
import type { TestCategory } from '@/services/testCategoriesApi';

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

const TestCategoriesPage = () => {
    const t = useT();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [editing, setEditing] = useState<TestCategory | null>(null);
    const [isFormOpen, setFormOpen] = useState(false);

    const { data, isLoading, isError, refetch } = useGetTestCategoriesQuery();
    const [createCategory, { isLoading: isCreating }] = useCreateTestCategoryMutation();
    const [updateCategory, { isLoading: isUpdating }] = useUpdateTestCategoryMutation();
    const [deleteCategory] = useDeleteTestCategoryMutation();

    const reset = () => {
        setName('');
        setDescription('');
        setEditing(null);
        setFormOpen(false);
    };

    const startCreate = () => {
        // Clearing `editing` matters: otherwise the form would submit an update.
        setEditing(null);
        setName('');
        setDescription('');
        setFormOpen(true);
    };

    const startEdit = (category: TestCategory) => {
        setEditing(category);
        setName(category.name);
        setDescription(category.description ?? '');
        setFormOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) {
            toast.error('Department name is required');
            return;
        }

        const payload = {
            name: name.trim(),
            description: description.trim() || undefined,
        };

        try {
            if (editing) {
                await updateCategory({ id: editing._id, data: payload }).unwrap();
                toast.success('Department updated');
            } else {
                await createCategory(payload).unwrap();
                toast.success('Department created');
            }
            reset();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not save department'));
        }
    };

    const handleDelete = async (category: TestCategory) => {
        if (!window.confirm(`Delete the "${category.name}" department?`)) return;
        try {
            await deleteCategory(category._id).unwrap();
            toast.success('Department deleted');
        } catch (error) {
            // The API refuses when tests still reference it, and says how many.
            toast.error(apiErrorMessage(error, 'Could not delete department'));
        }
    };

    const categories = data?.items ?? [];
    const isSaving = isCreating || isUpdating;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>Departments</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('jsx.departmentNote')}
                    </p>
                </div>
                <Button icon="plus" onClick={startCreate}>
                    {t('jsx.addDepartment')}
                </Button>
            </div>

            {isFormOpen && (
                <Panel title={editing ? `Edit ${editing.name}` : 'New department'} style={{ borderColor: 'var(--indigo-200)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                            <TextField label={t('fld.departmentName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Pathology" />
                            <TextField
                                label={t('fld.description')}
                                optional
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('ph.departmentCovers')}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button variant="secondary" onClick={reset}>
                                {t('ctrl.cancel')}
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Add department'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            )}

            {isLoading ? (
                <Loader message={t('ld.departments')} />
            ) : isError ? (
                <ErrorState title={t('err.departments')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<TestCategory & { id: string }>
                            minWidth="36rem"
                            empty={t('empty.departments')}
                            rows={categories.map((category) => ({ ...category, id: category._id }))}
                            columns={[
                                {
                                    key: 'name',
                                    header: t('col.department'),
                                    render: (category) => <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{category.name}</span>,
                                },
                                {
                                    key: 'description',
                                    header: t('col.description'),
                                    render: (category) => category.description || <span style={{ color: 'var(--text-faint)' }}>—</span>,
                                },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (category) => (
                                        <span style={{ display: 'inline-flex', gap: 4 }}>
                                            <button
                                                type="button"
                                                aria-label={`Edit ${category.name}`}
                                                onClick={() => startEdit(category)}
                                                style={{ ...rowAction, color: 'var(--brand)' }}
                                            >
                                                <Icon name="pencil" size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Delete ${category.name}`}
                                                onClick={() => handleDelete(category)}
                                                style={{ ...rowAction, color: 'var(--danger-strong)' }}
                                            >
                                                <Icon name="trash-2" size={16} />
                                            </button>
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Panel>

                    <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                        <Icon name="info" size={14} />A department cannot be deleted while tests still reference it.
                    </p>
                </>
            )}
        </>
    );
};

export default TestCategoriesPage;
