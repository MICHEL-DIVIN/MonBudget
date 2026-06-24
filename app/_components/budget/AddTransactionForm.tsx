"use client";

import { useState } from "react";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import Button from "@/app/_components/ui/Button";

interface TransactionData {
  label: string;
  amount: number;
  category: string;
  date: string;
  recurring: boolean;
  type?: string;
}

interface AddTransactionFormProps {
  type: "income" | "expense";
  onSubmit: (data: TransactionData) => void;
  onCancel: () => void;
  categories: { value: string; label: string }[];
  initialData?: Partial<TransactionData>;
  envelopeRemaining?: Record<string, number>;
}

const incomeTypes = [
  { value: "salaire", label: "Salaire" },
  { value: "freelance", label: "Freelance" },
  { value: "immobilier", label: "Immobilier" },
  { value: "allocation", label: "Allocation" },
  { value: "autre", label: "Autre" },
];

export default function AddTransactionForm({
  type,
  onSubmit,
  onCancel,
  categories,
  initialData,
  envelopeRemaining,
}: AddTransactionFormProps) {
  const [label, setLabel] = useState(initialData?.label ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(initialData?.recurring ?? false);
  const [incomeType, setIncomeType] = useState(initialData?.type ?? "autre");

  const isEditing = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!label || isNaN(parsedAmount) || parsedAmount <= 0 || !category || !date) return;
    onSubmit({
      label,
      amount: parsedAmount,
      category,
      date,
      recurring,
      type: type === "income" ? incomeType : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Libellé"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={type === "income" ? "Ex: Salaire" : "Ex: Loyer"}
      />

      <Input
        label="Montant"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        min="0.01"
        step="0.01"
      />

      <Select
        label="Catégorie"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={categories}
        placeholder="Sélectionner"
      />

      {type === "expense" && envelopeRemaining && category && envelopeRemaining[category] !== undefined && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
          envelopeRemaining[category] <= 0
            ? "bg-error/10 text-error"
            : parseFloat(amount) > envelopeRemaining[category]
            ? "bg-error/10 text-error"
            : "bg-success/10 text-success"
        }`}>
          <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
          <span>
            Reste disponible : <strong>{envelopeRemaining[category].toFixed(2)}</strong>
            {parseFloat(amount) > envelopeRemaining[category] && parseFloat(amount) > 0 && (
              <> — Dépassement de {(parseFloat(amount) - envelopeRemaining[category]).toFixed(2)}</>
            )}
          </span>
        </div>
      )}

      {type === "income" && (
        <Select
          label="Type de revenu"
          value={incomeType}
          onChange={(e) => setIncomeType(e.target.value)}
          options={incomeTypes}
        />
      )}

      <Input
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {/* Recurring toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-on-surface">Récurrent (mensuel)</p>
          <p className="text-xs text-on-surface-variant">Se répète chaque mois automatiquement</p>
        </div>
        <button
          type="button"
          onClick={() => setRecurring(!recurring)}
          className={`relative w-11 h-6 rounded-full transition-colors ${recurring ? "bg-primary" : "bg-outline-variant"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${recurring ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
        <Button type="submit" variant="primary" className="flex-1">
          {isEditing ? "Modifier" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
