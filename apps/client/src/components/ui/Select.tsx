import { useState } from 'react';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import Icon from './Icon';

export type SelectOption = string | { label: string; value: string | number };

type SelectProps = {
    label?: ReactNode;
    value?: string | number;
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
    options?: SelectOption[];
    placeholder?: string;
    hint?: ReactNode;
    error?: ReactNode;
    disabled?: boolean;
    id?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg';
    style?: CSSProperties;
};

/** Native select, styled to match TextField. Used for patient, referrer, department. */
const Select = ({
    label,
    value,
    onChange,
    options = [],
    placeholder,
    hint,
    error,
    disabled = false,
    id,
    size = 'md',
    style,
    ...rest
}: SelectProps) => {
    const [focus, setFocus] = useState(false);
    const items = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
    const selectId = id || (typeof label === 'string' ? `s-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const h = size === 'sm' ? 'var(--control-h-sm)' : size === 'lg' ? '48px' : 'var(--control-h)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...style }}>
            {label && (
                <label htmlFor={selectId} style={{ font: 'var(--type-label)', color: 'var(--text-body)', marginBottom: '2px' }}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                    {...rest}
                    id={selectId}
                    value={value}
                    disabled={disabled}
                    onChange={onChange}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    style={{
                        width: '100%',
                        height: h,
                        boxSizing: 'border-box',
                        appearance: 'none',
                        padding: '0 38px 0 var(--space-3)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-14)',
                        color: value === '' || value == null ? 'var(--text-faint)' : 'var(--text-heading)',
                        background: disabled ? 'var(--surface-muted)' : 'var(--surface-card)',
                        border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--brand)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        outline: 'none',
                        boxShadow: focus ? 'var(--ring-brand)' : 'var(--shadow-xs)',
                        transition: 'var(--transition-control)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                >
                    {placeholder && <option value="">{placeholder}</option>}
                    {items.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <span style={{ position: 'absolute', right: 'var(--space-3)', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                    <Icon name="chevron-down" size={16} />
                </span>
            </div>
            {(error || hint) && (
                <p style={{ fontSize: 'var(--text-12)', color: error ? 'var(--danger-strong)' : 'var(--text-muted)' }}>{error || hint}</p>
            )}
        </div>
    );
};

export default Select;
