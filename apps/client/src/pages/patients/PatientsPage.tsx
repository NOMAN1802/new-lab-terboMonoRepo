import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import Panel from '@/components/ui/Panel';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import TextField from '@/components/ui/TextField';
import Icon from '@/components/ui/Icon';
import { useRole } from '@/hooks/useRole';
import { useT } from '@/i18n/useLanguage';
import { apiErrorMessage, formatDate } from '@/lib/format';
import { useDeletePatientMutation, useGetPatientsQuery } from '@/services/patientsApi';
import type { Patient } from '@/services/patientsApi';
import type { CSSProperties } from 'react';

const PAGE_SIZE = 20;

const actionIconStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: 0,
    background: 'transparent',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-control)',
};

const PatientsPage = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const { isAdmin } = useRole();
    const t = useT();
    const navigate = useNavigate();

    const { data, isLoading, isFetching, isError, refetch } = useGetPatientsQuery({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
    });

    const [deletePatient, { isLoading: isDeleting }] = useDeletePatientMutation();

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete patient "${name}"? Their visit history stays on file.`)) {
            return;
        }
        try {
            await deletePatient(id).unwrap();
            toast.success('Patient deleted');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not delete patient'));
        }
    };

    const patients = data?.items ?? [];
    const total = data?.meta.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('patients.title')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {total} {total === 1 ? t('patients.countOne') : t('patients.countMany')}
                    </p>
                </div>
                <Button icon="user-round-plus" onClick={() => navigate('/patients/new')}>
                    {t('patients.register')}
                </Button>
            </div>

            <div style={{ maxWidth: 420 }}>
                <TextField
                    icon="search"
                    type="search"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder={t('patients.searchPlaceholder')}
                />
            </div>

            {isLoading ? (
                <Loader message={t('patients.loading')} />
            ) : isError ? (
                <ErrorState title={t('patients.loadError')} description={t('patients.loadErrorBody')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<Patient & { id: string }>
                            minWidth="46rem"
                            empty={search ? t('shell.nothingMatches') : t('patients.none')}
                            rows={patients.map((patient) => ({ ...patient, id: patient._id }))}
                            columns={[
                                {
                                    key: 'patientId',
                                    header: t('col.patientId'),
                                    mono: true,
                                    render: (row) => (
                                        <Link to={`/patients/${row._id}`} style={{ fontWeight: 600 }}>
                                            {row.patientId}
                                        </Link>
                                    ),
                                },
                                {
                                    key: 'name',
                                    header: t('col.name'),
                                    render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.name}</span>,
                                },
                                {
                                    key: 'ageSex',
                                    header: t('col.ageSex'),
                                    render: (row) => (
                                        <span style={{ textTransform: 'capitalize' }}>
                                            {row.age} / {row.gender}
                                        </span>
                                    ),
                                },
                                { key: 'phone', header: t('col.phone'), render: (row) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.phone}</span> },
                                {
                                    key: 'createdAt',
                                    header: t('col.registered'),
                                    render: (row) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.createdAt)}</span>,
                                },
                                {
                                    key: 'actions',
                                    header: t('col.actions'),
                                    align: 'right',
                                    render: (row) => (
                                        <span style={{ display: 'inline-flex', gap: 4 }}>
                                            <Link
                                                to={`/patients/${row._id}`}
                                                aria-label={`View history for ${row.name}`}
                                                style={actionIconStyle}
                                            >
                                                <Icon name="history" size={16} />
                                            </Link>
                                            <Link
                                                to={`/billing/new?patient=${row._id}`}
                                                aria-label={`Book tests for ${row.name}`}
                                                style={{ ...actionIconStyle, color: 'var(--success-strong)' }}
                                            >
                                                <Icon name="flask-conical" size={16} />
                                            </Link>
                                            <Link
                                                to={`/patients/${row._id}/edit`}
                                                aria-label={`Edit ${row.name}`}
                                                style={actionIconStyle}
                                            >
                                                <Icon name="pencil" size={16} />
                                            </Link>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    disabled={isDeleting}
                                                    aria-label={`Delete ${row.name}`}
                                                    onClick={() => handleDelete(row._id, row.name)}
                                                    style={{
                                                        ...actionIconStyle,
                                                        color: 'var(--danger-strong)',
                                                        opacity: isDeleting ? 0.5 : 1,
                                                    }}
                                                >
                                                    <Icon name="trash-2" size={16} />
                                                </button>
                                            )}
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Panel>

                    <Pagination page={page} totalPages={totalPages} busy={isFetching} onChange={setPage} />
                </>
            )}
        </>
    );
};

export default PatientsPage;
