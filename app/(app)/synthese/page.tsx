"use client";

import { useState, useMemo } from "react";
import Card from "@/app/_components/ui/Card";
import Icon from "@/app/_components/ui/Icon";
import Button from "@/app/_components/ui/Button";
import Badge from "@/app/_components/ui/Badge";
import KPICard from "@/app/_components/budget/KPICard";
import BarChart from "@/app/_components/charts/BarChart";
import DonutChart from "@/app/_components/charts/DonutChart";
import Skeleton from "@/app/_components/ui/Skeleton";
import { useOfflineData } from "@/lib/offline/hooks";
import { computeAnnualReport, filterByYear } from "@/lib/utils/calculations";
import type { AnnualReport } from "@/lib/utils/calculations";
import { useCurrency } from "@/lib/currency/provider";
import { generateBudgetPdf } from "@/lib/utils/exportPdf";
import type { Revenu, Depense, Envelope } from "@/lib/supabase/types";

const MN = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Août", "Sep", "Oct", "Nov", "Déc"];

export default function SynthesePage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { formatAmount } = useCurrency();
  const { data: allRevenus, loading: l1 } = useOfflineData<Revenu>("revenus");
  const { data: allDepenses, loading: l2 } = useOfflineData<Depense>("depenses");
  const { data: envelopes, loading: l3 } = useOfflineData<Envelope>("envelopes");

  const loading = l1 || l2 || l3;

  const report: AnnualReport = useMemo(() => {
    const prevRev = filterByYear(allRevenus, year - 1) as Revenu[];
    const prevDep = filterByYear(allDepenses, year - 1) as Depense[];
    return computeAnnualReport(allRevenus, allDepenses, envelopes, year, prevRev, prevDep);
  }, [allRevenus, allDepenses, envelopes, year]);

  const kpis = [
    { icon: "account_balance_wallet", iconBg: "bg-primary/15", label: "Revenus totaux", value: formatAmount(report.totalRevenus), badge: report.revenuTrend !== 0 ? `${report.revenuTrend >= 0 ? "+" : ""}${report.revenuTrend.toFixed(0)}%` : undefined, badgeVariant: (report.revenuTrend >= 0 ? "success" : "error") as "success" | "error" },
    { icon: "receipt_long", iconBg: "bg-error/15", label: "Dépenses totales", value: formatAmount(report.totalDepenses), badge: report.depenseTrend !== 0 ? `${report.depenseTrend >= 0 ? "+" : ""}${report.depenseTrend.toFixed(0)}%` : undefined, badgeVariant: (report.depenseTrend <= 0 ? "success" : "error") as "success" | "error" },
    { icon: "savings", iconBg: "bg-green-500/15", label: "Épargne nette", value: formatAmount(report.totalEpargne), badge: report.epargneTrend !== 0 ? `${report.epargneTrend >= 0 ? "+" : ""}${report.epargneTrend.toFixed(0)}%` : undefined, badgeVariant: (report.epargneTrend >= 0 ? "success" : "error") as "success" | "error" },
    { icon: "percent", iconBg: "bg-secondary/15", label: "Taux d'épargne", value: `${report.tauxEpargneMoyen.toFixed(1)}%`, badge: undefined, badgeVariant: undefined },
    { icon: "trending_up", iconBg: "bg-tertiary/15", label: "Revenu moy./mois", value: formatAmount(report.avgMonthlyRevenus), badge: undefined, badgeVariant: undefined },
    { icon: "calendar_month", iconBg: "bg-blue-500/15", label: "Mois actifs", value: `${report.activeMonths}/12`, badge: undefined, badgeVariant: undefined },
  ];

  const barData = report.months.map((m, i) => ({
    label: MS[i],
    values: [m.totalRevenus, m.totalDepenses],
    colors: ["bg-success/40", "bg-error/40"],
  }));

  const savingsBarData = report.cumulativeSavings.map((v, i) => ({
    label: MS[i],
    values: [Math.max(0, v)],
    colors: [v >= 0 ? "bg-success/50" : "bg-error/50"],
  }));

  function getStatus(ep: number, rev: number) {
    if (rev === 0) return "—";
    const r = ep / rev;
    return r >= 0.15 ? "Sain" : r >= 0 ? "Limite" : "Déficit";
  }

  function handleExportPdf() {
    const activeMs = report.months.filter((m) => m.totalRevenus > 0 || m.totalDepenses > 0);
    generateBudgetPdf({
      title: `Synthèse Annuelle ${year}`,
      subtitle: `Rapport généré le ${new Date().toLocaleDateString("fr-FR")}`,
      summary: [
        { label: "Revenus totaux", value: formatAmount(report.totalRevenus) },
        { label: "Dépenses totales", value: formatAmount(report.totalDepenses) },
        { label: "Épargne nette", value: formatAmount(report.totalEpargne) },
        { label: "Taux d'épargne", value: `${report.tauxEpargneMoyen.toFixed(1)}%` },
      ],
      sections: [
        {
          title: "Récapitulatif Mensuel",
          rows: activeMs.map((m, i) => {
            const idx = report.months.indexOf(m);
            return { label: MN[idx], amount: formatAmount(m.epargne), category: `Rev: ${formatAmount(m.totalRevenus)}`, date: `Dép: ${formatAmount(m.totalDepenses)}` };
          }),
        },
        ...(report.envelopeAnnual.length > 0 ? [{
          title: "Performance des Enveloppes",
          rows: report.envelopeAnnual.map((e) => ({ label: e.name, amount: formatAmount(e.totalSpent), category: `Budget: ${formatAmount(e.annualBudget)}`, date: `${e.adherence.toFixed(0)}%` })),
        }] : []),
      ],
      footer: "Mon Budget Familial — Rapport confidentiel",
    });
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Synthèse Annuelle</p>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface">Année {year}</h1>
          <p className="text-xs text-on-surface-variant mt-1">Vue d&apos;ensemble de la santé financière de votre foyer.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(year - 1)} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center"><Icon name="chevron_left" size={20} /></button>
          <span className="px-3 py-1.5 border border-outline-variant rounded-full text-sm font-medium">{year}</span>
          <button onClick={() => setYear(year + 1)} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center"><Icon name="chevron_right" size={20} /></button>
          <Button variant="primary" size="md" icon="download" onClick={handleExportPdf}>PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} variant="rectangular" className="h-[100px] rounded-[20px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(k => <KPICard key={k.label} {...k} />)}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card padding="md" className="p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-on-surface">Revenus vs Dépenses</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success/60" />Revenus</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error/60" />Dépenses</span>
            </div>
          </div>
          {loading ? <Skeleton variant="rectangular" className="h-[180px] rounded-xl" /> : <BarChart data={barData} height={180} />}
        </Card>
        <Card padding="md" className="p-4 lg:col-span-2 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-on-surface mb-3 self-start">Répartition</h3>
          {loading ? <Skeleton variant="circular" className="w-[140px] h-[140px]" /> : (
            <>
              <DonutChart value={report.fixedTotal} total={report.totalDepenses || 1} size={140} label="Total dépensé" />
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Fixes {report.fixedPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary" />Variables {report.variablePct}%</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Cumulative Savings */}
      {!loading && report.activeMonths > 0 && (
        <Card padding="md" className="p-4">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Épargne cumulée</h3>
          <BarChart data={savingsBarData} height={120} />
        </Card>
      )}

      {/* Envelope Performance */}
      {!loading && report.envelopeAnnual.length > 0 && (
        <Card padding="md" className="p-4">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Performance des enveloppes</h3>
          <div className="space-y-3">
            {report.envelopeAnnual.map(env => (
              <div key={env.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${env.color} flex items-center justify-center`}>
                      <span className="material-symbols-outlined text-xs">{env.icon}</span>
                    </div>
                    <span className="font-medium text-on-surface">{env.name}</span>
                  </div>
                  <span className="text-on-surface-variant" suppressHydrationWarning>{formatAmount(env.totalSpent)} / {formatAmount(env.annualBudget)}</span>
                </div>
                <div className="w-full h-2 bg-outline-variant/20 rounded-full">
                  <div className={`h-full rounded-full transition-all ${env.adherence <= 90 ? "bg-primary" : env.adherence <= 100 ? "bg-warning" : "bg-error"}`} style={{ width: `${Math.min(env.adherence, 100)}%` }} />
                </div>
                <p className="text-xs text-on-surface-variant">{env.adherence.toFixed(0)}% du budget annuel utilisé</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Monthly Table */}
      <Card padding="md" className="p-4">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Récapitulatif mensuel</h3>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-xs md:text-sm min-w-[520px]">
            <thead>
              <tr className="bg-surface-container-high">
                <th className="text-left px-2 md:px-4 py-2 font-medium text-on-surface-variant rounded-l-xl">Mois</th>
                <th className="text-right px-2 md:px-4 py-2 font-medium text-on-surface-variant">Revenus</th>
                <th className="text-right px-2 md:px-4 py-2 font-medium text-on-surface-variant">Dépenses</th>
                <th className="text-right px-2 md:px-4 py-2 font-medium text-on-surface-variant">Épargne</th>
                <th className="text-right px-2 md:px-4 py-2 font-medium text-on-surface-variant">Taux</th>
                <th className="text-right px-2 md:px-4 py-2 font-medium text-on-surface-variant rounded-r-xl">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3,4].map(i => <tr key={i}><td colSpan={6} className="px-2 py-2"><Skeleton variant="text" className="h-4" /></td></tr>)
              ) : (
                report.months.map((m, i) => {
                  if (m.totalRevenus === 0 && m.totalDepenses === 0) return null;
                  const st = getStatus(m.epargne, m.totalRevenus);
                  return (
                    <tr key={i} className="border-b border-surface-variant/30 hover:bg-surface-container-high transition-colors">
                      <td className="px-2 md:px-4 py-2 font-medium text-on-surface whitespace-nowrap">{MN[i]}</td>
                      <td className="px-2 md:px-4 py-2 text-right text-on-surface whitespace-nowrap" suppressHydrationWarning>{formatAmount(m.totalRevenus)}</td>
                      <td className="px-2 md:px-4 py-2 text-right text-error whitespace-nowrap" suppressHydrationWarning>{formatAmount(m.totalDepenses)}</td>
                      <td className={`px-2 md:px-4 py-2 text-right whitespace-nowrap ${m.epargne >= 0 ? "text-success" : "text-error"}`} suppressHydrationWarning>{formatAmount(m.epargne)}</td>
                      <td className="px-2 md:px-4 py-2 text-right text-on-surface-variant whitespace-nowrap">{m.tauxEpargne.toFixed(0)}%</td>
                      <td className="px-2 md:px-4 py-2 text-right">
                        <Badge variant={st === "Sain" ? "success" : st === "Limite" ? "warning" : "error"}>{st}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && report.activeMonths === 0 && (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-on-surface-variant">Aucune donnée pour {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Key Months */}
      {!loading && report.activeMonths > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-on-surface">Mois clés</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {report.bestMonth.epargne > 0 && (
              <Card padding="sm" className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center"><Icon name="emoji_events" size={20} className="text-success" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant">Meilleure épargne</p>
                    <p className="text-sm font-semibold text-on-surface">{MN[report.bestMonth.index]}</p>
                  </div>
                  <span className="text-success font-bold text-sm" suppressHydrationWarning>+{formatAmount(report.bestMonth.epargne)}</span>
                </div>
              </Card>
            )}
            {report.worstMonth.depenses > 0 && (
              <Card padding="sm" className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-error/15 flex items-center justify-center"><Icon name="trending_down" size={20} className="text-error" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant">Plus grosses dépenses</p>
                    <p className="text-sm font-semibold text-on-surface">{MN[report.worstMonth.index]}</p>
                  </div>
                  <span className="text-error font-bold text-sm" suppressHydrationWarning>-{formatAmount(report.worstMonth.depenses)}</span>
                </div>
              </Card>
            )}
            {report.highestIncome.revenus > 0 && (
              <Card padding="sm" className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Icon name="star" size={20} className="text-primary" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant">Meilleur revenu</p>
                    <p className="text-sm font-semibold text-on-surface">{MN[report.highestIncome.index]}</p>
                  </div>
                  <span className="text-primary font-bold text-sm" suppressHydrationWarning>{formatAmount(report.highestIncome.revenus)}</span>
                </div>
              </Card>
            )}
          </div>
          <div className="md:hidden">
            <Button variant="primary" size="lg" className="w-full" icon="download" onClick={handleExportPdf}>Exporter PDF</Button>
          </div>
        </div>
      )}
    </div>
  );
}
