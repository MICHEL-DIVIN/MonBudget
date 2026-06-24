"use client";

import { useState, useMemo } from "react";
import Icon from "@/app/_components/ui/Icon";
import DonutChart from "@/app/_components/charts/DonutChart";
import TrendChart from "@/app/_components/charts/TrendChart";
import MonthSelector from "@/app/_components/charts/MonthSelector";
import EnvelopeCard from "@/app/_components/budget/EnvelopeCard";
import Skeleton from "@/app/_components/ui/Skeleton";
import { useOfflineData } from "@/lib/offline/hooks";
import { computeMonthlySnapshot, computeBudgetHealth, totalRevenus, totalDepenses } from "@/lib/utils/calculations";
import { formatDate } from "@/lib/utils/format";
import { useCurrency } from "@/lib/currency/provider";
import type { Depense, Envelope, Profile, Revenu } from "@/lib/supabase/types";

function txIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("loyer") || l.includes("logement")) return { icon: "home", bg: "bg-env-pink/15", text: "text-env-pink" };
  if (l.includes("eau")) return { icon: "water_drop", bg: "bg-env-blue/15", text: "text-env-blue" };
  if (l.includes("élect") || l.includes("elect")) return { icon: "bolt", bg: "bg-env-yellow/15", text: "text-env-yellow" };
  if (l.includes("gaz")) return { icon: "local_fire_department", bg: "bg-env-orange/15", text: "text-env-orange" };
  if (l.includes("course")) return { icon: "shopping_cart", bg: "bg-env-green/15", text: "text-env-green" };
  if (l.includes("shopping")) return { icon: "shopping_bag", bg: "bg-env-purple/15", text: "text-env-purple" };
  if (l.includes("cadeau")) return { icon: "redeem", bg: "bg-env-pink/15", text: "text-env-pink" };
  if (l.includes("loisir")) return { icon: "sports_esports", bg: "bg-env-orange/15", text: "text-env-orange" };
  if (l.includes("salaire")) return { icon: "account_balance", bg: "bg-success/15", text: "text-success" };
  if (l.includes("sport")) return { icon: "fitness_center", bg: "bg-error/15", text: "text-error" };
  return { icon: "payments", bg: "bg-on-surface-variant/10", text: "text-on-surface-variant" };
}

const IM = new Date().getMonth();
const IY = new Date().getFullYear();
const MN = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const MS = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aout","Sep","Oct","Nov","Dec"];

