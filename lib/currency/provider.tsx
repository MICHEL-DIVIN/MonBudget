"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";

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
  const { user } = useAuth();

  useEffect(() => {
    // Charger depuis localStorage d'abord
    const saved = localStorage.getItem("monbudget-currency");
    if (saved && Object.keys(LOCALE_MAP).includes(saved)) {
      setCurrencyState(saved as CurrencyCode);
    }
  }, []);

  // Charger la devise depuis le profil utilisateur quand connecté
  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    async function loadCurrencyFromProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("currency")
        .eq("id", userId)
        .single();

      if (data?.currency && Object.keys(LOCALE_MAP).includes(data.currency)) {
        setCurrencyState(data.currency as CurrencyCode);
        localStorage.setItem("monbudget-currency", data.currency);
      }
    }

    loadCurrencyFromProfile();
  }, [user]);

  const setCurrency = useCallback(async (c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("monbudget-currency", c);

    // Sauvegarder dans le profil utilisateur si connecté
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ currency: c })
          .eq("id", user.id);
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de la devise:", error);
      }
    }
  }, [user]);

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
