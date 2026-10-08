import type { CSSProperties } from 'react';
import type { Language } from '@/i18n/translations';
import { BRAND_NAME } from '@/lib/brand';

type LogoSize = 'sm' | 'md' | 'lg' | 'letterhead';

/** Rendered heights in px. The picture is 788 x 268, so width follows. */
const HEIGHTS: Record<LogoSize, number> = {
    sm: 46,
    md: 62,
    lg: 92,
    // Two copies of the invoice share one A4 sheet, so each letterhead gets
    // about half the height a single-copy one would.
    letterhead: 52,
};

type BrandLogoProps = {
    size?: LogoSize;
    /** Kept so callers can pin a language; the logo is the same in both. */
    lang?: Language;
    style?: CSSProperties;
};

/** The full ByteSpate logo: icon, wordmark and tagline. */
const BrandLogo = ({ size = 'sm', style }: BrandLogoProps) => (
    <img
        src="/bytespate-logo.png"
        alt={BRAND_NAME}
        height={HEIGHTS[size]}
        width={Math.round((HEIGHTS[size] * 788) / 268)}
        style={{ display: 'block', height: HEIGHTS[size], width: 'auto', maxWidth: '100%', flex: '0 0 auto', ...style }}
    />
);

export default BrandLogo;
