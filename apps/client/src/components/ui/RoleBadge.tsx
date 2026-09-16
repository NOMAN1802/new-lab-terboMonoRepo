import type { CSSProperties } from 'react';

const ROLES: Record<string, [string, string, string]> = {
    admin: ['var(--success-bg)', 'var(--success-strong)', 'var(--teal-200)'],
    receptionist: ['var(--info-bg)', 'var(--brand-dark)', 'var(--indigo-200)'],
};

/** Permission level. Uppercase and bordered so it reads apart from StatusBadge. */
const RoleBadge = ({ role = '', style }: { role?: string; style?: CSSProperties }) => {
    const [bg, fg, border] = ROLES[String(role).toLowerCase()] || ['var(--warning-bg)', 'var(--warning-strong)', '#F6DFBA'];
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: 'var(--radius-xs)',
                background: bg,
                color: fg,
                border: `1px solid ${border}`,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-11)',
                fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-caps)',
                ...style,
            }}
        >
            {role}
        </span>
    );
};

export default RoleBadge;
