import { createContext } from 'react';
import type { Language, TranslationKey } from './translations';

export type LanguageContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
    /** Looks up a key, falling back to English, then to the key itself. */
    t: (key: TranslationKey, fallback?: string) => string;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
