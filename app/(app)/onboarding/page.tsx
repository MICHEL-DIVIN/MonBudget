"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/_components/ui/Icon";
import Button from "@/app/_components/ui/Button";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import { useOfflineData } from "@/lib/offline/hooks";
import { useUserId } from "@/lib/auth/provider";
import { useCurrency, type CurrencyCode } from "@/lib/currency/provider";
import type { Profile, Revenu, Envelope } from "@/lib/supabase/types";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dollar ($)" },
  { value: "GBP", label: "Livre Sterling (£)" },
  { value: "XOF", label: "Franc CFA (XOF)" },
  { value: "XAF", label: "Franc CFA (XAF)" },
  { value: "CAD", label: "Dollar Canadien (CA$)" },
  { value: "CHF", label: "Franc Suisse (CHF)" },
];

const DEFAULT_ENVELOPES = [
  { name: "Cadeau", icon: "redeem", color: "bg-env-pink", budgeted: 0 },
  { name: "Courses", icon: "shopping_cart", color: "bg-env-green", budgeted: 0 },
  { name: "Loisirs", icon: "sports_esports", color: "bg-env-blue", budgeted: 0 },
  { name: "Shopping", icon: "shopping_bag", color: "bg-env-yellow", budgeted: 0 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const userId = useUserId();
  const [step, setStep] = useState(0);

  // Step 1: Welcome (no data)
  // Step 2: Profile setup
  const [fullName, setFullName] = useState("");
  const [currency, setCurrencyLocal] = useState("EUR");

  // Step 3: First salary
  const [salaryLabel, setSalaryLabel] = useState("Salaire");
  const [salaryAmount, setSalaryAmount] = useState("");

  // Step 4: Envelope budgets
  const [envBudgets, setEnvBudgets] = useState<number[]>(DEFAULT_ENVELOPES.map(() => 0));

  const { setCurrency: setGlobalCurrency } = useCurrency();
  const { addItem: addProfile } = useOfflineData<Profile>("profiles");
  const { addItem: addRevenu } = useOfflineData<Revenu>("revenus");
  const { addItem: addEnvelope } = useOfflineData<Envelope>("envelopes");

  async function handleFinish() {
    // Save profile
    await addProfile({
      full_name: fullName || "Utilisateur",
      avatar_url: null,
      currency: currency,
      locale: "fr-FR",
    } as any);

    setGlobalCurrency(currency as CurrencyCode);

    // Save salary if provided
    if (salaryAmount && parseFloat(salaryAmount) > 0) {
      await addRevenu({
        user_id: userId,
        label: salaryLabel,
        amount: parseFloat(salaryAmount),
        category: "principal" as const,
        type: "salaire",
        date: new Date().toISOString().slice(0, 10),
        recurring: true,
        synced_at: null,
      });
    }

    // Save envelopes
    for (let i = 0; i < DEFAULT_ENVELOPES.length; i++) {
      if (envBudgets[i] > 0) {
        await addEnvelope({
          user_id: userId,
          name: DEFAULT_ENVELOPES[i].name,
          budgeted: envBudgets[i],
          color: DEFAULT_ENVELOPES[i].color,
          icon: DEFAULT_ENVELOPES[i].icon,
          sort_order: i,
        });
      }
    }

    localStorage.setItem("monbudget-onboarded", "true");
    router.push("/dashboard");
  }

  // Check if already onboarded
  // This must be inside the render to work with ClientOnly/SSR
  // We'll check localStorage in an effect and redirect

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="text-center space-y-6 animate-slide-up">
      <div className="glass-card rounded-[24px] p-8 animate-float mx-auto max-w-xs">
        <div className="w-32 h-32 mx-auto bg-primary/15 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 64 }}>savings</span>
        </div>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-on-surface">
        Bienvenue sur Mon Budget Familial
      </h1>
      <p className="text-on-surface-variant max-w-md mx-auto">
        Prenez le contrôle de vos finances en quelques étapes simples. Configurons votre budget ensemble.
      </p>
      <Button variant="primary" size="lg" onClick={() => setStep(1)}>
        Commencer la configuration
      </Button>
      <button onClick={() => { localStorage.setItem("monbudget-onboarded", "true"); router.push("/dashboard"); }} className="block mx-auto text-sm text-on-surface-variant hover:text-primary transition-colors">
        Passer et configurer plus tard
      </button>
    </div>,

    // Step 1: Profile
    <div key="profile" className="space-y-6 max-w-md mx-auto w-full animate-slide-up">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-primary/15 rounded-full flex items-center justify-center mb-4">
          <Icon name="person" size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Votre profil</h2>
        <p className="text-sm text-on-surface-variant mt-1">Comment devons-nous vous appeler ?</p>
      </div>
      <Input label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Jean Dupont" />
      <Select label="Devise" value={currency} onChange={(e) => setCurrencyLocal(e.target.value)} options={CURRENCY_OPTIONS} />
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Retour</Button>
        <Button variant="primary" onClick={() => setStep(2)} className="flex-1">Suivant</Button>
      </div>
    </div>,

    // Step 2: Salary
    <div key="salary" className="space-y-6 max-w-md mx-auto w-full animate-slide-up">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-green-500/15 rounded-full flex items-center justify-center mb-4">
          <Icon name="account_balance_wallet" size={32} className="text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Votre revenu principal</h2>
        <p className="text-sm text-on-surface-variant mt-1">Ajoutez votre salaire ou revenu mensuel</p>
      </div>
      <Input label="Libellé" value={salaryLabel} onChange={(e) => setSalaryLabel(e.target.value)} placeholder="Salaire" />
      <Input label="Montant mensuel" type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder="0,00" />
      <p className="text-xs text-on-surface-variant flex items-center gap-1">
        <Icon name="info" size={14} /> Ce revenu sera automatiquement ajouté chaque mois
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Retour</Button>
        <Button variant="primary" onClick={() => setStep(3)} className="flex-1">Suivant</Button>
      </div>
    </div>,

    // Step 3: Envelopes
    <div key="envelopes" className="space-y-6 max-w-md mx-auto w-full animate-slide-up">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-secondary/15 rounded-full flex items-center justify-center mb-4">
          <Icon name="account_balance" size={32} className="text-secondary" />
        </div>
        <h2 className="text-xl font-bold text-on-surface">Vos enveloppes budget</h2>
        <p className="text-sm text-on-surface-variant mt-1">Combien allouez-vous à chaque poste par mois ?</p>
      </div>
      <div className="space-y-3">
        {DEFAULT_ENVELOPES.map((env, i) => (
          <div key={env.name} className={`flex items-center gap-3 p-3 rounded-xl ${env.color}/30`}>
            <div className={`w-10 h-10 rounded-full ${env.color} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-lg">{env.icon}</span>
            </div>
            <span className="flex-1 text-sm font-medium text-on-surface">{env.name}</span>
            <input
              type="number"
              value={envBudgets[i] || ""}
              onChange={(e) => {
                const newBudgets = [...envBudgets];
                newBudgets[i] = parseFloat(e.target.value) || 0;
                setEnvBudgets(newBudgets);
              }}
              placeholder="0"
              className="w-24 px-3 py-2 text-right bg-surface-container-high border border-outline-variant rounded-xl text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Retour</Button>
        <Button variant="primary" onClick={handleFinish} className="flex-1">Terminer</Button>
      </div>
    </div>,
  ];

  // Progress indicator
  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      {/* Progress dots */}
      {step > 0 && (
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i < step ? 'bg-primary w-8' : i === step ? 'bg-primary w-8' : 'bg-outline-variant w-4'}`} />
          ))}
        </div>
      )}

      {steps[step]}

      {/* Features - only on welcome */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl w-full">
          {[
            { icon: "bolt", title: "Rapide", desc: "Saisissez une dépense en moins de 5 secondes." },
            { icon: "group", title: "Collaboratif", desc: "Partagez votre budget avec toute la famille." },
            { icon: "lock", title: "Sécurisé", desc: "Vos données financières sont chiffrées et protégées." },
          ].map(f => (
            <div key={f.title} className="bg-surface-container rounded-[20px] p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-primary">{f.icon}</span>
              </div>
              <h3 className="font-semibold text-on-surface mb-1">{f.title}</h3>
              <p className="text-sm text-on-surface-variant">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