function groupByDate(txs: { id: string; label: string; amount: number; sortDate: string; date: string; icon: string; iconBg: string; iconText: string; type: "expense" | "income"; sub: string }[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; txs: typeof txs }[] = [];
  const map = new Map<string, typeof txs>();

  for (const tx of txs) {
    const d = new Date(tx.sortDate).toDateString();
    const label = d === today ? "Aujourd'hui" : d === yesterday ? "Hier" : new Date(tx.sortDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(tx);
  }

  for (const [label, items] of map) {
    groups.push({ label, txs: items });
  }
  return groups;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(IM);
  const [year, setYear] = useState(IY);

  const { data: allDep, loading: l1 } = useOfflineData<Depense>("depenses");
  const { data: envs, loading: l2 } = useOfflineData<Envelope>("envelopes");
  const { data: allRev, loading: l3 } = useOfflineData<Revenu>("revenus");
  const { data: profiles } = useOfflineData<Profile>("profiles");

  const { formatAmount } = useCurrency();
  const name = profiles.length > 0 ? profiles[0].full_name.split(" ")[0] : "";
  const loading = l1 || l2 || l3;
  const isCurrent = month === new Date().getMonth() && year === new Date().getFullYear();

  const snap = useMemo(() => computeMonthlySnapshot(allRev, allDep, envs, month, year), [allRev, allDep, envs, month, year]);
  const health = useMemo(() => computeBudgetHealth(snap), [snap]);

  const mDep = useMemo(() => allDep.filter(d => { const dt = new Date(d.date); return dt.getMonth() === month && dt.getFullYear() === year; }), [allDep, month, year]);
  const mRev = useMemo(() => allRev.filter(r => { const dt = new Date(r.date); return dt.getMonth() === month && dt.getFullYear() === year; }), [allRev, month, year]);

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      if (m < 0) { m += 12; y--; }
      const md = allDep.filter(d => { const dt = new Date(d.date); return dt.getMonth() === m && dt.getFullYear() === y; });
      const mr = allRev.filter(r => { const dt = new Date(r.date); return dt.getMonth() === m && dt.getFullYear() === y; });
      out.push({ label: MS[m], value: totalRevenus(mr) - totalDepenses(md) });
    }
    return out;
  }, [allDep, allRev, month, year]);

  const txs = useMemo(() => {
    const deps = mDep.map(x => { const ic = txIcon(x.label); const envName = x.envelope_id ? envs.find(e => e.id === x.envelope_id)?.name : null; return { id: x.id, label: x.label, amount: x.amount, sortDate: x.date, date: formatDate(x.date), icon: ic.icon, iconBg: ic.bg, iconText: ic.text, type: "expense" as const, sub: envName || (x.category === "fixe" ? "Dépense fixe" : "Dépense variable") }; });
    const revs = mRev.map(x => { const ic = txIcon(x.label); return { id: x.id, label: x.label, amount: x.amount, sortDate: x.date, date: formatDate(x.date), icon: ic.icon, iconBg: ic.bg, iconText: ic.text, type: "income" as const, sub: x.category === "principal" ? "Revenu principal" : "Revenu secondaire" }; });
    return [...deps, ...revs].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()).slice(0, 12);
  }, [mDep, mRev]);

  const hasData = snap.totalRevenus > 0 || snap.totalDepenses > 0;
  const groups = useMemo(() => groupByDate(txs), [txs]);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">

      <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />

      {/* Balance card */}
      {loading ? (
        <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
      ) : (
        <div className={`rounded-2xl p-5 relative overflow-hidden ${snap.balance >= 0 ? "bg-surface-container" : "bg-error/[0.06] border border-error/15"}`}>
          {/* Subtle glow for negative */}
          {snap.balance < 0 && <div className="absolute -top-20 -right-20 w-40 h-40 bg-error/10 rounded-full blur-3xl" />}

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-on-surface-variant">Solde disponible</p>
              {hasData && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${health.grade === "A" ? "bg-success/15 text-success" : health.grade === "B" ? "bg-primary/15 text-primary" : health.grade === "C" ? "bg-warning/15 text-warning" : "bg-error/15 text-error"}`}>
                  <span>{health.grade}</span>
                  <span className="text-on-surface-variant font-normal">{health.score}/100</span>
                </div>
              )}
            </div>

            <p className={`text-[32px] md:text-[38px] font-extrabold tracking-tight tabular-nums leading-none ${snap.balance >= 0 ? "text-on-surface" : "text-error"}`} suppressHydrationWarning>
              {formatAmount(snap.balance)}
            </p>

            {/* Revenus / Dépenses */}
            <div className="flex items-center gap-5 mt-5 pt-4 border-t border-outline-variant/10">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-success text-[16px]">south_west</span>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant">Revenus</p>
                  <p className="text-[14px] font-semibold text-on-surface tabular-nums" suppressHydrationWarning>{formatAmount(snap.totalRevenus)}</p>
                </div>
              </div>
              <div className="w-px h-8 bg-outline-variant/15" />
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-8 h-8 rounded-lg bg-error/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-error text-[16px]">north_east</span>
                </div>
                <div>
                  <p className="text-[11px] text-on-surface-variant">Dépenses</p>
                  <p className="text-[14px] font-semibold text-on-surface tabular-nums" suppressHydrationWarning>{formatAmount(snap.totalDepenses)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Budget */}
      {!loading && isCurrent && snap.daysRemaining > 0 && snap.totalRevenus > 0 && (
        <div className="flex items-center gap-3 bg-surface-container rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Icon name="today" size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-on-surface">Budget quotidien</p>
            <p className="text-[12px] text-on-surface-variant">{snap.daysRemaining} jours restants</p>
          </div>
          <p className="text-[15px] font-semibold text-primary tabular-nums" suppressHydrationWarning>{formatAmount(snap.dailyBudgetRemaining)}</p>
        </div>
      )}

      {/* Budget envelopes */}
      {envs.length > 0 && (
        <div>
          <p className="text-[13px] font-medium text-on-surface-variant mb-3">Budget</p>
          <div className="grid grid-cols-2 gap-2">
            {envs.map(env => {
              const d = snap.envelopeDetails.find(e => e.id === env.id);
              return <EnvelopeCard key={env.id} name={env.name} icon={env.icon} amount={env.budgeted} remaining={d?.remaining ?? env.budgeted} color={env.color} />;
            })}
          </div>
        </div>
      )}

      {/* Activity — date-grouped transactions */}
      <div>
        <p className="text-[13px] font-medium text-on-surface-variant mb-3">Activite récente</p>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} variant="rectangular" className="h-14 rounded-xl" />)}</div>
        ) : groups.length > 0 ? (
          groups.map(group => (
            <div key={group.label} className="mb-6 last:mb-0">
              <p className="text-[13px] text-on-surface-variant text-center mb-2">{group.label}</p>
              <div className="divide-y divide-outline-variant/10">
                {group.txs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-4 py-3.5">
                    <div className={`w-10 h-10 rounded-xl ${tx.iconBg} flex items-center justify-center shrink-0`}>
                      <span className={`material-symbols-outlined text-xl ${tx.iconText}`}>{tx.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-on-surface truncate">{tx.label}</p>
                      <p className="text-[12px] text-on-surface-variant">{tx.sub}</p>
                    </div>
                    <span className={`text-[15px] font-semibold tabular-nums ${tx.type === "income" ? "text-success" : "text-on-surface"}`} suppressHydrationWarning>
                      {tx.type === "income" ? "+" : "−"}{formatAmount(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-primary">add_circle</span>
            </div>
            <p className="text-[15px] font-medium text-on-surface">Pas encore de transactions</p>
            <p className="text-[13px] text-on-surface-variant mt-1 mb-4">Commencez par ajouter votre premier revenu ou dépense</p>
            <div className="flex items-center justify-center gap-3">
              <button className="flex items-center gap-1.5 bg-success/15 text-success px-4 py-2 rounded-xl text-[13px] font-medium active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-base">arrow_downward</span>
                Revenu
              </button>
              <button className="flex items-center gap-1.5 bg-error/15 text-error px-4 py-2 rounded-xl text-[13px] font-medium active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-base">arrow_upward</span>
                Dépense
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trend */}
      {!loading && trend.some(d => d.value !== 0) && (
        <div>
          <p className="text-[13px] font-medium text-on-surface-variant mb-3">Tendance</p>
          <div className="bg-surface-container rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-on-surface">Épargne</span>
              <span className="text-[12px] text-on-surface-variant">6 mois</span>
            </div>
            <TrendChart data={trend} height={90} color={trend[trend.length - 1]?.value >= 0 ? "text-success" : "text-error"} />
          </div>
        </div>
      )}
    </div>
  );
}
