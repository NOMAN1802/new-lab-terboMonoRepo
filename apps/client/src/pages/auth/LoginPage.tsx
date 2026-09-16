import { useState } from 'react';
import { useT } from '@/i18n/useLanguage';
import { useLocation, useNavigate } from 'react-router-dom';
import { CENTRE } from '@/lib/centre';
import { apiErrorMessage } from '@/lib/format';
import { useLoginMutation } from '@/services/authApi';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import BrandLogo from '@/components/brand/BrandLogo';

const HIGHLIGHTS: [IconName, string][] = [
    ['banknote', 'Cash billing with partial payments'],
    ['user-round-search', 'Referrer discount and commission tracking'],
    ['file-text', 'Report handling, Dhaka-day accurate'],
];

const LoginPage = () => {
    const t = useT();
    const [formState, setFormState] = useState({ email: '', password: '' });
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [login, { isLoading }] = useLoginMutation();

    const redirectPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        try {
            await login(formState).unwrap();
            navigate(redirectPath, { replace: true });
        } catch (err) {
            setError(apiErrorMessage(err, 'Unable to sign in. Check your credentials.'));
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page)' }}>
            {/* Brand panel */}
            <div
                className="only-desktop"
                style={{
                    width: '42%',
                    minWidth: 380,
                    background: 'var(--brand)',
                    color: '#fff',
                    padding: 56,
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        width: 520,
                        height: 520,
                        borderRadius: '50%',
                        background: 'var(--indigo-400)',
                        opacity: 0.35,
                        right: -180,
                        top: -160,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        width: 340,
                        height: 340,
                        borderRadius: '50%',
                        background: 'var(--indigo-700)',
                        opacity: 0.45,
                        left: -120,
                        bottom: -140,
                    }}
                />

                {/*
                  The logo keeps its own blue and green, so it sits on a white
                  plate: set straight onto the dark panel, the blue would all
                  but disappear.
                */}
                <div
                    style={{
                        position: 'relative',
                        alignSelf: 'flex-start',
                        background: '#fff',
                        borderRadius: 'var(--radius-lg)',
                        padding: '14px 18px',
                        boxShadow: '0 10px 30px -12px rgba(0,0,0,.45)',
                    }}
                >
                    <BrandLogo size="md" />
                </div>

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>
                        Billing &amp; Management System
                    </h1>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,.78)', maxWidth: 380 }}>
                        Patient registration, test billing, cash collection, referral commission and diagnostic reports — in one place.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        {HIGHLIGHTS.map(([icon, text]) => (
                            <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        background: 'rgba(255,255,255,.16)',
                                    }}
                                >
                                    <Icon name={icon} size={15} />
                                </span>
                                {text}
                            </span>
                        ))}
                    </div>
                </div>

                <p style={{ position: 'relative', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                    © {new Date().getFullYear()} {CENTRE.name}. All rights reserved.
                </p>
            </div>

            {/* Sign-in form */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* The brand panel is desktop-only, so phones get the logo here. */}
                    <div className="only-mobile" style={{ justifyContent: 'center', marginBottom: 4 }}>
                        <BrandLogo size="md" />
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 6 }}>
                        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-heading)' }}>Sign in</h2>
                        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>Use the account provided by your administrator.</p>
                    </div>

                    <TextField
                        label={t('col.email')}
                        icon="mail"
                        type="email"
                        id="email"
                        autoComplete="username"
                        required
                        size="lg"
                        placeholder="you@example.com"
                        value={formState.email}
                        onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                    />

                    <TextField
                        label={t('fld.password')}
                        icon="lock"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        required
                        size="lg"
                        placeholder="••••••••"
                        value={formState.password}
                        onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                    />

                    {error && <InlineAlert tone="error">{error}</InlineAlert>}

                    <Button type="submit" size="lg" block loading={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </Button>

                    <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
                        {t('jsx.accessNote')}
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
