"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import FAB from "./FAB";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import AddTransactionForm from "@/app/_components/budget/AddTransactionForm";
import { useOfflineData } from "@/lib/offline/hooks";
import { useToast } from "@/app/_components/ui/Toast";
import { useUserId } from "@/lib/auth/provider";
import type { Depense, Revenu } from "@/lib/supabase/types";

const expenseCategories = [
  { value: "fixe", label: "Dépense fixe" },
  { value: "variable", label: "Dépense variable" },
];

const incomeCategories = [
  { value: "principal", label: "Revenu principal" },
  { value: "secondaire", label: "Revenu secondaire" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const userId = useUserId();
  const [showForm, setShowForm] = useState<"expense" | "income" | null>(null);
  const { addItem: addDepense } = useOfflineData<Depense>("depenses");
  const { addItem: addRevenu } = useOfflineData<Revenu>("revenus");
  const { toast } = useToast();

  async function handleAddExpense(data: { label: string; amount: number; category: string; date: string; recurring: boolean }) {
    await addDepense({
      user_id: userId,
      label: data.label,
      amount: data.amount,
      category: data.category as "fixe" | "variable",
      envelope_id: null,
      date: data.date,
      recurring: data.recurring,
      synced_at: null,
    });
    setShowForm(null);
    toast(`Dépense "${data.label}" ajoutée`);
  }

  async function handleAddIncome(data: { label: string; amount: number; category: string; date: string; recurring: boolean; type?: string }) {
    await addRevenu({
      user_id: userId,
      label: data.label,
      amount: data.amount,
      category: data.category as "principal" | "secondaire",
      type: data.type || "autre",
      date: data.date,
      recurring: data.recurring,
      synced_at: null,
    });
    setShowForm(null);
    toast(`Revenu "${data.label}" ajouté`);
  }

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 md:ml-[264px]">
        <TopBar />
        <main className="flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-28 md:px-8 md:pt-4 md:pb-6 scroll-smooth">
          {children}
        </main>
      </div>

      <BottomNav />
      <FAB
        onAddExpense={() => setShowForm("expense")}
        onAddIncome={() => setShowForm("income")}
      />

      <BottomSheet isOpen={showForm === "expense"} onClose={() => setShowForm(null)} title="Nouvelle dépense">
        <AddTransactionForm type="expense" onSubmit={handleAddExpense} onCancel={() => setShowForm(null)} categories={expenseCategories} />
      </BottomSheet>

      <BottomSheet isOpen={showForm === "income"} onClose={() => setShowForm(null)} title="Nouveau revenu">
        <AddTransactionForm type="income" onSubmit={handleAddIncome} onCancel={() => setShowForm(null)} categories={incomeCategories} />
      </BottomSheet>
    </div>
  );
}
