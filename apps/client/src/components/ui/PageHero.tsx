import type { ReactNode } from 'react';

type PageHeroProps = {
    eyebrow: string;
    title: string;
    description?: string;
    action?: ReactNode;
};

/** The indigo banner the administration screens open with. */
const PageHero = ({ eyebrow, title, description, action }: PageHeroProps) => (
    <div
        style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--brand)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 36px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
        }}
    >
        <div
            style={{
                position: 'absolute',
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'var(--indigo-400)',
                opacity: 0.3,
                right: -110,
                top: -140,
            }}
        />
        <div style={{ position: 'relative' }}>
            <p
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--tracking-eyebrow)',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.8)',
                }}
            >
                {eyebrow}
            </p>
            <h2 style={{ marginTop: 8, fontSize: 30, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h2>
            {description && <p style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,.85)' }}>{description}</p>}
        </div>
        {action && <div style={{ position: 'relative' }}>{action}</div>}
    </div>
);

export default PageHero;
