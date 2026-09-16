import type { CSSProperties } from 'react';
import { useLanguage } from '@/i18n/useLanguage';
import type { Language } from '@/i18n/translations';
import { BRAND_BLUE, BRAND_GREEN, BRAND_NAME } from '@/lib/brand';
import BrandMark from './BrandMark';

type LogoSize = 'sm' | 'md' | 'lg' | 'letterhead';

const SIZES: Record<LogoSize, { mark: number; title: number; line2: number; line3: number; gap: number }> = {
    sm: { mark: 40, title: 17, line2: 10.5, line3: 8.6, gap: 10 },
    md: { mark: 56, title: 24, line2: 14, line3: 11, gap: 12 },
    lg: { mark: 84, title: 38, line2: 21, line3: 16.5, gap: 18 },
    // Two copies of the invoice share one A4 sheet, so each letterhead gets
    // about half the height a single-copy one would.
    letterhead: { mark: 48, title: 21, line2: 12, line3: 9.6, gap: 11 },
};

type BrandLogoProps = {
    size?: LogoSize;
    /**
     * Fixes the language regardless of the toggle. The printed invoice is an
     * English document, so its letterhead pins 'en'; everywhere else the logo
     * follows the interface language, as the centre's own signage exists in
     * both.
     */
    lang?: Language;
    style?: CSSProperties;
};

/**
 * The mark with the centre's name set beside it, in the logo's own two
 * colours: NEW in blue, LAB in green, then DIAGNOSTIC and AND CONSULTATION
 * CENTER stacked beneath.
 *
 * The name is live text, not part of an image: it stays selectable, it reads
 * to a screen reader as the centre's name, and it switches script with the
 * language toggle. Bangla gets no letter-spacing -- tracking pulls conjuncts
 * apart and makes the script look broken.
 */
const BrandLogo = ({ size = 'sm', lang, style }: BrandLogoProps) => {
    const { language } = useLanguage();
    const current = lang ?? language;
    const name = BRAND_NAME[current];
    const s = SIZES[size];
    const latin = current === 'en';

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: s.gap, minWidth: 0, ...style }}
            aria-label={`${name.first} ${name.second} ${name.line2} ${name.line3}`}
            role="img"
        >
            <BrandMark size={s.mark} />
            <div style={{ minWidth: 0, fontFamily: 'var(--font-display)' }} aria-hidden="true">
                <div
                    style={{
                        fontSize: s.title,
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: latin ? '.01em' : 0,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span style={{ color: BRAND_BLUE }}>{name.first}</span>{' '}
                    <span style={{ color: BRAND_GREEN }}>{name.second}</span>
                </div>
                <div
                    style={{
                        marginTop: latin ? s.line2 * 0.28 : s.line2 * 0.12,
                        fontSize: s.line2,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: latin ? '.26em' : 0,
                        color: BRAND_BLUE,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {name.line2}
                </div>
                <div
                    style={{
                        fontSize: s.line3,
                        fontWeight: 600,
                        lineHeight: 1.25,
                        letterSpacing: latin ? '.07em' : 0,
                        color: BRAND_GREEN,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {name.line3}
                </div>
            </div>
        </div>
    );
};

export default BrandLogo;
