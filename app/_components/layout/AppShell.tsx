"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import FAB from "./FAB";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import AddTransactionForm from "@/app/_components/budget/AddTransactionForm";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth } from "@/lib/utils/calculations";
import { useToast } from "@/app/_components/ui/Toast";
import { useUserId } from "@/lib/auth/provider";
import { TransactionFormProvider } from "@/lib/transaction-form/context";
import type { Depense, Revenu, Envelope } from "@/lib/supabase/types";

const incomeCategories = [
  { value: "principal", label: "Revenu principal" },
  { value: "secondaire", label: "Revenu secondaire" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  if (isOnboarding) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <main className="px-5 py-4">{children}</main>
      </div>
    );
  }

  const userId = useUserId();
  const [showForm, setShowForm] = useState<"expense" | "income" | null>(null);
  const { data: allDepenses, addItem: addDepense } = useOfflineData<Depense>("depenses");
  const { addItem: addRevenu } = useOfflineData<Revenu>("revenus");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { toast } = useToast();

  const now = new Date();
  const monthDepenses = useMemo(() => filterByMonth(allDepenses, now.getMonth(), now.getFullYear()) as Depense[], [allDepenses]);

  const envelopeRemaining = useMemo(() => {
    const map: Record<string, number> = {};
    for (const env of envelopes) {
      const spent = monthDepenses.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
      map[env.id] = env.budgeted - spent;
    }
    return map;
  }, [envelopes, monthDepenses]);

  const expenseCategories = useMemo(() => [
    { value: "fixe", label: "Dépense fixe" },
    { value: "variable", label: "Dépense variable" },
    ...envelopes.map((e) => ({ value: e.id, label: `${e.name}` })),
  ], [envelopes]);

  async function handleAddExpense(data: { label: string; amount: number; category: string; date: string; recurring: boolean }) {
    const isEnvelope = envelopes.some((e) => e.id === data.category);

    if (isEnvelope) {
      const env = envelopes.find((e) => e.id === data.category)!;
      const spent = monthDepenses.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
      const remaining = env.budgeted - spent;
      if (data.amount > remaining) {
        toast(`Montant trop élevé pour "${env.name}". Reste : ${remaining.toFixed(2)}`, "error");
        return;
      }
    }

    await addDepense({
      user_id: userId,
      label: data.label,
      amount: data.amount,
      category: isEnvelope ? "variable" : (data.category as "fixe" | "variable"),
      envelope_id: isEnvelope ? data.category : null,
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
    <TransactionFormProvider openForm={(type) => setShowForm(type)}>
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
          <AddTransactionForm type="expense" onSubmit={handleAddExpense} onCancel={() => setShowForm(null)} categories={expenseCategories} envelopeRemaining={envelopeRemaining} />
        </BottomSheet>

        <BottomSheet isOpen={showForm === "income"} onClose={() => setShowForm(null)} title="Nouveau revenu">
          <AddTransactionForm type="income" onSubmit={handleAddIncome} onCancel={() => setShowForm(null)} categories={incomeCategories} />
        </BottomSheet>
      </div>
    </TransactionFormProvider>
  );
}
