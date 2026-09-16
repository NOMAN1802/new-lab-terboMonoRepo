import { useState } from 'react';
import { useT } from '@/i18n/useLanguage';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';

type TextareaProps = {
    label?: ReactNode;
    value?: string;
    onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    hint?: ReactNode;
    error?: ReactNode;
    optional?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    style?: CSSProperties;
};

/** Notes and address fields. Same chrome as TextField. */
const Textarea = ({ label, value, onChange, placeholder, rows = 3, hint, error, optional = false, id, style, ...rest }: TextareaProps) => {
    const t = useT();
    const [focus, setFocus] = useState(false);
    const areaId = id || (typeof label === 'string' ? `t-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...style }}>
            {label && (
                <label htmlFor={areaId} style={{ font: 'var(--type-label)', color: 'var(--text-body)', marginBottom: '2px' }}>
                    {label}
                    {optional && <span style={{ color: 'var(--text-faint)', fontWeight: 'var(--fw-regular)' as CSSProperties['fontWeight'] }}> {t('ctrl.optionalSuffix')}</span>}
                </label>
            )}
            <textarea
                {...rest}
                id={areaId}
                rows={rows}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px var(--space-3)',
                    resize: 'vertical',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-14)',
                    lineHeight: 'var(--lh-normal)',
                    color: 'var(--text-heading)',
                    background: 'var(--surface-card)',
                    border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--brand)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    boxShadow: focus ? 'var(--ring-brand)' : 'var(--shadow-xs)',
                    transition: 'var(--transition-control)',
                }}
            />
            {(error || hint) && (
                <p style={{ fontSize: 'var(--text-12)', color: error ? 'var(--danger-strong)' : 'var(--text-muted)' }}>{error || hint}</p>
            )}
        </div>
    );
};

export default Textarea;
