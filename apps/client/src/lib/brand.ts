import type { Language } from '@/i18n/translations';

/**
 * The centre's identity, in one place.
 *
 * The logo is the one element that keeps its colour in an otherwise
 * monochrome interface. Everything that draws an accent from it -- the
 * printed rules and the prescription footer -- reads these values, so a
 * change of shade happens once. They are the red and green of the logo.
 */
export const BRAND_RED = '#FE0000';
export const BRAND_GREEN = '#009800';

export const BRAND_NAME = 'ByteSpate Diagnostic';

export const BRAND_VALUES: Record<Language, [string, string, string]> = {
    en: ['Accurate', 'Reliable', 'Care you can trust'],
    bn: ['নির্ভুল পরীক্ষা', 'নির্ভরযোগ্য সেবা', 'যত্নে আস্থা'],
};

/** Printed in Bangla on the invoice letterhead. */
export const BRAND_TAGLINE_BN = 'আপনার সুস্বাস্থ্যই আমাদের অঙ্গীকার';
