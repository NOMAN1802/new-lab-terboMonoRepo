import { CENTRE_TIMEZONE, toDhakaDateInput } from '@repo/utils';

// Re-export so existing imports in this app continue to work.
export { toDhakaDateInput };

const BDT = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const money = (value?: number | null): string =>
    value === undefined || value === null ? '—' : `৳${BDT.format(value)}`;

export const percent = (value?: number | null): string =>
    value === undefined || value === null ? '—' : `${value}%`;

export const commissionBasis = (
    type?: 'percent' | 'fixed' | null,
    value?: number | null
): string => {
    if (value === undefined || value === null) return '—';
    return type === 'fixed' ? `flat ${money(value)}` : `${value}% of paid`;
};

export const formatDate = (value?: string | Date | null): string =>
    value
        ? new Date(value).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: CENTRE_TIMEZONE,
          })
        : '—';

export const formatDateTime = (value?: string | Date | null): string =>
    value
        ? new Date(value).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: CENTRE_TIMEZONE,
          })
        : '—';

export const apiErrorMessage = (
    error: unknown,
    fallback = 'Something went wrong'
): string => {
    const data = (error as { data?: { message?: string } })?.data;
    return data?.message || fallback;
};
