import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import PageHero from '@/components/ui/PageHero';
import Panel from '@/components/ui/Panel';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { useT } from '@/i18n/useLanguage';
import { apiErrorMessage, money } from '@/lib/format';
import { useCreateUserMutation } from '@/services/userApi';
import type { CreateUserInput } from '@/services/userApi';

const EMPTY_FORM: CreateUserInput = {
    name: '',
    email: '',
    mobileNumber: '',
    password: '',
    role: 'receptionist',
};

type Role = CreateUserInput['role'];

/** One tab per kind of login. The tab decides the role; there is no role field. */
const ROLE_TABS: { label: string; value: Role; blurb: string }[] = [
    { label: 'Receptionist', value: 'receptionist', blurb: 'Books patients and appointments, takes payments and delivers reports.' },
    { label: 'Doctor', value: 'doctor', blurb: 'Approves schedules, sees their own appointments and writes prescriptions.' },
    { label: 'Admin', value: 'admin', blurb: 'Full access, including users, rates, refunds and reports.' },
];

const isRole = (value: string | null): value is Role => ROLE_TABS.some((tab) => tab.value === value);

/** Label with a small brand-tinted glyph, as the design system's forms use. */
const legend = (icon: IconName, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={15} color="var(--brand)" />
        {text}
    </span>
);

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%),1fr))', gap: 18 } as const;

/**
 * Creates a login. Choosing the Doctor role also asks for the clinical profile
 * and the doctor's share of appointment fees; the server then adds the doctor
 * and their Referrers entry along with the login.
 */
