import type { CSSProperties } from 'react';
import Icon from '@/components/ui/Icon';

type TrendPillProps = {
    value: number;
    isPositive?: boolean;
    label?: string;
    style?: CSSProperties;
};

/** Percentage delta against the previous period. Green up, rose down. */
const TrendPill = ({ value, isPositive = true, label, style }: TrendPillProps) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            background: isPositive ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: isPositive ? 'var(--success-strong)' : 'var(--danger-strong)',
            fontSize: 'var(--text-12)',
            fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            fontVariantNumeric: 'tabular-nums',
            ...style,
        }}
    >
        <Icon name={isPositive ? 'trending-up' : 'trending-down'} size={13} strokeWidth={2.25} />
        {value}%
        {label && (
            <span
                style={{
                    marginLeft: '2px',
                    color: 'var(--text-muted)',
                    fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                    fontSize: 'var(--text-11)',
                }}
            >
                {label}
            </span>
        )}
    </span>
);

export default TrendPill;
