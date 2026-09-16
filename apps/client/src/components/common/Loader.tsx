import { useT } from '@/i18n/useLanguage';
import type { CSSProperties } from 'react';

type LoaderProps = {
    message?: string;
    fullScreen?: boolean;
    style?: CSSProperties;
};

/** Indigo ring spinner. fullScreen is the app-boot state. */
const Loader = ({ message, fullScreen = false, style }: LoaderProps) => {
    const t = useT();
    const text = message ?? t('common.loading');
    const ring = (size: string, border: string): CSSProperties => ({
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${border} solid var(--brand-light)`,
        borderTopColor: 'var(--brand)',
        animation: 'nl-spin 800ms linear infinite',
    });

    if (fullScreen) {
        return (
            <div
                style={{
                    minHeight: '60vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-page)',
                    ...style,
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span style={ring('48px', '4px')} />
                    <p
                        style={{
                            fontSize: 'var(--text-13)',
                            fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                            color: 'var(--text-muted)',
                        }}
                    >
                        {text}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--text-13)',
                fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                color: 'var(--text-muted)',
                ...style,
            }}
        >
            <span style={ring('18px', '2px')} />
            {text}
        </div>
    );
};

export default Loader;
