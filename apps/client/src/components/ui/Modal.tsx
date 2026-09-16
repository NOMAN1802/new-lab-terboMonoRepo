import { useEffect } from 'react';
import { useT } from '@/i18n/useLanguage';
import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon';

type ModalProps = {
    open?: boolean;
    onClose?: () => void;
    title?: ReactNode;
    subtitle?: ReactNode;
    width?: number;
    footer?: ReactNode;
    children?: ReactNode;
};

/** Centred dialog over a dimmed, blurred page. The app's only overlay. */
const Modal = ({ open = false, onClose, title, subtitle, width = 640, footer, children }: ModalProps) => {
    const t = useT();
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const headingStyle: CSSProperties = {
        fontSize: 'var(--text-20)',
        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
        color: 'var(--text-heading)',
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-4)',
                background: 'rgba(38,33,25,.48)',
                backdropFilter: 'blur(3px)',
            }}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: width,
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-pop)',
                    overflow: 'hidden',
                }}
            >
                {(title || onClose) && (
                    <header
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 'var(--space-4)',
                            padding: 'var(--pad-panel) var(--pad-panel) var(--space-4)',
                        }}
                    >
                        <div>
                            {title && <h2 style={headingStyle}>{title}</h2>}
                            {subtitle && <p style={{ marginTop: '4px', fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>{subtitle}</p>}
                        </div>
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label={t('ctrl.close')}
                                style={{
                                    display: 'flex',
                                    border: 0,
                                    background: 'transparent',
                                    padding: '4px',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-faint)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition-control)',
                                }}
                            >
                                <Icon name="x" size={20} />
                            </button>
                        )}
                    </header>
                )}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--pad-panel) var(--pad-panel)' }}>{children}</div>
                {footer && (
                    <footer
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 'var(--space-3)',
                            padding: 'var(--space-4) var(--pad-panel)',
                            borderTop: '1px solid var(--border-subtle)',
                        }}
                    >
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default Modal;
