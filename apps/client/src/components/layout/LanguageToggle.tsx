import type { CSSProperties } from 'react';
import { useLanguage } from '@/i18n/useLanguage';
import type { Language } from '@/i18n/translations';

const OPTIONS: { value: Language; label: string }[] = [
    { value: 'en', label: 'EN' },
    { value: 'bn', label: 'বাং' },
];

/**
 * English / Bangla switch for the topbar. Two states, so a segmented pair beats
 * a dropdown: the alternative is always visible and one click away.
 */
const LanguageToggle = () => {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div
            role="group"
            aria-label={t('lang.switch')}
            style={{
                display: 'inline-flex',
                padding: '3px',
                gap: '2px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-pill)',
            }}
        >
            {OPTIONS.map((option) => {
                const active = language === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLanguage(option.value)}
                        style={{
                            padding: '4px 11px',
                            border: 0,
                            borderRadius: 'var(--radius-pill)',
                            background: active ? 'var(--surface-card)' : 'transparent',
                            color: active ? 'var(--text-heading)' : 'var(--text-muted)',
                            boxShadow: active ? 'var(--shadow-xs)' : 'none',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-11)',
                            fontWeight: (active ? 'var(--fw-bold)' : 'var(--fw-medium)') as CSSProperties['fontWeight'],
                            cursor: 'pointer',
                            transition: 'var(--transition-control)',
                        }}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};

export default LanguageToggle;
