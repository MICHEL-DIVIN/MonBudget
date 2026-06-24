"use client";

import { useState, useMemo } from "react";
import MonthSelector from "@/app/_components/charts/MonthSelector";
import Icon from "@/app/_components/ui/Icon";
import DonutChart from "@/app/_components/charts/DonutChart";
import EnvelopeCard from "@/app/_components/budget/EnvelopeCard";
import EnvelopeManager from "@/app/_components/budget/EnvelopeManager";
import TransactionList from "@/app/_components/budget/TransactionList";
import TransactionSearch from "@/app/_components/budget/TransactionSearch";
import Modal from "@/app/_components/ui/Modal";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import AddTransactionForm from "@/app/_components/budget/AddTransactionForm";
import Skeleton from "@/app/_components/ui/Skeleton";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth, depensesByCategory, envelopeSpent } from "@/lib/utils/calculations";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/app/_components/ui/Toast";
import { useUserId } from "@/lib/auth/provider";
import type { Depense, Envelope } from "@/lib/supabase/types";

function getIconForLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("loyer") || lower.includes("logement")) return { icon: "home", bg: "bg-blue-500/15" };
  if (lower.includes("eau")) return { icon: "water_drop", bg: "bg-blue-500/15" };
  if (lower.includes("élect")) return { icon: "bolt", bg: "bg-orange-500/15" };
  if (lower.includes("gaz")) return { icon: "local_fire_department", bg: "bg-orange-500/15" };
  if (lower.includes("course")) return { icon: "shopping_cart", bg: "bg-green-500/15" };
  if (lower.includes("cadeau")) return { icon: "redeem", bg: "bg-pink-500/15" };
  if (lower.includes("loisir")) return { icon: "sports_esports", bg: "bg-purple-500/15" };
  if (lower.includes("shopping")) return { icon: "shopping_bag", bg: "bg-yellow-500/15" };
  return { icon: "payments", bg: "bg-surface-container-high" };
}

const INITIAL_MONTH = new Date().getMonth();
const INITIAL_YEAR = new Date().getFullYear();

