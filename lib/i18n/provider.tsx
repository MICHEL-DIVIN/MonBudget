"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Locale } from "./translations";

type Dict = (typeof translations)[Locale];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "fr",
  setLocale: () => {},
  t: translations.fr,
});

export function useI18n() {
  return useContext(I18nContext);
}

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const saved = localStorage.getItem("monbudget-locale") as Locale | null;
    if (saved === "fr" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("monbudget-locale", l);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}
