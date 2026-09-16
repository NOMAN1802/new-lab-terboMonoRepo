import type { CSSProperties, ReactNode } from 'react';
import { useT } from '@/i18n/useLanguage';
import Icon from './Icon';
import type { IconName } from './Icon';

const TONES: Record<string, [string, string, string, IconName]> = {
    success: ['var(--teal-50)', 'var(--teal-200)', 'var(--success-strong)', 'check'],
    error: ['#FFF5F5', 'var(--rose-100)', 'var(--danger-strong)', 'circle-alert'],
    warning: ['var(--warning-bg)', '#F6DFBA', 'var(--warning-strong)', 'triangle-alert'],
    info: ['var(--brand-tint)', 'var(--indigo-200)', 'var(--brand-dark)', 'info'],
};

type InlineAlertProps = {
    tone?: 'success' | 'error' | 'warning' | 'info';
    children?: ReactNode;
    icon?: IconName;
    onDismiss?: () => void;
    style?: CSSProperties;
};

/** Result of the action the user just took, shown above the form it belongs to. */
const InlineAlert = ({ tone = 'info', children, icon, onDismiss, style }: InlineAlertProps) => {
    const t = useT();
    const [bg, border, fg, fallbackIcon] = TONES[tone] || TONES.info;
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px var(--space-4)',
                color: fg,
                ...style,
            }}
        >
            <Icon name={icon || fallbackIcon} size={17} style={{ marginTop: '1px' }} />
            <p
                style={{
                    flex: 1,
                    fontSize: 'var(--text-13)',
                    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                    lineHeight: 'var(--lh-normal)',
                }}
            >
                {children}
            </p>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={t('fld.dismiss')}
                    style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'inherit', opacity: 0.6, display: 'flex' }}
                >
                    <Icon name="x" size={16} />
                </button>
            )}
        </div>
    );
};

export default InlineAlert;
