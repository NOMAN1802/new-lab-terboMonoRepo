import { useState } from 'react';
import { useT } from '@/i18n/useLanguage';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

type TextFieldProps = {
    label?: ReactNode;
    value?: string | number;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    icon?: IconName;
    hint?: ReactNode;
    error?: ReactNode;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    autoComplete?: string;
    /** A phone keypad for digit-only fields, and a hard cap on length. */
    inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'search' | 'url';
    maxLength?: number;
    size?: 'sm' | 'md' | 'lg';
    trailing?: ReactNode;
    optional?: boolean;
    style?: CSSProperties;
};

const TextField = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    icon,
    hint,
    error,
    disabled = false,
    id,
    size = 'md',
    trailing,
    optional = false,
    style,
    ...rest
}: TextFieldProps) => {
    const t = useT();
    const [focus, setFocus] = useState(false);
    const [reveal, setReveal] = useState(false);
    const isPassword = type === 'password';
    const inputId = id || (typeof label === 'string' ? `f-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const h = size === 'sm' ? 'var(--control-h-sm)' : size === 'lg' ? '48px' : 'var(--control-h)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...style }}>
            {label && (
                <label htmlFor={inputId} style={{ font: 'var(--type-label)', color: 'var(--text-body)', marginBottom: '2px' }}>
                    {label}
                    {optional && <span style={{ color: 'var(--text-faint)', fontWeight: 'var(--fw-regular)' as CSSProperties['fontWeight'] }}> {t('ctrl.optionalSuffix')}</span>}
                </label>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {icon && (
                    <span
                        style={{
                            position: 'absolute',
                            left: 'var(--space-3)',
                            color: focus ? 'var(--brand)' : 'var(--text-faint)',
                            pointerEvents: 'none',
                            transition: 'var(--transition-control)',
                        }}
                    >
                        <Icon name={icon} size={18} />
                    </span>
                )}
                <input
                    {...rest}
                    id={inputId}
                    type={isPassword && reveal ? 'text' : type}
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={onChange}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    style={{
                        width: '100%',
                        height: h,
                        boxSizing: 'border-box',
                        fontFamily: 'var(--font-sans)',
                        paddingLeft: icon ? '42px' : 'var(--space-3)',
                        paddingRight: isPassword || trailing ? '46px' : 'var(--space-3)',
                        fontSize: 'var(--text-14)',
                        color: 'var(--text-heading)',
                        background: disabled ? 'var(--surface-muted)' : 'var(--surface-card)',
                        border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--brand)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        outline: 'none',
                        boxShadow: focus ? (error ? 'var(--ring-danger)' : 'var(--ring-brand)') : 'var(--shadow-xs)',
                        transition: 'var(--transition-control)',
                    }}
                />
                {isPassword ? (
                    <button
                        type="button"
                        onClick={() => setReveal((v) => !v)}
                        aria-label={reveal ? 'Hide password' : 'Show password'}
                        style={{
                            position: 'absolute',
                            right: 'var(--space-3)',
                            display: 'flex',
                            border: 0,
                            background: 'transparent',
                            color: 'var(--text-faint)',
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        <Icon name={reveal ? 'eye-off' : 'eye'} size={18} />
                    </button>
                ) : trailing ? (
                    <span
                        style={{
                            position: 'absolute',
                            right: 'var(--space-3)',
                            color: 'var(--text-faint)',
                            fontSize: 'var(--text-12)',
                            fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                        }}
                    >
                        {trailing}
                    </span>
                ) : null}
            </div>
            {(error || hint) && (
                <p style={{ fontSize: 'var(--text-12)', color: error ? 'var(--danger-strong)' : 'var(--text-muted)' }}>{error || hint}</p>
            )}
        </div>
    );
};

export default TextField;
