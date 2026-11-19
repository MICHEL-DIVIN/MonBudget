import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { getMeta, setMeta } from './db';

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'XOF', 'XAF', 'CAD', 'CHF'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const LOCALE: Record<CurrencyCode, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  XOF: 'fr-FR',
  XAF: 'fr-FR',
  CAD: 'fr-CA',
  CHF: 'fr-CH',
};

const SYMBOL: Record<CurrencyCode, string> = { EUR: '€', USD: '$', GBP: '£', XOF: 'CFA', XAF: 'CFA', CAD: 'CA$', CHF: 'CHF' };

interface CurrencyValue {
  currency: CurrencyCode;
  symbol: string;
  setCurrency: (c: CurrencyCode, opts?: { remote?: boolean }) => void;
  formatAmount: (n: number) => string;
}

const CurrencyContext = createContext<CurrencyValue>({
  currency: 'EUR',
  symbol: '€',
  setCurrency: () => {},
  formatAmount: (n) => `${n.toFixed(2)} €`,
});

const isCurrency = (v: unknown): v is CurrencyCode => CURRENCIES.includes(v as CurrencyCode);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setState] = useState<CurrencyCode>(() => {
    const saved = getMeta('pref.currency');
    return isCurrency(saved) ? saved : 'EUR';
  });

  const setCurrency = useCallback((c: CurrencyCode, opts?: { remote?: boolean }) => {
    setState(c);
    setMeta('pref.currency', c);
    // Meilleur effort : le profil serveur suit, mais la devise locale ne dépend pas du réseau.
    if (opts?.remote !== false) api.patch('/me', { currency: c }).catch(() => {});
  }, []);

  const value = useMemo<CurrencyValue>(() => {
    // XOF/XAF n'ont pas de décimales usuelles.
    const digits = currency === 'XOF' || currency === 'XAF' ? 0 : 2;
    let fmt: Intl.NumberFormat;
    try {
      fmt = new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch {
      fmt = { format: (n: number) => `${n.toFixed(digits)} ${SYMBOL[currency]}` } as Intl.NumberFormat;
    }
    return { currency, symbol: SYMBOL[currency], setCurrency, formatAmount: (n) => fmt.format(n) };
  }, [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);
