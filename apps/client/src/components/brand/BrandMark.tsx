import type { CSSProperties } from 'react';
import { BRAND_BLUE, BRAND_GREEN } from '@/lib/brand';

type BrandMarkProps = {
    /** Rendered height in px; the mark is taller than it is wide. */
    size?: number;
    style?: CSSProperties;
    /** Give it a name only where it stands alone; beside the wordmark it is decoration. */
    title?: string;
};

/**
 * The centre's mark: the rod of Asclepius with its serpent, held in two open
 * hands above a cross carrying a heartbeat, inside a blue-to-green oval.
 *
 * Drawn as vectors rather than shipped as a picture, so the same mark is sharp
 * as a 16px browser tab and on an A4 letterhead, and prints without waiting on
 * an image request inside the print capture. public/favicon.svg carries the
 * same geometry for the tab icon -- change one, change both.
 *
 * The serpent is woven: it passes in front of the rod at two crossings and
 * behind it at the other two, by redrawing short stretches of rod on top.
 */
const BrandMark = ({ size = 40, style, title }: BrandMarkProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 120"
        width={(size * 100) / 120}
        height={size}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        style={{ display: 'block', flex: '0 0 auto', ...style }}
    >
        {title && <title>{title}</title>}

        {/* Oval: blue sweeps up the left and over the top, green down the right. */}
        <path d="M24.8 104.2A44 54 0 0 1 72 13.2" fill="none" stroke={BRAND_BLUE} strokeWidth="5" strokeLinecap="round" />
        <path d="M81.1 21.8A44 54 0 0 1 42.4 113.2" fill="none" stroke={BRAND_GREEN} strokeWidth="5" strokeLinecap="round" />

        {/* Rod and its knob. */}
        <line x1="50" y1="20" x2="50" y2="88" stroke={BRAND_BLUE} strokeWidth="4.6" strokeLinecap="round" />
        <circle cx="50" cy="15" r="5.4" fill={BRAND_BLUE} />

        {/* Serpent, head at the top right. */}
        <path
            d="M57 28C66 31 63 39 50 41C37 43 36 51 50 53C64 55 64 63 50 65C37 67 37 75 50 77C57 78 58 81 55 84"
            fill="none"
            stroke={BRAND_GREEN}
            strokeWidth="4.2"
            strokeLinecap="round"
        />
        <ellipse cx="60" cy="25.5" rx="5.2" ry="3.4" transform="rotate(-25 60 25.5)" fill={BRAND_GREEN} />
        <circle cx="61.6" cy="24.5" r="0.9" fill="#fff" />
        <path d="M64.6 23.2l4.2-2.2M64.6 23.2l4.6.4" stroke={BRAND_GREEN} strokeWidth="0.9" strokeLinecap="round" />

        {/* Rod over serpent at the lower two crossings, for the weave. */}
        <line x1="50" y1="49" x2="50" y2="57" stroke={BRAND_BLUE} strokeWidth="4.6" />
        <line x1="50" y1="73" x2="50" y2="81" stroke={BRAND_BLUE} strokeWidth="4.6" />

        {/* Two open hands, mirrored: blue on the left, green on the right. */}
        <g fill={BRAND_BLUE}>
            <path d="M17 72C15 90 30 107 47 110L49 104.5C36 101 27 92 25 82C24.2 78 21 73 17 72Z" />
            <path d="M25 82C24 76 28.5 74.5 31 79.5L33.5 85C31 86 28 85.5 25 82Z" />
        </g>
        <g fill={BRAND_GREEN} transform="translate(100 0) scale(-1 1)">
            <path d="M17 72C15 90 30 107 47 110L49 104.5C36 101 27 92 25 82C24.2 78 21 73 17 72Z" />
            <path d="M25 82C24 76 28.5 74.5 31 79.5L33.5 85C31 86 28 85.5 25 82Z" />
        </g>

        {/* Cross with a heartbeat. */}
        <path
            d="M45.5 86h9v7h7v9h-7v7h-9v-7h-7v-9h7z"
            fill={BRAND_GREEN}
            stroke={BRAND_GREEN}
            strokeWidth="1.2"
            strokeLinejoin="round"
        />
        <path
            d="M39.5 97.5h6l1.6-4 2.6 8 2-6 1.4 2h7"
            fill="none"
            stroke="#fff"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default BrandMark;
