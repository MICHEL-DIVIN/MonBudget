import type { Revenu, Depense, Envelope } from "@/lib/supabase/types";
import { sameCalendarMonth, sameCalendarYear } from "@/lib/utils/dates";

export function totalRevenus(revenus: Revenu[]): number {
  return revenus.reduce((sum, r) => sum + r.amount, 0);
}

export function totalDepenses(depenses: Depense[]): number {
  return depenses.reduce((sum, d) => sum + d.amount, 0);
}

export function depensesByCategory(
  depenses: Depense[],
  category: "fixe" | "variable"
): Depense[] {
  return depenses.filter((d) => d.category === category);
}

export function revenusByCategory(
  revenus: Revenu[],
  category: "principal" | "secondaire"
): Revenu[] {
  return revenus.filter((r) => r.category === category);
}

export function envelopeSpent(depenses: Depense[], envelopeId: string): number {
  return depenses
    .filter((d) => d.envelope_id === envelopeId)
    .reduce((sum, d) => sum + d.amount, 0);
}

export function envelopeRemaining(
  envelope: Envelope,
  depenses: Depense[]
): number {
  return envelope.budgeted - envelopeSpent(depenses, envelope.id);
}

export function monthBalance(revenus: Revenu[], depenses: Depense[]): number {
  return totalRevenus(revenus) - totalDepenses(depenses);
}

export function savingsRate(revenus: Revenu[], depenses: Depense[]): number {
  const total = totalRevenus(revenus);
  if (total === 0) return 0;
  return ((total - totalDepenses(depenses)) / total) * 100;
}

export function filterByMonth(
  items: Array<{ date: string }>,
  month: number,
  year: number
): any[] {
  return items.filter((item) => sameCalendarMonth(item.date, year, month));
}

export function filterByYear(
  items: Array<{ date: string }>,
  year: number
): any[] {
  return items.filter((item) => sameCalendarYear(item.date, year));
}

// --- Monthly Snapshot ---

export interface EnvelopeSnapshot {
  id: string;
  name: string;
  icon: string;
  color: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "over";
}

export interface MonthlySnapshot {
  month: number;
  year: number;
  totalRevenus: number;
  revenusPrincipaux: number;
  revenusSecondaires: number;
  totalDepenses: number;
  depensesFixes: number;
  depensesVariables: number;
  balance: number;
  balancePercent: number;
  totalBudgeted: number;
  totalEnvelopeSpent: number;
  envelopeAdherence: number;
  envelopeDetails: EnvelopeSnapshot[];
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  avgDailySpending: number;
  projectedMonthlySpending: number;
  dailyBudgetRemaining: number;
  status: "excellent" | "bon" | "attention" | "danger" | "deficit";
  statusLabel: string;
  topExpenses: { label: string; total: number; count: number }[];
}

export function computeMonthlySnapshot(
  revenus: Revenu[],
  depenses: Depense[],
  envelopes: Envelope[],
  month: number,
  year: number
): MonthlySnapshot {
  const mRev = filterByMonth(revenus, month, year) as Revenu[];
  const mDep = filterByMonth(depenses, month, year) as Depense[];

  const totRev = totalRevenus(mRev);
  const revPrinc = totalRevenus(revenusByCategory(mRev, "principal"));
  const revSec = totalRevenus(revenusByCategory(mRev, "secondaire"));
  const totDep = totalDepenses(mDep);
  const depFix = totalDepenses(depensesByCategory(mDep, "fixe"));
  const depVar = totalDepenses(depensesByCategory(mDep, "variable"));
  const balance = totRev - totDep;
  const balancePercent = totRev > 0 ? (balance / totRev) * 100 : 0;

  const totalBudgeted = envelopes.reduce((s, e) => s + e.budgeted, 0);
  const totalEnvSpent = envelopes.reduce((s, e) => s + envelopeSpent(mDep, e.id), 0);
  const envelopeAdherence = totalBudgeted > 0 ? (totalEnvSpent / totalBudgeted) * 100 : 0;

  const envelopeDetails: EnvelopeSnapshot[] = envelopes.map((env) => {
    const spent = envelopeSpent(mDep, env.id);
    const remaining = env.budgeted - spent;
    const percent = env.budgeted > 0 ? (spent / env.budgeted) * 100 : 0;
    return {
      id: env.id, name: env.name, icon: env.icon, color: env.color,
      budgeted: env.budgeted, spent, remaining, percent,
      status: percent > 100 ? "over" : percent > 80 ? "warning" : "ok",
    };
  });

  const now = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrent = now.getMonth() === month && now.getFullYear() === year;
  const isPast = new Date(year, month + 1, 0) < now;
  const daysElapsed = isCurrent ? now.getDate() : isPast ? daysInMonth : 0;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const avgDaily = daysElapsed > 0 ? totDep / daysElapsed : 0;
  const projected = avgDaily * daysInMonth;
  const dailyBudgetRem = daysRemaining > 0 ? Math.max(0, totRev - totDep) / daysRemaining : 0;

  let status: MonthlySnapshot["status"];
  let statusLabel: string;
  if (totRev === 0 && totDep === 0) { status = "bon"; statusLabel = "Pas de données"; }
  else if (balancePercent >= 20) { status = "excellent"; statusLabel = "Excellent"; }
  else if (balancePercent >= 10) { status = "bon"; statusLabel = "Bon"; }
  else if (balancePercent >= 0) { status = "attention"; statusLabel = "Attention"; }
  else if (balancePercent >= -10) { status = "danger"; statusLabel = "Danger"; }
  else { status = "deficit"; statusLabel = "Déficit"; }

  const expMap = new Map<string, { total: number; count: number }>();
  mDep.forEach((d) => {
    const e = expMap.get(d.label) || { total: 0, count: 0 };
    expMap.set(d.label, { total: e.total + d.amount, count: e.count + 1 });
  });
  const topExpenses = Array.from(expMap.entries())
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    month, year,
    totalRevenus: totRev, revenusPrincipaux: revPrinc, revenusSecondaires: revSec,
    totalDepenses: totDep, depensesFixes: depFix, depensesVariables: depVar,
    balance, balancePercent,
    totalBudgeted, totalEnvelopeSpent: totalEnvSpent, envelopeAdherence, envelopeDetails,
    daysInMonth, daysElapsed, daysRemaining,
    avgDailySpending: avgDaily, projectedMonthlySpending: projected, dailyBudgetRemaining: dailyBudgetRem,
    status, statusLabel, topExpenses,
  };
}

