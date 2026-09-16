import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useT } from '@/i18n/useLanguage';
import { toast } from 'sonner';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import Button from '@/components/ui/Button';
import Panel from '@/components/ui/Panel';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import Textarea from '@/components/ui/Textarea';
import { apiErrorMessage } from '@/lib/format';
import { useCreatePatientMutation, useGetPatientQuery, useUpdatePatientMutation } from '@/services/patientsApi';
import type { Gender, PatientInput } from '@/services/patientsApi';

const EMPTY: PatientInput = {
    name: '',
    age: 0,
    gender: 'male',
    phone: '',
    address: '',
};

const GENDERS: Gender[] = ['male', 'female', 'other'];

const PatientFormPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const t = useT();
    const isEdit = Boolean(id);

    const { data: patient, isLoading, isError, refetch } = useGetPatientQuery(id!, {
        skip: !isEdit,
    });

    const [createPatient, { isLoading: isCreating }] = useCreatePatientMutation();
    const [updatePatient, { isLoading: isUpdating }] = useUpdatePatientMutation();

    const [form, setForm] = useState<PatientInput>(EMPTY);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loadedId, setLoadedId] = useState<string | null>(null);

    // Seed the form once the fetched patient arrives. Adjusting state during
    // render is React's documented alternative to syncing in an effect, and
    // avoids the extra render pass a useEffect would cause.
    if (patient && loadedId !== patient._id) {
        setLoadedId(patient._id);
        setForm({
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            address: patient.address ?? '',
        });
    }

    const validate = () => {
        const next: Record<string, string> = {};
        if (!form.name.trim()) next.name = 'Name is required';
        if (!form.phone.trim()) next.phone = 'Phone number is required';
        if (!Number.isInteger(form.age) || form.age < 0 || form.age > 130) {
            next.age = 'Enter an age between 0 and 130';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) return;

        const payload: PatientInput = {
            ...form,
            name: form.name.trim(),
            phone: form.phone.trim(),
            address: form.address?.trim() || undefined,
        };

        try {
            if (isEdit) {
                await updatePatient({ id: id!, data: payload }).unwrap();
                toast.success('Patient updated');
                navigate(`/patients/${id}`);
            } else {
                const created = await createPatient(payload).unwrap();
                toast.success(`Registered as ${created.patientId}`);
                navigate(`/billing/new?patient=${created._id}`);
            }
        } catch (error) {
            toast.error(apiErrorMessage(error, isEdit ? 'Could not update patient' : 'Could not register patient'));
        }
    };

    if (isEdit && isLoading) return <Loader message={t('ld.patient')} />;
    if (isEdit && isError) {
        return <ErrorState title={t('err.patient')} description={t('err.patientGone')} onRetry={refetch} />;
    }

    const isSaving = isCreating || isUpdating;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{isEdit ? t('pform.edit') : t('pform.register')}</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {isEdit
                        ? `Patient ID ${patient?.patientId} cannot be changed.`
                        : 'A patient ID is assigned automatically. You can book tests straight after saving.'}
                </p>
            </div>

            <Panel>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <TextField
                        label={t('pform.fullName')}
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Ayesha Rahman"
                        error={errors.name}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <TextField
                            label={t('pform.age')}
                            id="age"
                            type="number"
                            min={0}
                            max={130}
                            value={form.age || ''}
                            onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                            hint="0–130"
                            error={errors.age}
                        />
                        <Select
                            label={t('pform.sex')}
                            id="gender"
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                            options={GENDERS}
                        />
                    </div>

                    <TextField
                        label={t('pform.phone')}
                        id="phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="01XXXXXXXXX"
                        error={errors.phone}
                    />

                    <Textarea
                        label={t('pform.address')}
                        id="address"
                        optional
                        rows={3}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
                        <Button variant="secondary" onClick={() => navigate(-1)}>
                            {t('ctrl.cancel')}
                        </Button>
                        <Button type="submit" loading={isSaving}>
                            {isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Register patient'}
                        </Button>
                    </div>
                </form>
            </Panel>
        </div>
    );
};

export default PatientFormPage;
