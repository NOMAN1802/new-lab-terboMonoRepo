import type { ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

/** One read-only fact on an account screen: glyph, caps label, value. */
const DetailRow = ({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
        }}
    >
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-light)',
                color: 'var(--brand-dark)',
                flex: '0 0 auto',
            }}
        >
            <Icon name={icon} size={18} />
        </span>
        <div style={{ minWidth: 0 }}>
            <p
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                }}
            >
                {label}
            </p>
            <p
                style={{
                    marginTop: 3,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-heading)',
                    wordBreak: 'break-word',
                    textTransform: label === 'Account role' ? 'capitalize' : 'none',
                }}
            >
                {value}
            </p>
        </div>
    </div>
);

export default DetailRow;
