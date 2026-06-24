"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import MonthSelector from "@/app/_components/charts/MonthSelector";
import Icon from "@/app/_components/ui/Icon";
import PieChart from "@/app/_components/charts/PieChart";
import IncomeRow from "@/app/_components/budget/IncomeRow";
import SavingsGoal from "@/app/_components/budget/SavingsGoal";
import TransactionSearch from "@/app/_components/budget/TransactionSearch";
import Modal from "@/app/_components/ui/Modal";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import AddTransactionForm from "@/app/_components/budget/AddTransactionForm";
import Skeleton from "@/app/_components/ui/Skeleton";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth, revenusByCategory, totalRevenus } from "@/lib/utils/calculations";
import { useCurrency } from "@/lib/currency/provider";
import { useToast } from "@/app/_components/ui/Toast";
import { useUserId } from "@/lib/auth/provider";
import type { Revenu, Objectif } from "@/lib/supabase/types";

const ICON_FOR_TYPE: Record<string, { icon: string; bg: string }> = {
  salaire: { icon: "account_balance", bg: "bg-blue-500/15" },
  freelance: { icon: "work", bg: "bg-purple-500/15" },
  immobilier: { icon: "home_work", bg: "bg-orange-500/15" },
  allocation: { icon: "volunteer_activism", bg: "bg-green-500/15" },
  autre: { icon: "payments", bg: "bg-surface-container-high" },
};

function getIncomeIcon(type: string) {
  return ICON_FOR_TYPE[type.toLowerCase()] ?? ICON_FOR_TYPE.autre;
}

const revenusCategories = [
  { value: "principal", label: "Revenu principal" },
  { value: "secondaire", label: "Revenu secondaire" },
];

const INITIAL_MONTH = new Date().getMonth();
const INITIAL_YEAR = new Date().getFullYear();

