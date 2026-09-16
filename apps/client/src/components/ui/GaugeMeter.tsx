import type { CSSProperties, ReactNode } from 'react';

type GaugeMeterProps = {
    value?: number;
    caption?: ReactNode;
    color?: string;
    ticks?: number;
    size?: number;
    style?: CSSProperties;
};

/** Ticked semicircle for a rate: collection rate, repeat-patient rate. */
const GaugeMeter = ({ value = 0, caption, color = 'var(--chart-1)', ticks = 44, size = 220, style }: GaugeMeterProps) => {
    const pct = Math.max(0, Math.min(100, value));
    const lit = Math.round((pct / 100) * ticks);
    const r = size / 2 - 8;
    const cx = size / 2;
    const cy = size / 2;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
            <div style={{ position: 'relative', width: size, height: size / 2 + 12 }}>
                <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
                    {Array.from({ length: ticks }, (_, i) => {
                        const a = (Math.PI * i) / (ticks - 1);
                        const on = i < lit;
                        const x1 = cx - Math.cos(a) * r;
                        const y1 = cy - Math.sin(a) * r;
                        const x2 = cx - Math.cos(a) * (r - 16);
                        const y2 = cy - Math.sin(a) * (r - 16);
                        return (
                            <line
                                key={i}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={on ? color : 'var(--chart-track)'}
                                strokeWidth="3"
                                strokeLinecap="round"
                                opacity={on ? 0.55 + 0.45 * (i / ticks) : 1}
                            />
                        );
                    })}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px' }}>
                    <span
                        style={{
                            fontSize: 'var(--text-36)',
                            fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                            color: 'var(--text-heading)',
                            letterSpacing: 'var(--tracking-tight)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {Math.round(pct)}%
                    </span>
                </div>
            </div>
            {caption && <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>{caption}</p>}
        </div>
    );
};

export default GaugeMeter;
