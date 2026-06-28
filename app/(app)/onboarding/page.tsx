"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency, type CurrencyCode } from "@/lib/currency/provider";
import { useI18n } from "@/lib/i18n/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { useUserId } from "@/lib/auth/provider";
import Button from "@/app/_components/ui/Button";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import Icon from "@/app/_components/ui/Icon";
import type { Envelope } from "@/lib/supabase/types";

const ONBOARDED_KEY = "monbudget-onboarded";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dollar ($)" },
  { value: "GBP", label: "Livre Sterling (£)" },
  { value: "XOF", label: "Franc CFA BCEAO (XOF)" },
  { value: "XAF", label: "Franc CFA BEAC (XAF)" },
  { value: "CAD", label: "Dollar Canadien (CA$)" },
  { value: "CHF", label: "Franc Suisse (CHF)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { t, setLocale } = useI18n();
  const userId = useUserId();
  const { addItem: addEnvelope } = useOfflineData<Envelope>("envelopes");

  const [step, setStep] = useState(0);
  const [envelopeName, setEnvelopeName] = useState("");
  const [envelopeBudget, setEnvelopeBudget] = useState("");

  function finish() {
    localStorage.setItem(`${ONBOARDED_KEY}-${userId}`, "true");
    localStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/dashboard");
  }

  async function handleCreateEnvelope() {
    const budget = parseFloat(envelopeBudget) || 0;
    if (envelopeName.trim() && budget > 0) {
      await addEnvelope({
        user_id: userId,
        name: envelopeName.trim(),
        budgeted: budget,
        color: "bg-env-green",
        icon: "shopping_cart",
        sort_order: 1,
      });
    }
    setStep(3);
  }

  const steps = [
    {
      icon: "account_balance",
      title: t.onboarding.welcome,
      desc: t.onboarding.welcomeDesc,
      content: (
        <div className="flex gap-2 justify-center mt-4">
          <button type="button" onClick={() => setLocale("fr")} className="px-4 py-2 rounded-xl bg-surface-container-high text-sm">Français</button>
          <button type="button" onClick={() => setLocale("en")} className="px-4 py-2 rounded-xl bg-surface-container-high text-sm">English</button>
        </div>
      ),
    },
    {
      icon: "payments",
      title: t.onboarding.currency,
      desc: t.onboarding.currencyDesc,
      content: (
        <Select
          label={t.settings.currency}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          options={CURRENCY_OPTIONS}
        />
      ),
    },
    {
      icon: "account_balance_wallet",
      title: t.onboarding.envelopes,
      desc: t.onboarding.envelopesDesc,
      content: (
        <div className="space-y-3">
          <Input label="Nom" value={envelopeName} onChange={(e) => setEnvelopeName(e.target.value)} placeholder="Ex: Courses" />
          <Input label="Budget mensuel" type="number" value={envelopeBudget} onChange={(e) => setEnvelopeBudget(e.target.value)} placeholder="500" />
        </div>
      ),
    },
    {
      icon: "celebration",
      title: t.onboarding.done,
      desc: t.onboarding.doneDesc,
      content: null,
    },
  ];

  const current = steps[step];

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-2 py-6">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8 justify-center">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-outline-variant"}`} />
          ))}
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Icon name={current.icon} size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">{current.title}</h1>
          <p className="text-sm text-on-surface-variant">{current.desc}</p>
        </div>

        {current.content && <div className="mb-8">{current.content}</div>}

        <div className="flex gap-3">
          {step < 3 && step > 0 && (
            <Button variant="outline" size="md" onClick={() => setStep(step + 1)} className="flex-1">
              {t.onboarding.skip}
            </Button>
          )}
          {step < 3 ? (
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => {
                if (step === 2) handleCreateEnvelope();
                else setStep(step + 1);
              }}
            >
              {t.onboarding.next}
            </Button>
          ) : (
            <Button variant="primary" size="md" className="w-full" onClick={finish}>
              {t.onboarding.finish}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
