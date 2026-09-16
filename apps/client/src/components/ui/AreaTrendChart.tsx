import type { CSSProperties } from 'react';

export type TrendPoint = { label: string; value: number };

const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

type AreaTrendChartProps = {
    data?: TrendPoint[];
    compare?: TrendPoint[] | null;
    height?: number;
    color?: string;
    valueFormat?: (value: number) => string | number;
    ticks?: number;
    style?: CSSProperties;
};

/** Cash-collected trend: an ink line over a faint wash of itself, dashed comparison behind. */
const AreaTrendChart = ({
    data = [],
    compare = null,
    height = 240,
    color = 'var(--chart-1)',
    valueFormat = (v) => v,
    ticks = 4,
    style,
}: AreaTrendChartProps) => {
    const w = 640;
    const h = height;
    const padL = 56;
    const padR = 12;
    const padT = 14;
    const padB = 26;
    const values = data.map((d) => d.value).concat(compare ? compare.map((d) => d.value) : []);
    const max = Math.max(1, ...values) * 1.12;
    const x = (i: number, n: number) => padL + (i * (w - padL - padR)) / Math.max(1, n - 1);
    const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
    const pts = data.map((d, i) => [x(i, data.length), y(d.value)] as [number, number]);
    const cmp = compare ? compare.map((d, i) => [x(i, compare.length), y(d.value)] as [number, number]) : null;
    const gridVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i);
    const labelEvery = Math.max(1, Math.ceil(data.length / 6));

    return (
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible', ...style }}>
            <defs>
                {/* Ink is dark enough that an even wash reads as a grey block
                    rather than a fill. Most of the falloff happens early, so
                    the area settles back onto the card's paper well before the
                    axis instead of ending on a visible edge. */}
                <linearGradient id="nl-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.07" />
                    <stop offset="45%" stopColor={color} stopOpacity="0.025" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {gridVals.map((v, i) => (
                <g key={i}>
                    <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={padL - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-sans)">
                        {valueFormat(Math.round(v))}
                    </text>
                </g>
            ))}
            {cmp && <path d={path(cmp)} fill="none" stroke="var(--chart-3)" strokeWidth="1.5" strokeDasharray="5 5" />}
            {pts.length > 1 && (
                <path
                    d={`${path(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${h - padB} L ${pts[0][0].toFixed(1)} ${h - padB} Z`}
                    fill="url(#nl-area)"
                />
            )}
            <path d={path(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) =>
                i % labelEvery === 0 || i === data.length - 1 ? (
                    <text
                        key={i}
                        x={x(i, data.length)}
                        y={h - 6}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--chart-axis)"
                        fontFamily="var(--font-sans)"
                    >
                        {d.label}
                    </text>
                ) : null,
            )}
        </svg>
    );
};

export default AreaTrendChart;
