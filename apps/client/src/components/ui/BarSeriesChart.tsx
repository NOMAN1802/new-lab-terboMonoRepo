import type { CSSProperties } from 'react';

export type BarPoint = { label: string; value: number };

type BarSeriesChartProps = {
    data?: BarPoint[];
    highlight?: number | null;
    height?: number;
    valueFormat?: (value: number) => string;
    style?: CSSProperties;
};

/** Categorical bars — busiest day, revenue by department. One bar is highlighted indigo. */
const BarSeriesChart = ({ data = [], highlight = null, height = 200, valueFormat = (v) => v.toLocaleString(), style }: BarSeriesChartProps) => {
    if (!data.length) return null;
    const max = Math.max(1, ...data.map((d) => d.value));
    const hi = highlight ?? data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', height, ...style }}>
            {data.map((d, i) => {
                const active = i === hi;
                return (
                    <div
                        key={d.label}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            height: '100%',
                            justifyContent: 'flex-end',
                        }}
                    >
                        {active && (
                            <span
                                style={{
                                    fontSize: 'var(--text-13)',
                                    fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                    color: 'var(--text-heading)',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {valueFormat(d.value)}
                            </span>
                        )}
                        <div
                            style={{
                                width: '100%',
                                maxWidth: '34px',
                                height: `${(d.value / max) * 100}%`,
                                background: active ? 'var(--chart-1)' : 'var(--chart-track)',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'height var(--dur-slow) var(--ease-standard)',
                            }}
                        />
                        <span
                            style={{
                                fontSize: 'var(--text-12)',
                                fontWeight: (active ? 'var(--fw-semibold)' : 'var(--fw-medium)') as CSSProperties['fontWeight'],
                                color: active ? 'var(--chart-1)' : 'var(--text-faint)',
                            }}
                        >
                            {d.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default BarSeriesChart;
