import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon';

type PanelProps = {
    title?: ReactNode;
    subtitle?: ReactNode;
    action?: ReactNode;
    menu?: boolean;
    padding?: string;
    children?: ReactNode;
    style?: CSSProperties;
};

/** White surface every chart, table and list sits on. */
const Panel = ({ title, subtitle, action, menu = false, padding = 'var(--pad-panel)', children, style }: PanelProps) => (
    <section
        style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            padding,
            ...style,
        }}
    >
        {(title || action || menu) && (
            <header
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                }}
            >
                <div>
                    {title && <h2 style={{ font: 'var(--type-section-title)', color: 'var(--text-heading)' }}>{title}</h2>}
                    {subtitle && <p style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {action}
                    {menu && (
                        <span style={{ color: 'var(--text-faint)', cursor: 'pointer' }}>
                            <Icon name="more-horizontal" size={18} />
                        </span>
                    )}
                </div>
            </header>
        )}
        {children}
    </section>
);

export default Panel;
