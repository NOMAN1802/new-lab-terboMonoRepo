import type { CSSProperties } from 'react';
import { useT } from '@/i18n/useLanguage';
import type { TranslationKey } from '@/i18n/translations';

/**
 * [background, text, border]
 *
 * With no hue to carry meaning, these separate on tonal value, and the scale
 * runs by how much the state wants attention rather than by whether it is
 * "good": a solid dark chip is something to act on, an outline is open but
 * calm, and a pale fill is finished business.
 */
const styles: Record<string, [string, string, string]> = {
    // Needs acting on — the loudest thing in the row.
    overdue: ['var(--slate-900)', 'var(--white)', 'var(--slate-900)'],
    cancelled: ['var(--slate-900)', 'var(--white)', 'var(--slate-900)'],

    // Open: outlined, so it reads as an empty box still to be filled.
    unpaid: ['var(--surface-card)', 'var(--slate-800)', 'var(--slate-400)'],
    pending: ['var(--surface-card)', 'var(--slate-800)', 'var(--slate-400)'],

    // Underway.
    partial: ['var(--slate-200)', 'var(--slate-700)', 'var(--slate-200)'],
    'partially paid': ['var(--slate-200)', 'var(--slate-700)', 'var(--slate-200)'],
    uploaded: ['var(--slate-200)', 'var(--slate-700)', 'var(--slate-200)'],

    // Done — deliberately quiet.
    paid: ['var(--slate-100)', 'var(--slate-600)', 'var(--slate-200)'],
    completed: ['var(--slate-100)', 'var(--slate-600)', 'var(--slate-200)'],
    delivered: ['var(--slate-100)', 'var(--slate-600)', 'var(--slate-200)'],
    active: ['var(--slate-100)', 'var(--slate-600)', 'var(--slate-200)'],

    draft: ['var(--slate-100)', 'var(--slate-600)', 'var(--slate-200)'],
    inactive: ['var(--surface-card)', 'var(--text-faint)', 'var(--slate-300)'],
};

/** Invoice, report and account state. Copy stays lowercase in data, Capitalised on screen. */
const StatusBadge = ({ status = '', style }: { status?: string; style?: CSSProperties }) => {
    const t = useT();
    const key = String(status).toLowerCase();
    const [bg, fg, border] = styles[key] || [
        'var(--slate-100)',
        'var(--slate-600)',
        'var(--slate-200)',
    ];

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                background: bg,
                color: fg,
                border: `1px solid ${border}`,
                fontSize: 'var(--text-12)',
                fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                fontFamily: 'var(--font-sans)',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {t(`status.${key}` as TranslationKey, status)}
        </span>
    );
};

export default StatusBadge;
