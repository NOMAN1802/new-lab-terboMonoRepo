import { useState } from 'react';
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
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { useRole } from '@/hooks/useRole';
import { apiErrorMessage, money } from '@/lib/format';
import {
    useApplyShareToPastMutation,
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
    shareType: 'percent' | 'fixed';
    shareValue: string;
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
    shareType: 'percent',
    shareValue: '0',
    email: '',
    password: '',
    isActive: true,
};

const shareLabel = (doctor: Doctor) =>
    !doctor.appointmentShareValue
        ? '—'
        : doctor.appointmentShareType === 'fixed'
          ? money(doctor.appointmentShareValue)
          : `${doctor.appointmentShareValue}%`;

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
    const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
    const [search, setSearch] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Doctor | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);

    const { data, isLoading, isError, refetch } = useGetDoctorsQuery({ search: search.trim() || undefined });
    const [updateDoctor, { isLoading: isUpdating }] = useUpdateDoctorMutation();
    const [deleteDoctor] = useDeleteDoctorMutation();
    const [applyShare, { isLoading: isApplying }] = useApplyShareToPastMutation();

    const askApplyShare = (doctor: Doctor) =>
        setConfirmRequest({
            title: `Apply ${doctor.name}'s share to past appointments?`,
            description:
                `Their saved share (${shareLabel(doctor) === '—' ? 'none' : shareLabel(doctor)}) is put on every past appointment ` +
                'that is not cancelled and not yet paid out. Appointments already paid out stay as they are. Save any change to the share first.',
            confirmLabel: 'Apply share',
            onConfirm: async () => {
                try {
                    const result = await applyShare(doctor._id).unwrap();
                    toast.success(
                        result.updated > 0
                            ? `Updated ${result.updated} appointment(s). ${money(result.total)} is now owed to ${doctor.name} across ${result.appointments} unpaid appointment(s).`
                            : `Nothing to change. ${result.appointments} unpaid appointment(s) already carry this share.`
                    );
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Could not apply the share'));
                }
            },
        });

    const startEdit = (doctor: Doctor) => {
        setEditing(doctor);
        setForm({
            name: doctor.name,
            specialty: doctor.specialty,
            degrees: doctor.degrees ?? '',
            phone: doctor.phone,
            consultationFee: String(doctor.consultationFee),
            shareType: doctor.appointmentShareType ?? 'percent',
            shareValue: String(doctor.appointmentShareValue ?? 0),
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

        const share = Number(form.shareValue);
        if (form.shareValue === '' || Number.isNaN(share) || share < 0) {
            toast.error('Enter the appointment share, or 0 for none');
            return;
        }
        if (form.shareType === 'percent' && share > 100) {
            toast.error('A percent share cannot exceed 100');
            return;
        }

        const profile = {
            appointmentShareType: form.shareType,
            appointmentShareValue: share,
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
                        the Users page, and edit their clinical details and appointment share here. Each doctor is also on the
                        Referrers list, where their lab discount and commission are set.
                    </p>
                </div>
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
                                background: 'var(--warning-bg)',
                                borderRadius: 'var(--radius-md)',
                                padding: 20,
                            }}
                        >
                            <Select
                                label="Doctor's share of each appointment"
                                value={form.shareType}
                                options={[
                                    { label: 'Percent of the fee', value: 'percent' },
                                    { label: 'Fixed taka per appointment', value: 'fixed' },
                                ]}
                                onChange={(e) => setForm({ ...form, shareType: e.target.value as Form['shareType'] })}
                            />
                            <TextField
                                label={form.shareType === 'fixed' ? 'Share (৳)' : 'Share (%)'}
                                type="number"
                                min={0}
                                max={form.shareType === 'percent' ? 100 : undefined}
                                step="0.01"
                                value={form.shareValue}
                                onChange={(e) => setForm({ ...form, shareValue: e.target.value })}
                                hint={(() => {
                                    const fee = Number(form.consultationFee) || 0;
                                    const value = Number(form.shareValue) || 0;
                                    const earns = form.shareType === 'fixed' ? Math.min(value, fee) : (fee * Math.min(value, 100)) / 100;
                                    return `On a ${money(fee)} fee the doctor earns ${money(earns)}. Paid out on Doctor's Commission once the patient has paid. New bookings only.`;
                                })()}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                                Discount and referral commission for lab tests this doctor refers are set on the Referrers page.
                            </p>
                            {editing && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    icon="rotate-ccw"
                                    loading={isApplying}
                                    onClick={() => askApplyShare(editing)}
                                >
                                    Apply saved share to unpaid past appointments
                                </Button>
                            )}
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
                            ...(isAdmin
                                ? [
                                      {
                                          key: 'share',
                                          header: 'Doctor share',
                                          align: 'right' as const,
                                          render: (doctor: Doctor) => (
                                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shareLabel(doctor)}</span>
                                          ),
                                      },
                                  ]
                                : []),
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
