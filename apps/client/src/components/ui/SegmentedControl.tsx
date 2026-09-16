import type { CSSProperties } from 'react';

export type SegmentOption = string | { label: string; value: string };

type SegmentedControlProps = {
    options?: SegmentOption[];
    value?: string;
    onChange?: (value: string) => void;
    size?: 'sm' | 'md';
    style?: CSSProperties;
};

/** The slate-100 pill group with a white active chip — New Lab's range and status filters. */
const SegmentedControl = ({ options = [], value, onChange, size = 'md', style }: SegmentedControlProps) => {
    const items = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));

    return (
        <div
            style={{
                display: 'inline-flex',
                gap: '2px',
                padding: '3px',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                ...style,
            }}
        >
            {items.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange?.(o.value)}
                        style={{
                            border: 0,
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-sm)',
                            padding: size === 'sm' ? '4px 10px' : '6px 14px',
                            fontSize: 'var(--text-12)',
                            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                            fontFamily: 'var(--font-sans)',
                            background: active ? 'var(--surface-card)' : 'transparent',
                            color: active ? 'var(--brand)' : 'var(--text-muted)',
                            boxShadow: active ? 'var(--shadow-xs)' : 'none',
                            transition: 'var(--transition-control)',
                        }}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
};

export default SegmentedControl;
