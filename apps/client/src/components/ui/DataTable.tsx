import { useT } from '@/i18n/useLanguage';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type Column<T> = {
    key: string;
    header: ReactNode;
    align?: 'left' | 'right' | 'center';
    mono?: boolean;
    render?: (row: T) => ReactNode;
};

type DataTableProps<T> = {
    columns: Column<T>[];
    rows: T[];
    empty?: ReactNode;
    dense?: boolean;
    minWidth?: string;
    onRowClick?: (row: T) => void;
    style?: CSSProperties;
};

/** Invoice / referrer / patient listing. Thin rules, no zebra, hover row tint. */
const DataTable = <T extends Record<string, unknown>>({
    columns,
    rows,
    empty,
    dense = false,
    minWidth = '46rem',
    onRowClick,
    style,
}: DataTableProps<T>) => {
    const t = useT();
    const [hover, setHover] = useState(-1);
    const pad = dense ? '10px var(--space-4)' : '14px var(--space-5)';

    if (!rows.length) {
        return (
            <p
                style={{
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    fontSize: 'var(--text-12)',
                    color: 'var(--text-muted)',
                }}
            >
                {empty ?? t('common.nothingToShow')}
            </p>
        );
    }

    return (
        <div style={{ width: '100%', overflowX: 'auto', ...style }}>
            <table style={{ width: '100%', minWidth, textAlign: 'left', fontSize: 'var(--text-12)' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                style={{
                                    padding: pad,
                                    font: 'var(--type-tablehead)',
                                    letterSpacing: 'var(--tracking-caps)',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-faint)',
                                    textAlign: c.align || 'left',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={(row.id as string) ?? i}
                            onMouseEnter={() => setHover(i)}
                            onMouseLeave={() => setHover(-1)}
                            onClick={() => onRowClick?.(row)}
                            style={{
                                borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--surface-muted)',
                                background: hover === i ? 'var(--surface-sunken)' : 'transparent',
                                cursor: onRowClick ? 'pointer' : 'default',
                                transition: 'background-color var(--dur-fast) var(--ease-standard)',
                            }}
                        >
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    style={{
                                        padding: pad,
                                        textAlign: c.align || 'left',
                                        color: 'var(--text-body)',
                                        fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : 'normal',
                                        fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
                                        whiteSpace: c.mono ? 'nowrap' : 'normal',
                                    }}
                                >
                                    {c.render ? c.render(row) : (row[c.key] as ReactNode)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