const AddUserPage = () => {
    const t = useT();
    const navigate = useNavigate();
    // ?role=doctor (or admin, receptionist) opens on that tab, and the tab is kept in the URL.
    const [searchParams, setSearchParams] = useSearchParams();
    const requested = searchParams.get('role');
    const startRole: Role = isRole(requested) ? requested : 'receptionist';

    const [form, setForm] = useState<CreateUserInput>({ ...EMPTY_FORM, role: startRole });
    const [error, setError] = useState<string | null>(null);
    const [createUser, { isLoading }] = useCreateUserMutation();

    const setField = (key: keyof CreateUserInput) => (event: { target: { value: string } }) => {
        setForm((current) => ({ ...current, [key]: event.target.value }));
        setError(null);
    };
    const setNumber = (key: 'consultationFee' | 'appointmentShareValue') => (event: { target: { value: string } }) => {
        const raw = event.target.value;
        setForm((current) => ({ ...current, [key]: raw === '' ? undefined : Number(raw) }));
        setError(null);
    };

    const isDoctor = form.role === 'doctor';
    const activeTab = ROLE_TABS.find((tab) => tab.value === form.role) ?? ROLE_TABS[0];

    // Switching tab keeps what was typed for the account, so nothing is lost.
    const switchRole = (role: Role) => {
        setForm((current) => ({ ...current, role }));
        setSearchParams({ role }, { replace: true });
        setError(null);
    };
    const fee = form.consultationFee ?? 0;
    const shareValue = form.appointmentShareValue ?? 0;
    const earns = form.appointmentShareType === 'fixed' ? Math.min(shareValue, fee) : (fee * Math.min(shareValue, 100)) / 100;

    const validate = (): string | null => {
        if (!form.name.trim()) return 'Name is required.';
        if (!form.mobileNumber.trim()) return 'Mobile number is required.';
        if (!form.email.trim()) return 'Email is required.';
        if (form.password.trim().length < 6) return 'Password must be at least 6 characters.';
        if (isDoctor) {
            if (!form.specialty?.trim()) return 'Specialty is required for a doctor.';
            if (form.consultationFee === undefined || form.consultationFee < 0) return 'Enter the doctor consultation fee in taka.';
            if (shareValue < 0) return 'The appointment share cannot be negative.';
            if (form.appointmentShareType !== 'fixed' && shareValue > 100) return 'A percent share cannot exceed 100.';
        }
        return null;
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }

        // Doctor details only travel with a doctor.
        const { specialty, degrees, consultationFee, appointmentShareType, appointmentShareValue, ...account } = form;
        try {
            await createUser({
                ...account,
                name: account.name.trim(),
                email: account.email.trim(),
                mobileNumber: account.mobileNumber.trim(),
                ...(isDoctor
                    ? {
                          specialty: specialty?.trim(),
                          degrees: degrees?.trim() || undefined,
                          consultationFee,
                          appointmentShareType: appointmentShareType ?? 'percent',
                          appointmentShareValue: appointmentShareValue ?? 0,
                      }
                    : {}),
            }).unwrap();
            toast.success(
                isDoctor
                    ? `${form.name.trim()} added as a doctor. They can sign in, and are on the Referrers list too.`
                    : `${form.name.trim()} added as ${activeTab.label.toLowerCase()}`
            );
            navigate('/users');
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to create user. Please try again.'));
        }
    };

    return (
        <>
            <PageHero eyebrow="Administration" title={t('ttl.addUser')} description={t('ttl.createAccount')} />

            <div role="tablist" aria-label="Kind of user" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-card)', overflowX: 'auto' }}>
                {ROLE_TABS.map((tab) => {
                    const selected = tab.value === form.role;
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => switchRole(tab.value)}
                            style={{
                                padding: '12px 22px',
                                marginBottom: -1,
                                border: 0,
                                borderBottom: `3px solid ${selected ? 'var(--brand)' : 'transparent'}`,
                                background: 'transparent',
                                color: selected ? 'var(--text-heading)' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 14,
                                fontWeight: selected ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'var(--transition-control)',
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {error && (
                    <InlineAlert tone="error" onDismiss={() => setError(null)}>
                        {error}
                    </InlineAlert>
                )}

                <Panel title={`New ${activeTab.label.toLowerCase()}`} subtitle={activeTab.blurb}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={grid}>
                            <TextField label={legend('user-round', 'Full name')} value={form.name} onChange={setField('name')} placeholder={t('ph.fullName')} />
                            <TextField
                                label={legend('phone', 'Mobile number')}
                                type="tel"
                                value={form.mobileNumber}
                                onChange={setField('mobileNumber')}
                                placeholder="01XXXXXXXXX"
                            />
                        </div>
                        <div style={grid}>
                            <TextField
                                label={legend('mail', 'Email address')}
                                type="email"
                                value={form.email}
                                onChange={setField('email')}
                                placeholder="you@example.com"
                            />
                            <TextField
                                label={legend('key-round', 'Password')}
                                type="password"
                                autoComplete="new-password"
                                value={form.password}
                                onChange={setField('password')}
                                placeholder={t('ph.min6')}
                                hint={t('hint.userPassword')}
                            />
                        </div>
                    </div>
                </Panel>

                {isDoctor && (
                    <Panel title="Doctor profile" subtitle="Shown to the desk when booking, and printed on prescriptions.">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div style={grid}>
                                <TextField label="Specialty" value={form.specialty ?? ''} onChange={setField('specialty')} placeholder="Medicine, Cardiology..." />
                                <TextField label="Degrees" optional value={form.degrees ?? ''} onChange={setField('degrees')} placeholder="MBBS; FCPS (Medicine)" hint="Separate lines with ; to print them one per line." />
                                <TextField
                                    label="Consultation fee (৳)"
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={form.consultationFee ?? ''}
                                    onChange={setNumber('consultationFee')}
                                    hint="Default for new schedules. Each schedule keeps the fee it was created with."
                                />
                            </div>
                            <div style={{ ...grid, background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', padding: 18 }}>
                                <Select
                                    label="Doctor's share of each appointment"
                                    value={form.appointmentShareType ?? 'percent'}
                                    options={[
                                        { label: 'Percent of the fee', value: 'percent' },
                                        { label: 'Fixed taka per appointment', value: 'fixed' },
                                    ]}
                                    onChange={(event) => {
                                        const value = event.target.value as 'percent' | 'fixed';
                                        setForm((current) => ({ ...current, appointmentShareType: value }));
                                    }}
                                />
                                <TextField
                                    label={form.appointmentShareType === 'fixed' ? 'Share (৳)' : 'Share (%)'}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.appointmentShareValue ?? ''}
                                    onChange={setNumber('appointmentShareValue')}
                                    hint={`On a ${money(fee)} fee the doctor earns ${money(earns)}, paid out once the patient has paid.`}
                                />
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                                The doctor is also added to the Referrers list. Set the discount and commission for lab tests they refer
                                there.
                            </p>
                        </div>
                    </Panel>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <Button type="button" variant="secondary" icon="x" disabled={isLoading} onClick={() => navigate('/users')}>
                        {t('ctrl.cancel')}
                    </Button>
                    <Button type="submit" icon="check" loading={isLoading}>
                        {isLoading ? 'Creating...' : `Create ${activeTab.label.toLowerCase()}`}
                    </Button>
                </div>
            </form>
        </>
    );
};

export default AddUserPage;
