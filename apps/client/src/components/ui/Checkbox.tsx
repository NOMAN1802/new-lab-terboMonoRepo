import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import Icon from './Icon';

type CheckboxProps = {
    checked?: boolean;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    label?: ReactNode;
    description?: ReactNode;
    card?: boolean;
    accent?: 'accent' | 'brand';
    disabled?: boolean;
    style?: CSSProperties;
};

/**
 * Checkbox, plain or as a bordered card. The card variant is the booking
 * screen's "Collect full payment now", which turns teal when ticked.
 */
const Checkbox = ({ checked = false, onChange, label, description, card = false, accent = 'accent', disabled, style }: CheckboxProps) => {
    const on = checked;
    const tint =
        accent === 'accent'
            ? { border: 'var(--teal-200)', bg: 'var(--teal-50)' }
            : { border: 'var(--indigo-200)', bg: 'var(--brand-tint)' };

    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                ...(card
                    ? {
                          padding: '12px var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${on ? tint.border : 'var(--border-subtle)'}`,
                          background: on ? tint.bg : 'var(--surface-card)',
                          transition: 'var(--transition-control)',
                      }
                    : null),
                ...style,
            }}
        >
            <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={onChange}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    flex: '0 0 auto',
                    marginTop: card ? '1px' : 0,
                    borderRadius: 'var(--radius-xs)',
                    border: `1px solid ${on ? (accent === 'accent' ? 'var(--accent)' : 'var(--brand)') : 'var(--border-strong)'}`,
                    background: on ? (accent === 'accent' ? 'var(--accent)' : 'var(--brand)') : 'var(--surface-card)',
                    color: '#fff',
                    transition: 'var(--transition-control)',
                }}
            >
                {on && <Icon name="check" size={13} strokeWidth={3} />}
            </span>
            <span>
                {label && (
                    <span
                        style={{
                            display: 'block',
                            fontSize: 'var(--text-13)',
                            fontWeight: (card ? 'var(--fw-semibold)' : 'var(--fw-medium)') as CSSProperties['fontWeight'],
                            color: card ? 'var(--text-heading)' : 'var(--text-body)',
                        }}
                    >
                        {label}
                    </span>
                )}
                {description && (
                    <span
                        style={{
                            display: 'block',
                            marginTop: '3px',
                            fontSize: 'var(--text-12)',
                            color: 'var(--text-muted)',
                            lineHeight: 'var(--lh-normal)',
                        }}
                    >
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
};

export default Checkbox;
