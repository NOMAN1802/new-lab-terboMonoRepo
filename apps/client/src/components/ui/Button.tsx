import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'var(--transition-control)',
};

export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'accent' | 'ghost' | 'danger';

const sizes: Record<ButtonSize, CSSProperties> = {
    sm: { height: 'var(--control-h-sm)', padding: '0 var(--space-3)', fontSize: 'var(--text-12)' },
    md: { height: 'var(--control-h)', padding: '0 var(--space-4)', fontSize: 'var(--text-14)' },
    lg: { height: '48px', padding: '0 var(--space-6)', fontSize: 'var(--text-14)' },
};

const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: 'var(--brand)', color: 'var(--text-onbrand)', boxShadow: 'var(--shadow-brand)' },
    secondary: { background: 'var(--surface-card)', color: 'var(--text-body)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-xs)' },
    soft: { background: 'var(--brand-light)', color: 'var(--brand-dark)' },
    accent: { background: 'var(--accent)', color: 'var(--text-onbrand)' },
    ghost: { background: 'transparent', color: 'var(--text-muted)' },
    danger: { background: 'var(--danger)', color: 'var(--text-onbrand)' },
};

const hovers: Record<ButtonVariant, CSSProperties> = {
    primary: { background: 'var(--brand-hover)' },
    secondary: { background: 'var(--surface-sunken)' },
    soft: { background: 'var(--indigo-200)' },
    accent: { background: 'var(--accent-hover)' },
    ghost: { background: 'var(--surface-muted)', color: 'var(--text-body)' },
    danger: { background: 'var(--danger-strong)' },
};

type ButtonProps = {
    children?: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconAfter?: IconName;
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    title?: string;
    'aria-label'?: string;
    onClick?: () => void;
    style?: CSSProperties;
    className?: string;
};

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    iconAfter,
    block = false,
    disabled = false,
    loading = false,
    type = 'button',
    onClick,
    style,
    className,
    ...rest
}: ButtonProps) => {
    const [hover, setHover] = useState(false);
    const [down, setDown] = useState(false);
    const inactive = disabled || loading;

    return (
        <button
            {...rest}
            type={type}
            className={className}
            disabled={inactive}
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => {
                setHover(false);
                setDown(false);
            }}
            onMouseDown={() => setDown(true)}
            onMouseUp={() => setDown(false)}
            style={{
                ...base,
                ...sizes[size],
                ...variants[variant],
                ...(hover && !inactive ? hovers[variant] : null),
                transform: down && !inactive ? 'translateY(1px)' : 'none',
                width: block ? '100%' : undefined,
                opacity: inactive ? 0.55 : 1,
                cursor: inactive ? 'not-allowed' : 'pointer',
                ...style,
            }}
        >
            {loading ? (
                <Icon name="loader-circle" size={size === 'sm' ? 14 : 16} style={{ animation: 'nl-spin 800ms linear infinite' }} />
            ) : icon ? (
                <Icon name={icon} size={size === 'sm' ? 14 : 18} />
            ) : null}
            {children}
            {iconAfter && !loading ? <Icon name={iconAfter} size={size === 'sm' ? 14 : 18} /> : null}
        </button>
    );
};

export default Button;
