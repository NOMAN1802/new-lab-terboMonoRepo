import type { CSSProperties } from 'react';
import { useT } from '@/i18n/useLanguage';
import Button from './Button';

type PaginationProps = {
    page?: number;
    totalPages?: number;
    onChange?: (page: number) => void;
    busy?: boolean;
    style?: CSSProperties;
};

/**
 * "Page 2 of 7" plus Previous / Next. The app never numbers pages.
 *
 * Shown even on a single page, where both buttons sit disabled: the position
 * of a list is worth stating outright, and a control that appears only once a
 * table grows past a threshold looks like a bug until it does.
 */
const Pagination = ({ page = 1, totalPages = 1, onChange, busy = false, style }: PaginationProps) => {
    const t = useT();
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', ...style }}>
            <span style={{ fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>
                {t('common.page')} {page} {t('common.of')} {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" icon="chevron-left" disabled={page === 1 || busy} onClick={() => onChange?.(page - 1)}>
                    {t('common.previous')}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    iconAfter="chevron-right"
                    disabled={page === totalPages || busy}
                    onClick={() => onChange?.(page + 1)}
                >
                    {t('common.next')}
                </Button>
            </div>
        </div>
    );
};

export default Pagination;
