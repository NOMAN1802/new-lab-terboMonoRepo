import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import PageHero from '@/components/ui/PageHero';
import Panel from '@/components/ui/Panel';
import { useT } from '@/i18n/useLanguage';
import TextField from '@/components/ui/TextField';
import { CENTRE } from '@/lib/centre';
import { apiErrorMessage } from '@/lib/format';
import { useGetCurrentUserQuery, useUpdateCurrentUserMutation } from '@/services/userApi';
import type { UpdateUserInput } from '@/services/userApi';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { logout } from '@/features/auth/authSlice';

/** Label with a small brand-tinted glyph, as the design system's forms use. */
const legend = (icon: IconName, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={15} color="var(--brand)" />
        {text}
    </span>
);

const SettingsPage = () => {
    const t = useT();
    const { accessToken, initializing } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { data: user, isLoading, isError, refetch } = useGetCurrentUserQuery(undefined, {
        skip: !accessToken || initializing,
    });
    const [updateUser, { isLoading: isUpdating }] = useUpdateCurrentUserMutation();

    const [formData, setFormData] = useState({ name: '', email: '', mobileNumber: '', password: '' });
    const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const prevUserIdRef = useRef<string | undefined>(undefined);

    // Seed the form the first time this user's record arrives.
    useEffect(() => {
        if (!user || prevUserIdRef.current === user._id) return;

        prevUserIdRef.current = user._id;
        queueMicrotask(() => {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                mobileNumber: user.mobileNumber || '',
                password: '',
            });
        });
    }, [user]);

    if (isLoading) return <Loader fullScreen message={t('ld.settings')} />;

    if (isError || !user) {
        return <ErrorState title={t('err.settings')} description={t('err.network')} onRetry={refetch} />;
    }

    const dirty =
        formData.name !== user.name ||
        formData.email !== user.email ||
        formData.mobileNumber !== user.mobileNumber ||
        formData.password.trim() !== '';

    const handleChange = (field: keyof typeof formData) => (event: { target: { value: string } }) => {
        setFormData((current) => ({ ...current, [field]: event.target.value }));
        setResult(null);
    };

    const handleSave = async () => {
        setResult(null);

        const payload: UpdateUserInput = {};
        const passwordChanged = formData.password.trim() !== '';

        if (formData.name !== user.name) payload.name = formData.name;
        if (formData.email !== user.email) payload.email = formData.email;
        if (formData.mobileNumber !== user.mobileNumber) payload.mobileNumber = formData.mobileNumber;
        if (passwordChanged) payload.password = formData.password;

        if (Object.keys(payload).length === 0) {
            setResult({ tone: 'error', text: 'No changes to save.' });
            return;
        }

        try {
            await updateUser(payload).unwrap();

            // A password change invalidates the session everywhere, so sign out.
            if (passwordChanged) {
                setResult({
                    tone: 'success',
                    text: 'Password changed. You will be signed out shortly — sign in again with the new password.',
                });
                setTimeout(() => {
                    dispatch(logout());
                    navigate('/login', {
                        state: { message: 'Password changed successfully. Please login with your new password.' },
                    });
                }, 1500);
            } else {
                setResult({ tone: 'success', text: 'Profile updated.' });
                refetch();
                setFormData((current) => ({ ...current, password: '' }));
                setTimeout(() => setResult(null), 3000);
            }
        } catch (error) {
            setResult({ tone: 'error', text: apiErrorMessage(error, 'Failed to update profile. Please try again.') });
        }
    };

    const handleReset = () => {
        setFormData({
            name: user.name,
            email: user.email,
            mobileNumber: user.mobileNumber,
            password: '',
        });
        setResult(null);
    };

    const accountFacts: [string, string, IconName][] = [
        [t('set.role'), user.role, 'shield-check'],
        [t('set.centre'), CENTRE.name, 'building-2'],
        [t('set.timeZone'), 'Asia/Dhaka (GMT+6)', 'globe'],
        [t('set.memberSince'), user.createdAt ? dayjs(user.createdAt).format('D MMM YYYY') : '—', 'calendar'],
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
            <PageHero
                eyebrow="Configuration"
                title={t('set.title')}
                description={t('set.subtitle')}
            />

            <Panel title={t('set.personalInfo')} subtitle={t('ttl.signInDetails')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {result && (
                        <InlineAlert tone={result.tone} onDismiss={() => setResult(null)}>
                            {result.text}
                        </InlineAlert>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%),1fr))', gap: 20 }}>
                        <TextField label={legend('user-round', t('pform.fullName'))} value={formData.name} onChange={handleChange('name')} placeholder={t('ph.yourName')} />
                        <TextField
                            label={legend('phone', t('fld.mobileNumber'))}
                            type="tel"
                            value={formData.mobileNumber}
                            onChange={handleChange('mobileNumber')}
                            placeholder="01XXXXXXXXX"
                        />
                    </div>

                    <TextField
                        label={legend('mail', t('fld.emailAddress'))}
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        placeholder="you@example.com"
                    />

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                        <TextField
                            label={legend('key-round', t('set.newPassword'))}
                            type="password"
                            value={formData.password}
                            onChange={handleChange('password')}
                            placeholder={t('ph.keepPassword')}
                            hint={t('hint.password')}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 20, flexWrap: 'wrap' }}>
                        <Button icon="check" loading={isUpdating} onClick={handleSave}>
                            {isUpdating ? t('set.saving') : t('set.saveChanges')}
                        </Button>
                        <Button variant="secondary" icon="x" disabled={isUpdating || !dirty} onClick={handleReset}>
                            {t('jsx.reset')}
                        </Button>
                        {!dirty && !result && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{t('set.nothingChanged')}</span>}
                    </div>
                </div>
            </Panel>

            <Panel title={t('ttl.account')} subtitle={t('ttl.adminManaged')}>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%),1fr))', gap: 16 }}>
                    {accountFacts.map(([label, value, icon]) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                background: 'var(--surface-sunken)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px 16px',
                            }}
                        >
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 9,
                                    background: 'var(--brand-light)',
                                    color: 'var(--brand-dark)',
                                    flex: '0 0 auto',
                                }}
                            >
                                <Icon name={icon} size={16} />
                            </span>
                            <div>
                                <dt
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        letterSpacing: 'var(--tracking-caps)',
                                        textTransform: 'uppercase',
                                        color: 'var(--text-faint)',
                                    }}
                                >
                                    {label}
                                </dt>
                                <dd
                                    style={{
                                        margin: '2px 0 0',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: 'var(--text-heading)',
                                        textTransform: label === 'Role' ? 'capitalize' : 'none',
                                    }}
                                >
                                    {value}
                                </dd>
                            </div>
                        </div>
                    ))}
                </dl>
            </Panel>
        </div>
    );
};

export default SettingsPage;
