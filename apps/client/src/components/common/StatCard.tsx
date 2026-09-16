import type { CSSProperties, ReactNode } from 'react';
import TrendPill from './TrendPill';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type StatAccent = 'brand' | 'accent' | 'warning' | 'danger' | 'neutral';

const accents: Record<StatAccent, [string, string]> = {
    brand: ['var(--brand-light)', 'var(--brand)'],
    accent: ['var(--accent-light)', 'var(--accent-dark)'],
    warning: ['var(--warning-bg)', 'var(--warning-strong)'],
    danger: ['var(--danger-bg)', 'var(--danger-strong)'],
    neutral: ['var(--surface-muted)', 'var(--text-muted)'],
};

/**
 * Legacy pages pass Tailwind utility strings for `accent`; map the ones in use
 * onto the design system's five roles so no call site has to change.
 */
const LEGACY: Record<string, StatAccent> = {
    'bg-emerald-100 text-emerald-600': 'accent',
    'bg-amber-100 text-amber-600': 'warning',
    'bg-rose-100 text-rose-600': 'danger',
    'bg-blue-100 text-blue-600': 'brand',
    'bg-brand/10 text-brand': 'brand',
};

type StatCardProps = {
    label: ReactNode;
    value: string | number;
    /** Either a design-system icon name or a ready-made node (legacy call sites). */
    icon?: IconName | ReactNode;
    trend?: {
        value: number;
        isPositive?: boolean;
        label?: string;
    };
    caption?: ReactNode;
    accent?: StatAccent | string;
    style?: CSSProperties;
};

/** One KPI: label, big number, delta, and the comparison line under it. */
const StatCard = ({ label, value, icon, trend, caption, accent = 'brand', style }: StatCardProps) => {
    const role: StatAccent = (accents[accent as StatAccent] ? (accent as StatAccent) : LEGACY[accent as string]) || 'brand';
    const [bg, fg] = accents[role];

    return (
        <div
            style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                padding: 'var(--pad-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                ...style,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <span
                    style={{
                        fontSize: 'var(--text-13)',
                        fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                        color: 'var(--text-muted)',
                    }}
                >
                    {label}
                </span>
                {icon && (
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            borderRadius: 'var(--radius-md)',
                            background: bg,
                            color: fg,
                        }}
                    >
                        {typeof icon === 'string' ? <Icon name={icon as IconName} size={18} /> : icon}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <p
                    style={{
                        font: 'var(--type-metric)',
                        color: 'var(--text-heading)',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: 'var(--tracking-tight)',
                    }}
                >
                    {value}
                </p>
                {trend && <TrendPill value={trend.value} isPositive={trend.isPositive} label={trend.label} />}
            </div>
            {caption && <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-faint)' }}>{caption}</p>}
        </div>
    );
};

export default StatCard;
