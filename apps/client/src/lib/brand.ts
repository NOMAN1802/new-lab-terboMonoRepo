import type { Language } from '@/i18n/translations';

/**
 * The centre's identity, in one place.
 *
 * The logo is the one element that keeps its colour in an otherwise
 * monochrome interface. Everything that draws it -- the favicon, the sidebar,
 * the sign-in page, the patient page and the printed letterhead -- reads these
 * values, so a change of shade happens once.
 */
export const BRAND_BLUE = '#1558B0';
export const BRAND_GREEN = '#2A9A3F';

type BrandName = { first: string; second: string; line2: string; line3: string };

export const BRAND_NAME: Record<Language, BrandName> = {
    en: {
        first: 'NEW',
        second: 'LAB',
        line2: 'DIAGNOSTIC',
        line3: 'AND CONSULTATION CENTER',
    },
    bn: {
        first: 'নিউ',
        second: 'ল্যাব',
        line2: 'ডায়াগনস্টিক',
        line3: 'অ্যান্ড কনসালটেশন সেন্টার',
    },
};

export const BRAND_VALUES: Record<Language, [string, string, string]> = {
    en: ['Accurate', 'Reliable', 'Care you can trust'],
    bn: ['নির্ভুল পরীক্ষা', 'নির্ভরযোগ্য সেবা', 'যত্নে আস্থা'],
};

/** Printed in Bangla on both letterheads, as on the centre's own signage. */
export const BRAND_TAGLINE_BN = 'আপনার সুস্বাস্থ্যই আমাদের অঙ্গীকার';