// --- Budget Health ---

export interface BudgetHealth {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  insights: string[];
  warnings: string[];
}

export function computeBudgetHealth(snapshot: MonthlySnapshot): BudgetHealth {
  let score = 50;
  const insights: string[] = [];
  const warnings: string[] = [];

  if (snapshot.balancePercent >= 20) { score += 30; insights.push(`Excellent taux d'épargne de ${snapshot.balancePercent.toFixed(0)}%`); }
  else if (snapshot.balancePercent >= 10) { score += 20; insights.push(`Bon taux d'épargne de ${snapshot.balancePercent.toFixed(0)}%`); }
  else if (snapshot.balancePercent >= 0) { score += 5; warnings.push(`Taux d'épargne faible : ${snapshot.balancePercent.toFixed(0)}%`); }
  else { score -= 20; warnings.push("Dépenses supérieures aux revenus !"); }

  if (snapshot.envelopeAdherence <= 80) { score += 20; insights.push("Bonne maîtrise des enveloppes"); }
  else if (snapshot.envelopeAdherence <= 100) { score += 10; }
  else { score -= 10; warnings.push("Budget enveloppes dépassé"); }

  const overEnv = snapshot.envelopeDetails.filter((e) => e.status === "over");
  overEnv.forEach((e) => { score -= 5; warnings.push(`${e.name} : +${(e.percent - 100).toFixed(0)}% dépassé`); });

  if (snapshot.daysRemaining > 0 && snapshot.dailyBudgetRemaining > 0) {
    insights.push(`${snapshot.dailyBudgetRemaining.toFixed(0)}€/jour disponible`);
  }

  if (snapshot.daysElapsed > 5 && snapshot.projectedMonthlySpending > snapshot.totalRevenus * 1.1) {
    warnings.push("Projection fin de mois : dépassement probable");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  const grade: BudgetHealth["grade"] = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

  return { score, grade, insights, warnings };
}

// --- Annual Report types and computation ---

export interface MonthSummary {
  totalRevenus: number;
  totalDepenses: number;
  epargne: number;
  tauxEpargne: number;
}

export interface EnvelopeAnnualSummary {
  id: string;
  name: string;
  color: string;
  icon: string;
  totalSpent: number;
  annualBudget: number;
  adherence: number; // percentage used
}

export interface AnnualReport {
  totalRevenus: number;
  totalDepenses: number;
  totalEpargne: number;
  tauxEpargneMoyen: number;
  avgMonthlyRevenus: number;
  avgMonthlyDepenses: number;
  activeMonths: number;
  revenuTrend: number;   // % change vs previous year
  depenseTrend: number;  // % change vs previous year
  epargneTrend: number;  // % change vs previous year
  fixedTotal: number;
  variableTotal: number;
  fixedPct: number;
  variablePct: number;
  months: MonthSummary[];
  cumulativeSavings: number[];
  envelopeAnnual: EnvelopeAnnualSummary[];
  bestMonth: { index: number; epargne: number };
  worstMonth: { index: number; depenses: number };
  highestIncome: { index: number; revenus: number };
}

export function computeAnnualReport(
  allRevenus: Revenu[],
  allDepenses: Depense[],
  envelopes: Envelope[],
  year: number,
  prevYearRevenus: Revenu[],
  prevYearDepenses: Depense[]
): AnnualReport {
  const yearRev = filterByYear(allRevenus, year) as Revenu[];
  const yearDep = filterByYear(allDepenses, year) as Depense[];

  // Monthly summaries
  const months: MonthSummary[] = Array.from({ length: 12 }, (_, m) => {
    const mRev = filterByMonth(allRevenus, m, year) as Revenu[];
    const mDep = filterByMonth(allDepenses, m, year) as Depense[];
    const rev = totalRevenus(mRev);
    const dep = totalDepenses(mDep);
    const ep = rev - dep;
    return {
      totalRevenus: rev,
      totalDepenses: dep,
      epargne: ep,
      tauxEpargne: rev > 0 ? (ep / rev) * 100 : 0,
    };
  });

  // Totals
  const totRev = totalRevenus(yearRev);
  const totDep = totalDepenses(yearDep);
  const totEp = totRev - totDep;

  // Active months (at least one transaction)
  const activeMonths = months.filter(
    (m) => m.totalRevenus > 0 || m.totalDepenses > 0
  ).length;

  // Averages
  const avgMonthlyRevenus = activeMonths > 0 ? totRev / activeMonths : 0;
  const avgMonthlyDepenses = activeMonths > 0 ? totDep / activeMonths : 0;

  // Savings rate average
  const tauxEpargneMoyen = totRev > 0 ? (totEp / totRev) * 100 : 0;

  // Previous year totals for trend calculation
  const prevTotRev = totalRevenus(prevYearRevenus);
  const prevTotDep = totalDepenses(prevYearDepenses);
  const prevTotEp = prevTotRev - prevTotDep;

  const pctChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const revenuTrend = pctChange(totRev, prevTotRev);
  const depenseTrend = pctChange(totDep, prevTotDep);
  const epargneTrend = pctChange(totEp, prevTotEp);

  // Fixed vs variable
  const fixedDep = depensesByCategory(yearDep, "fixe");
  const variableDep = depensesByCategory(yearDep, "variable");
  const fixedTotal = totalDepenses(fixedDep);
  const variableTotal = totalDepenses(variableDep);
  const fixedPct = totDep > 0 ? Math.round((fixedTotal / totDep) * 100) : 0;
  const variablePct = totDep > 0 ? Math.round((variableTotal / totDep) * 100) : 0;

  // Cumulative savings
  const cumulativeSavings: number[] = [];
  let cumul = 0;
  for (const m of months) {
    cumul += m.epargne;
    cumulativeSavings.push(cumul);
  }

  // Envelope annual analysis
  const envelopeAnnual: EnvelopeAnnualSummary[] = envelopes.map((env) => {
    const spent = envelopeSpent(yearDep, env.id);
    const annualBudget = env.budgeted * 12;
    return {
      id: env.id,
      name: env.name,
      color: env.color,
      icon: env.icon,
      totalSpent: spent,
      annualBudget,
      adherence: annualBudget > 0 ? (spent / annualBudget) * 100 : 0,
    };
  });

  // Best month (highest savings)
  let bestIdx = 0;
  let bestEp = -Infinity;
  months.forEach((m, i) => {
    if (m.epargne > bestEp) {
      bestEp = m.epargne;
      bestIdx = i;
    }
  });

  // Worst month (highest spending)
  let worstIdx = 0;
  let worstDep = 0;
  months.forEach((m, i) => {
    if (m.totalDepenses > worstDep) {
      worstDep = m.totalDepenses;
      worstIdx = i;
    }
  });

  // Highest income month
  let highIdx = 0;
  let highRev = 0;
  months.forEach((m, i) => {
    if (m.totalRevenus > highRev) {
      highRev = m.totalRevenus;
      highIdx = i;
    }
  });

  return {
    totalRevenus: totRev,
    totalDepenses: totDep,
    totalEpargne: totEp,
    tauxEpargneMoyen,
    avgMonthlyRevenus,
    avgMonthlyDepenses,
    activeMonths,
    revenuTrend,
    depenseTrend,
    epargneTrend,
    fixedTotal,
    variableTotal,
    fixedPct,
    variablePct,
    months,
    cumulativeSavings,
    envelopeAnnual,
    bestMonth: { index: bestIdx, epargne: bestEp },
    worstMonth: { index: worstIdx, depenses: worstDep },
    highestIncome: { index: highIdx, revenus: highRev },
  };
}
