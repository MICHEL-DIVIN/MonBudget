import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getMeta, setMeta } from './db';
import { translations, type Locale } from './translations';

export type { Locale };

type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  /** Locale BCP-47 pour Intl (dates, montants). */
  intl: string;
}

function initialLocale(): Locale {
  const saved = getMeta('pref.locale');
  if (saved === 'fr' || saved === 'en') return saved;
  return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
}

const I18nContext = createContext<I18nValue>({ locale: 'fr', setLocale: () => {}, t: (k) => k, intl: 'fr-FR' });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setMeta('pref.locale', l);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = translations[locale] as Record<string, string>;
    const fallback = translations.fr as Record<string, string>;
    const t = (key: string, vars?: Vars) => {
      let s = dict[key] ?? fallback[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
    return { locale, setLocale, t, intl: locale === 'fr' ? 'fr-FR' : 'en-US' };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
