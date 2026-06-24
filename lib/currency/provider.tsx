"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type CurrencyCode = "EUR" | "USD" | "GBP" | "XOF" | "XAF" | "CAD" | "CHF";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "EUR",
  setCurrency: () => {},
  formatAmount: (n) => `${n.toFixed(2)} €`,
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

const LOCALE_MAP: Record<CurrencyCode, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
  XOF: "fr-FR",
  XAF: "fr-FR",
  CAD: "fr-CA",
  CHF: "fr-CH",
};

export default function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("EUR");

  useEffect(() => {
    const saved = localStorage.getItem("monbudget-currency");
    if (saved && Object.keys(LOCALE_MAP).includes(saved)) {
      setCurrencyState(saved as CurrencyCode);
    }
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("monbudget-currency", c);
  }, []);

  const formatAmount = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat(LOCALE_MAP[currency], {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    },
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}