export default function RevenusPage() {
  const [month, setMonth] = useState(INITIAL_MONTH);
  const [year, setYear] = useState(INITIAL_YEAR);
  const [displayMode, setDisplayMode] = useState<"eur" | "pct">("eur");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const userId = useUserId();
  const { formatAmount, currency } = useCurrency();
  const currencySymbol = { EUR: "€", USD: "$", GBP: "£", XOF: "CFA", XAF: "CFA", CAD: "CA$", CHF: "CHF" }[currency] || currency;
  const { toast } = useToast();
  const { data: allRevenus, loading, addItem, updateItem, deleteItem } = useOfflineData<Revenu>("revenus");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");

  const monthRevenus = useMemo(
    () => filterByMonth(allRevenus, month, year) as Revenu[],
    [allRevenus, month, year]
  );

  const allPrincipaux = revenusByCategory(monthRevenus, "principal");
  const allSecondaires = revenusByCategory(monthRevenus, "secondaire");
  const total = totalRevenus(monthRevenus);

  const principaux = useMemo(() => {
    let filtered = allPrincipaux;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => r.label.toLowerCase().includes(q));
    }
    if (filterCategory) {
      filtered = filtered.filter(r => r.category === filterCategory);
    }
    return filtered;
  }, [allPrincipaux, searchQuery, filterCategory]);

  const secondaires = useMemo(() => {
    let filtered = allSecondaires;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => r.label.toLowerCase().includes(q));
    }
    if (filterCategory) {
      filtered = filtered.filter(r => r.category === filterCategory);
    }
    return filtered;
  }, [allSecondaires, searchQuery, filterCategory]);

  const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  const pieSegments = useMemo(() => {
    const colors = ["#fde047", "#2563eb", "#22c55e", "#f97316", "#a855f7"];
    const grouped: Record<string, number> = {};
    monthRevenus.forEach((r) => {
      grouped[r.label] = (grouped[r.label] || 0) + r.amount;
    });
    return Object.entries(grouped).map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }));
  }, [monthRevenus]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const editingRevenu = editingId ? monthRevenus.find(r => r.id === editingId) : null;

  async function handleSubmitRevenu(data: { label: string; amount: number; category: string; date: string; recurring: boolean; type?: string }) {
    if (editingId) {
      await updateItem(editingId, {
        label: data.label,
        amount: data.amount,
        category: data.category as "principal" | "secondaire",
        type: data.type || "autre",
        date: data.date,
        recurring: data.recurring,
      });
      setEditingId(null);
    } else {
      await addItem({
        user_id: userId,
        label: data.label,
        amount: data.amount,
        category: data.category as "principal" | "secondaire",
        type: data.type || "autre",
        date: data.date,
        recurring: data.recurring,
        synced_at: null,
      });
    }
    setShowAddForm(false);
    toast(editingId ? `"${data.label}" modifié` : `Revenu "${data.label}" ajouté`);
  }

  async function handleDeleteRevenu(id: string) {
    await deleteItem(id);
    toast("Revenu supprimé", "info");
  }

  function handleEditRevenu(id: string) {
    const revenu = monthRevenus.find(r => r.id === id);
    if (revenu) {
      setEditingId(id);
      setShowAddForm(true);
    }
  }

  const formTitle = editingId ? "Modifier un revenu" : "Ajouter un revenu";
  const formInitialData = editingRevenu ? { label: editingRevenu.label, amount: editingRevenu.amount, category: editingRevenu.category, date: editingRevenu.date, recurring: editingRevenu.recurring, type: editingRevenu.type } : undefined;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />

      <TransactionSearch
        onSearch={setSearchQuery}
        onFilterCategory={setFilterCategory}
        categories={revenusCategories}
      />

      <div className="bg-surface-container rounded-2xl p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xl font-bold text-on-surface" suppressHydrationWarning>{formatAmount(total)}</p>
            <p className="text-[10px] md:text-sm text-on-surface-variant">1 - {daysInMonth} {monthNames[month]} {year}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setDisplayMode("eur")} className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${displayMode === "eur" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>{currencySymbol}</button>
            <button onClick={() => setDisplayMode("pct")} className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${displayMode === "pct" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>%</button>
          </div>
        </div>
        {loading ? (
          <Skeleton variant="circular" className="w-24 h-24 mx-auto" />
        ) : pieSegments.length > 0 ? (
          <PieChart segments={pieSegments} size={100} />
        ) : (
          <p className="text-center text-on-surface-variant text-xs py-3">Aucun revenu ce mois-ci</p>
        )}
      </div>

      <div>
        <h2 className="text-[13px] font-medium text-on-surface-variant mb-2">Revenus principaux</h2>
        {loading ? (
          <Skeleton variant="rectangular" className="h-[64px] md:h-[72px] rounded-2xl" />
        ) : principaux.length > 0 ? (
          <div className="space-y-2 md:space-y-3">
            {principaux.map((r) => {
              const ic = getIncomeIcon(r.type);
              return <IncomeRow key={r.id} icon={ic.icon} iconBg={ic.bg} label={r.label} amount={r.amount} onEdit={() => handleEditRevenu(r.id)} onDelete={() => handleDeleteRevenu(r.id)} />;
            })}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Aucun revenu principal</p>
        )}
      </div>

      <div>
        <h2 className="text-[13px] font-medium text-on-surface-variant mb-3">Revenus secondaires</h2>
        <div className="space-y-2 md:space-y-3">
          {secondaires.map((r) => {
            const ic = getIncomeIcon(r.type);
            return <IncomeRow key={r.id} icon={ic.icon} iconBg={ic.bg} label={r.label} amount={r.amount} onEdit={() => handleEditRevenu(r.id)} onDelete={() => handleDeleteRevenu(r.id)} />;
          })}
          <button onClick={() => setShowAddForm(true)} className="w-full p-4 flex items-center justify-center gap-2 text-primary font-medium hover:bg-surface-container-high rounded-2xl transition-colors">
            <Icon name="add" size={20} />
            <span>Ajouter un revenu</span>
          </button>
        </div>
      </div>

      {objectifs.length > 0 ? (
        <div>
          <h2 className="text-[13px] font-medium text-on-surface-variant mb-3">Mes objectifs</h2>
          <div className="space-y-2">
            {objectifs.slice(0, 3).map((obj) => (
              <SavingsGoal key={obj.id} label={obj.label} target={obj.target_amount} current={obj.current_amount} />
            ))}
          </div>
        </div>
      ) : (
        <Link href="/objectifs" className="flex items-center gap-3 p-4 bg-surface-container rounded-2xl border border-outline-variant/10 hover:border-primary/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">savings</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-on-surface">Créer un objectif d&apos;épargne</p>
            <p className="text-xs text-on-surface-variant">Définissez vos objectifs financiers</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </Link>
      )}

      <div className="hidden md:block">
        <Modal isOpen={showAddForm} onClose={() => { setShowAddForm(false); setEditingId(null); }} title={formTitle}>
          <AddTransactionForm type="income" onSubmit={handleSubmitRevenu} onCancel={() => { setShowAddForm(false); setEditingId(null); }} categories={revenusCategories} initialData={formInitialData} />
        </Modal>
      </div>
      <div className="md:hidden">
        <BottomSheet isOpen={showAddForm} onClose={() => { setShowAddForm(false); setEditingId(null); }} title={formTitle}>
          <AddTransactionForm type="income" onSubmit={handleSubmitRevenu} onCancel={() => { setShowAddForm(false); setEditingId(null); }} categories={revenusCategories} initialData={formInitialData} />
        </BottomSheet>
      </div>
    </div>
  );
}
