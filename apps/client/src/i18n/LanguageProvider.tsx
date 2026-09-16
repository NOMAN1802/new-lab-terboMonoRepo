import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LanguageContext } from './context';
import { translations } from './translations';
import type { Language, TranslationKey } from './translations';

const STORAGE_KEY = 'newlab.language';


const readStored = (): Language => {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return saved === 'bn' || saved === 'en' ? saved : 'en';
    } catch {
        // Private windows and blocked site data both throw on read.
        return 'en';
    }
};

/**
 * App-wide language, persisted per browser.
 *
 * Deliberately not in Redux: the choice is a device preference rather than
 * application state, it survives sign-out, and nothing on the server needs to
 * know about it.
 */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguageState] = useState<Language>(readStored);

    // `lang` drives font selection and the browser's own text handling; the
    // data attribute is what the stylesheet hooks the Bangla face onto.
    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dataset.lang = language;
    }, [language]);

    const setLanguage = useCallback((next: Language) => {
        setLanguageState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // A preference that cannot be saved still applies for this session.
        }
    }, []);

    const t = useCallback(
        (key: TranslationKey, fallback?: string) => {
            const entry = translations[key];
            if (!entry) return fallback ?? key;
            return entry[language] || entry.en || fallback || key;
        },
        [language],
    );

    const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
