import type { CSSProperties } from 'react';

const SIZES: Record<string, [number, string]> = {
    sm: [28, 'var(--text-12)'],
    md: [38, 'var(--text-14)'],
    lg: [56, 'var(--text-20)'],
    xl: [88, 'var(--text-36)'],
};

type AvatarProps = {
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    solid?: boolean;
    style?: CSSProperties;
};

/** Initial on an indigo tint. The product has no photo uploads. */
const Avatar = ({ name = '', size = 'md', solid = false, style }: AvatarProps) => {
    const [px, font] = SIZES[size] || SIZES.md;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
                width: px,
                height: px,
                borderRadius: '50%',
                background: solid ? 'var(--brand)' : 'var(--brand-light)',
                color: solid ? 'var(--text-onbrand)' : 'var(--brand-dark)',
                fontFamily: 'var(--font-sans)',
                fontSize: font,
                fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                boxShadow: solid && (size === 'lg' || size === 'xl') ? 'var(--shadow-brand)' : 'none',
                ...style,
            }}
        >
            {(name.trim()[0] || 'U').toUpperCase()}
        </span>
    );
};

export default Avatar;