export default function DepensesPage() {
  const userId = useUserId();
  const { toast } = useToast();
  const [month, setMonth] = useState(INITIAL_MONTH);
  const [year, setYear] = useState(INITIAL_YEAR);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEnvelopeManager, setShowEnvelopeManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allDepenses, loading: loadingDep, addItem, updateItem, deleteItem } = useOfflineData<Depense>("depenses");
  const { data: envelopes, loading: loadingEnv, addItem: addEnvelope, updateItem: updateEnvelope, deleteItem: deleteEnvelope } = useOfflineData<Envelope>("envelopes");

  const monthDepenses = useMemo(
    () => filterByMonth(allDepenses, month, year) as Depense[],
    [allDepenses, month, year]
  );

  const fixedExpenses = depensesByCategory(monthDepenses, "fixe");

  const totalEnvelopeBudget = envelopes.reduce((s, e) => s + e.budgeted, 0);
  const totalEnvelopeSpent = envelopes.reduce((s, e) => s + envelopeSpent(monthDepenses, e.id), 0);
  const remainingEnvelopes = totalEnvelopeBudget - totalEnvelopeSpent;

  const filteredFixedExpenses = useMemo(() => {
    if (!searchQuery) return fixedExpenses;
    const q = searchQuery.toLowerCase();
    return fixedExpenses.filter(d => d.label.toLowerCase().includes(q));
  }, [fixedExpenses, searchQuery]);

  const transactions = useMemo(
    () =>
      filteredFixedExpenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((d) => {
          const ic = getIconForLabel(d.label);
          return {
            id: d.id,
            label: d.label,
            amount: d.amount,
            date: formatDate(d.date),
            icon: ic.icon,
            iconBg: ic.bg,
          };
        }),
    [filteredFixedExpenses]
  );

  const expenseCategories = [
    { value: "fixe", label: "Dépense fixe" },
    { value: "variable", label: "Dépense variable" },
    ...envelopes.map((e) => ({ value: e.id, label: `Enveloppe: ${e.name}` })),
  ];

  const envelopeRemaining = useMemo(() => {
    const map: Record<string, number> = {};
    for (const env of envelopes) {
      const spent = monthDepenses
        .filter((d) => d.envelope_id === env.id && d.id !== editingId)
        .reduce((s, d) => s + Number(d.amount), 0);
      map[env.id] = env.budgeted - spent;
    }
    return map;
  }, [envelopes, monthDepenses, editingId]);

  const editingDepense = editingId ? monthDepenses.find(d => d.id === editingId) : null;

  function checkEnvelopeLimit(envelopeId: string, amount: number, excludeId?: string): { ok: boolean; remaining: number; envName: string } {
    const env = envelopes.find((e) => e.id === envelopeId);
    if (!env) return { ok: true, remaining: 0, envName: "" };
    const spent = monthDepenses
      .filter((d) => d.envelope_id === envelopeId && d.id !== excludeId)
      .reduce((s, d) => s + Number(d.amount), 0);
    const remaining = env.budgeted - spent;
    return { ok: amount <= remaining, remaining, envName: env.name };
  }

  async function handleSubmitDepense(data: { label: string; amount: number; category: string; date: string; recurring: boolean; type?: string }) {
    const isEnvelope = envelopes.some((e) => e.id === data.category);

    if (isEnvelope) {
      const check = checkEnvelopeLimit(data.category, data.amount, editingId ?? undefined);
      if (!check.ok) {
        toast(`Montant trop élevé pour "${check.envName}". Reste disponible : ${check.remaining.toFixed(2)}`, "error");
        return;
      }
    }

    if (editingId) {
      await updateItem(editingId, {
        label: data.label,
        amount: data.amount,
        category: isEnvelope ? "variable" : (data.category as "fixe" | "variable"),
        envelope_id: isEnvelope ? data.category : null,
        date: data.date,
        recurring: data.recurring,
      });
      setEditingId(null);
    } else {
      await addItem({
        user_id: userId,
        label: data.label,
        amount: data.amount,
        category: isEnvelope ? "variable" : (data.category as "fixe" | "variable"),
        envelope_id: isEnvelope ? data.category : null,
        date: data.date,
        recurring: data.recurring,
        synced_at: null,
      });
    }
    setShowAddForm(false);
    toast(editingId ? `"${data.label}" modifié` : `Dépense "${data.label}" ajoutée`);
  }

  async function handleDeleteDepense(id: string) {
    await deleteItem(id);
    toast("Dépense supprimée", "info");
  }

  function handleEditDepense(id: string) {
    const depense = monthDepenses.find(d => d.id === id);
    if (depense) {
      setEditingId(id);
      setShowAddForm(true);
    }
  }

  async function handleAddEnvelope(data: { name: string; budgeted: number; color: string; icon: string }) {
    await addEnvelope({
      user_id: userId,
      name: data.name,
      budgeted: data.budgeted,
      color: data.color,
      icon: data.icon,
      sort_order: envelopes.length,
    });
  }

  const loading = loadingDep || loadingEnv;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />

      <TransactionSearch onSearch={setSearchQuery} />

      <div className="bg-surface-container rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-on-surface">Dépenses variables</span>
          <span className="text-[10px] text-on-surface-variant" suppressHydrationWarning>Reste dans les enveloppes</span>
        </div>
        {loading ? (
          <Skeleton variant="circular" className="w-24 h-24 mx-auto" />
        ) : (
          <DonutChart value={remainingEnvelopes} total={totalEnvelopeBudget || 1} size={130} />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-on-surface-variant">Les enveloppes</h2>
          <button onClick={() => setShowEnvelopeManager(true)} className="text-xs text-primary font-medium flex items-center gap-1">
            <Icon name="tune" size={14} />
            Gérer
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rectangular" className="h-24 md:h-36 rounded-[16px]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {envelopes.map((env) => (
              <EnvelopeCard
                key={env.id}
                name={env.name}
                icon={env.icon}
                amount={env.budgeted}
                remaining={env.budgeted - envelopeSpent(monthDepenses, env.id)}
                color={env.color}
              />
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 md:space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" className="h-[64px] md:h-[72px] rounded-2xl" />)}
        </div>
      ) : transactions.length > 0 ? (
        <>
          <TransactionList
            title="Historique des dépenses fixes"
            transactions={transactions}
            onEdit={handleEditDepense}
            onDelete={handleDeleteDepense}
          />
          <button onClick={() => { setEditingId(null); setShowAddForm(true); }} className="w-full p-4 flex items-center justify-center gap-2 text-primary font-medium hover:bg-surface-container-high rounded-2xl transition-colors">
            <Icon name="add" size={20} />
            <span>Ajouter une dépense</span>
          </button>
        </>
      ) : (
        <div className="text-center py-8">
          <Icon name="receipt_long" size={48} className="text-outline mx-auto mb-2" />
          <p className="text-on-surface-variant">Aucune dépense fixe ce mois-ci</p>
          <button onClick={() => { setEditingId(null); setShowAddForm(true); }} className="mt-3 text-primary font-medium">
            Ajouter une dépense
          </button>
        </div>
      )}

      <div className="hidden md:block">
        <Modal isOpen={showAddForm} onClose={() => { setShowAddForm(false); setEditingId(null); }} title={editingId ? "Modifier une dépense" : "Ajouter une dépense"}>
          <AddTransactionForm type="expense" onSubmit={handleSubmitDepense} onCancel={() => { setShowAddForm(false); setEditingId(null); }} categories={expenseCategories} envelopeRemaining={envelopeRemaining} initialData={editingDepense ? { label: editingDepense.label, amount: editingDepense.amount, category: editingDepense.envelope_id || editingDepense.category, date: editingDepense.date, recurring: editingDepense.recurring } : undefined} />
        </Modal>
      </div>
      <div className="md:hidden">
        <BottomSheet isOpen={showAddForm} onClose={() => { setShowAddForm(false); setEditingId(null); }} title={editingId ? "Modifier une dépense" : "Ajouter une dépense"}>
          <AddTransactionForm type="expense" onSubmit={handleSubmitDepense} onCancel={() => { setShowAddForm(false); setEditingId(null); }} categories={expenseCategories} envelopeRemaining={envelopeRemaining} initialData={editingDepense ? { label: editingDepense.label, amount: editingDepense.amount, category: editingDepense.envelope_id || editingDepense.category, date: editingDepense.date, recurring: editingDepense.recurring } : undefined} />
        </BottomSheet>
      </div>

      <BottomSheet isOpen={showEnvelopeManager} onClose={() => setShowEnvelopeManager(false)} title="Gérer les enveloppes">
        <EnvelopeManager envelopes={envelopes} onAdd={handleAddEnvelope} onUpdate={updateEnvelope} onDelete={deleteEnvelope} />
      </BottomSheet>
    </div>
  );
}
