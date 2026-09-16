import { useContext } from 'react';
import { LanguageContext } from './context';
import type { LanguageContextValue } from './context';

/** The current language, the setter, and the lookup. */
export const useLanguage = (): LanguageContextValue => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used inside a LanguageProvider');
    }
    return context;
};

/** Shorthand for the common case of only needing the lookup. */
export const useT = () => useLanguage().t;
