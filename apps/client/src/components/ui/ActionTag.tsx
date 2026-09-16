import type { CSSProperties } from 'react';

/**
 * Audit-log action code. Colour is chosen by how much scrutiny the action
 * deserves, not by which entity it touched — the TONE map in ActivityPage.
 */
const TONE: Record<string, [string, string]> = {
    'payment.voided': ['var(--danger-bg)', 'var(--danger-strong)'],
    'invoice.cancelled': ['var(--danger-bg)', 'var(--danger-strong)'],
    'user.removed': ['var(--danger-bg)', 'var(--danger-strong)'],
    'test.price_changed': ['var(--warning-bg)', 'var(--warning-strong)'],
    'commission.paid_out': ['var(--warning-bg)', 'var(--warning-strong)'],
    'user.created': ['var(--warning-bg)', 'var(--warning-strong)'],
    'payment.recorded': ['var(--success-bg)', 'var(--success-strong)'],
    'invoice.created': ['var(--info-bg)', 'var(--brand-dark)'],
};

const ActionTag = ({ action = '', style }: { action?: string; style?: CSSProperties }) => {
    const [bg, fg] = TONE[action] || ['var(--surface-muted)', 'var(--text-muted)'];
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                background: bg,
                color: fg,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-11)',
                fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {action}
        </span>
    );
};

export default ActionTag;
