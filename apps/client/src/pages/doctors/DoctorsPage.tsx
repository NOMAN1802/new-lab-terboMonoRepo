import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ConfirmModal from '@/components/common/ConfirmModal';
import type { ConfirmRequest } from '@/components/common/ConfirmModal';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatusBadge from '@/components/common/StatusBadge';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import Panel from '@/components/ui/Panel';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { apiErrorMessage, money } from '@/lib/format';
import {
    useDeleteDoctorMutation,
    useGetDoctorsQuery,
    useUpdateDoctorMutation,
} from '@/services/doctorsApi';
import type { Doctor } from '@/services/doctorsApi';

type Form = {
    name: string;
    specialty: string;
    degrees: string;
    phone: string;
    consultationFee: string;
    email: string;
    password: string;
    isActive: boolean;
};

const EMPTY: Form = {
    name: '',
    specialty: '',
    degrees: '',
    phone: '',
    consultationFee: '',
    email: '',
    password: '',
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

const DoctorsPage = () => {
    const { isAdmin } = useRole();
    const navigate = useNavigate();
    const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
    const [search, setSearch] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Doctor | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);

    const { data, isLoading, isError, refetch } = useGetDoctorsQuery({ search: search.trim() || undefined });
    const [updateDoctor, { isLoading: isUpdating }] = useUpdateDoctorMutation();
    const [deleteDoctor] = useDeleteDoctorMutation();

    const startEdit = (doctor: Doctor) => {
        setEditing(doctor);
        setForm({
            name: doctor.name,
            specialty: doctor.specialty,
            degrees: doctor.degrees ?? '',
            phone: doctor.phone,
            consultationFee: String(doctor.consultationFee),
            email: doctor.user?.email ?? '',
            password: '',
            isActive: doctor.isActive,
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
        // Doctors are created from the Users page; this form only edits one.
        if (!editing) return;

        const fee = Number(form.consultationFee);
        if (!form.name.trim() || !form.specialty.trim() || !form.phone.trim()) {
            toast.error('Name, specialty and phone are required');
            return;
        }
        if (form.consultationFee === '' || Number.isNaN(fee) || fee < 0) {
            toast.error('Enter the consultation fee in taka');
            return;
        }

        const profile = {
            name: form.name.trim(),
            specialty: form.specialty.trim(),
            degrees: form.degrees.trim() || undefined,
            phone: form.phone.trim(),
            consultationFee: fee,
        };

        try {
            if (editing) {
                await updateDoctor({
                    id: editing._id,
                    data: { ...profile, isActive: form.isActive, password: form.password || undefined },
                }).unwrap();
                toast.success('Doctor updated. Existing schedules keep their fee.');
            }
            closeForm();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not save doctor'));
        }
    };

    const handleDelete = (doctor: Doctor) =>
        setConfirmRequest({
            title: `Remove ${doctor.name}?`,
            description: 'Their login is disabled. Past schedules and appointments stay on record.',
            confirmLabel: 'Remove doctor',
            onConfirm: async () => {
                try {
                    await deleteDoctor(doctor._id).unwrap();
                    toast.success('Doctor removed');
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not remove doctor'));
                }
            },
        });

    const doctors = data?.items ?? [];
    const isSaving = isUpdating;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>Doctors</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        Consulting doctors who can be given schedules and booked by patients. A doctor is a user: add one from
                        the Users page, and edit their clinical details here.
                    </p>
                </div>
                {isAdmin && (
                    <Button icon="plus" onClick={() => navigate('/users?add=doctor')}>
                        Add a doctor
                    </Button>
                )}
            </div>

            <div style={{ maxWidth: 420 }}>
                <TextField
                    icon="search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, specialty or phone"
                />
            </div>

            {isAdmin && isFormOpen && (
                <Panel title={editing ? `Edit ${editing.name}` : 'New doctor'} style={{ borderColor: 'var(--indigo-200)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                            <TextField
                                label="Name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Dr. Nasrin Akter"
                            />
                            <TextField
                                label="Specialty"
                                value={form.specialty}
                                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                                placeholder="Medicine, Cardiology…"
                            />
                            <TextField
                                label="Degrees"
                                optional
                                value={form.degrees}
                                onChange={(e) => setForm({ ...form, degrees: e.target.value })}
                                placeholder="MBBS, FCPS"
                            />
                            <TextField
                                label="Phone"
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="01XXXXXXXXX"
                            />
                            <TextField
                                label="Consultation fee (৳)"
                                type="number"
                                min={0}
                                step="1"
                                value={form.consultationFee}
                                onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
                                hint="Default for new schedules. Each schedule keeps the fee it was created with."
                            />
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))',
                                gap: 18,
                                background: 'var(--surface-sunken)',
                                borderRadius: 'var(--radius-md)',
                                padding: 20,
                            }}
                        >
                            <TextField
                                label="Login email"
                                type="email"
                                disabled={Boolean(editing)}
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                hint={editing ? 'The login email cannot be changed here.' : 'The doctor signs in with this.'}
                            />
                            <TextField
                                label={editing ? 'New password' : 'Password'}
                                type="password"
                                optional={Boolean(editing)}
                                autoComplete="new-password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                hint={editing ? 'Leave blank to keep the current password.' : 'At least 6 characters.'}
                            />
                        </div>

                        {editing && (
                            <Checkbox
                                accent="brand"
                                label="Active (can sign in and be given schedules)"
                                checked={form.isActive}
                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button variant="secondary" onClick={closeForm}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Add doctor'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            )}

            {isLoading ? (
                <Loader message="Loading doctors..." />
            ) : isError ? (
                <ErrorState title="Could not load doctors" onRetry={refetch} />
            ) : (
                <Panel padding="0">
                    <DataTable<Doctor & { id: string }>
                        minWidth="46rem"
                        empty={search ? `No doctors match "${search}".` : 'No doctors added yet.'}
                        rows={doctors.map((doctor) => ({ ...doctor, id: doctor._id }))}
                        columns={[
                            {
                                key: 'doctorCode',
                                header: 'Code',
                                mono: true,
                                render: (doctor) => (
                                    <span style={{ fontWeight: 600, color: 'var(--brand)', opacity: doctor.isActive ? 1 : 0.5 }}>
                                        {doctor.doctorCode}
                                    </span>
                                ),
                            },
                            {
                                key: 'name',
                                header: 'Doctor',
                                render: (doctor) => (
                                    <div style={{ opacity: doctor.isActive ? 1 : 0.5 }}>
                                        <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{doctor.name}</p>
                                        {doctor.degrees && (
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{doctor.degrees}</p>
                                        )}
                                    </div>
                                ),
                            },
                            { key: 'specialty', header: 'Specialty', render: (doctor) => doctor.specialty },
                            {
                                key: 'phone',
                                header: 'Phone',
                                render: (doctor) => (
                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{doctor.phone}</span>
                                ),
                            },
                            {
                                key: 'fee',
                                header: 'Fee',
                                align: 'right',
                                render: (doctor) => (
                                    <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{money(doctor.consultationFee)}</span>
                                ),
                            },
                            {
                                key: 'status',
                                header: 'Status',
                                render: (doctor) => <StatusBadge status={doctor.isActive ? 'active' : 'inactive'} />,
                            },
                            ...(isAdmin
                                ? [
                                      {
                                          key: 'actions',
                                          header: 'Actions',
                                          align: 'right' as const,
                                          render: (doctor: Doctor) => (
                                              <span style={{ display: 'inline-flex', gap: 4 }}>
                                                  <button
                                                      type="button"
                                                      aria-label={`Edit ${doctor.name}`}
                                                      onClick={() => startEdit(doctor)}
                                                      style={{ ...rowAction, color: 'var(--brand)' }}
                                                  >
                                                      <Icon name="pencil" size={16} />
                                                  </button>
                                                  <button
                                                      type="button"
                                                      aria-label={`Remove ${doctor.name}`}
                                                      onClick={() => handleDelete(doctor)}
                                                      style={{ ...rowAction, color: 'var(--danger-strong)' }}
                                                  >
                                                      <Icon name="power-off" size={16} />
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

            <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />
        </>
    );
};

export default DoctorsPage;
