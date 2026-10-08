import type { CSSProperties } from 'react';

type BrandMarkProps = {
    /** Rendered height in px. */
    size?: number;
    style?: CSSProperties;
    /** Give it a name only where it stands alone; beside the wordmark it is decoration. */
    title?: string;
};

// The icon is the left part of the logo picture: the framed brain with its
// binary digits. Cropping the same file keeps the two from drifting apart.
const CROP = { x: 0, y: 58, width: 170, height: 154 };

/**
 * ByteSpate's icon: a green square inside a red one, a brain with binary
 * digits, and the green bar that leads into the wordmark.
 */
const BrandMark = ({ size = 40, style, title }: BrandMarkProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${CROP.x} ${CROP.y} ${CROP.width} ${CROP.height}`}
        width={(size * CROP.width) / CROP.height}
        height={size}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        style={{ display: 'block', flex: '0 0 auto', ...style }}
    >
        {title && <title>{title}</title>}
        <image href="/bytespate-logo.png" width="788" height="268" />
    </svg>
);

export default BrandMark;
