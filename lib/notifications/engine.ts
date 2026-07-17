"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { useCurrency } from "@/lib/currency/provider";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import { filterByDateRange, getLastWeekRange } from "@/lib/utils/dates";
import { areNotificationsEnabled, areBudgetAlertsEnabled, isWeeklyReportEnabled } from "@/lib/notifications/prefs";
import type { Revenu, Depense, Envelope, Objectif } from "@/lib/supabase/types";

const CHECK_KEY = "monbudget-notif-last-check";
const WEEKLY_KEY = "monbudget-weekly-last-sent";
const MIN_INTERVAL = 3600_000;

type Fmt = (n: number) => string;

interface AutoNotif {
  key: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success";
  url: string;
}

export function useNotificationEngine() {
  const { user } = useAuth();
  const { data: revenus } = useOfflineData<Revenu>("revenus");
  const { data: depenses } = useOfflineData<Depense>("depenses");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");
  const { formatAmount } = useCurrency();
  const lastDataHash = useRef("");

  useEffect(() => {
    if (!user) return;
    if (!areNotificationsEnabled()) return;
    if (revenus.length === 0 && depenses.length === 0 && objectifs.length === 0) return;

    const revSum = revenus.reduce((s, r) => s + r.amount, 0).toFixed(0);
    const depSum = depenses.reduce((s, d) => s + d.amount, 0).toFixed(0);
    const envSum = envelopes.reduce((s, e) => s + e.budgeted, 0).toFixed(0);
    const objSum = objectifs.reduce((s, o) => s + o.current_amount, 0).toFixed(0);
    const hash = `${revenus.length}-${depenses.length}-${objectifs.length}-${envelopes.length}-${revSum}-${depSum}-${envSum}-${objSum}`;
    const lastCheck = localStorage.getItem(CHECK_KEY);
    const timePassed = !lastCheck || Date.now() - Number(lastCheck) >= MIN_INTERVAL;
    const dataChanged = hash !== lastDataHash.current;

    if (!timePassed && !dataChanged) return;

    lastDataHash.current = hash;
    runChecks(user.id, revenus, depenses, envelopes, objectifs, formatAmount);
    localStorage.setItem(CHECK_KEY, String(Date.now()));
  }, [user, revenus, depenses, envelopes, objectifs, formatAmount]);

  useEffect(() => {
    if (!user || !isWeeklyReportEnabled()) return;
    sendWeeklyReportIfDue(user.id, revenus, depenses, formatAmount);
  }, [user, revenus, depenses, formatAmount]);
}

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

async function sendWeeklyReportIfDue(userId: string, revenus: Revenu[], depenses: Depense[], fmt: Fmt) {
  const now = new Date();
  if (now.getDay() !== 1) return;

  const weekKey = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  if (localStorage.getItem(WEEKLY_KEY) === weekKey) return;

  const { start, end } = getLastWeekRange(now);
  const weekRev = filterByDateRange(revenus, start, end) as Revenu[];
  const weekDep = filterByDateRange(depenses, start, end) as Depense[];
  const totRev = totalRevenus(weekRev);
  const totDep = totalDepenses(weekDep);
  const balance = totRev - totDep;

  if (totRev === 0 && totDep === 0) return;

  const pct = totRev > 0 ? Math.round((totDep / totRev) * 100) : 0;
  const body = totRev > 0
    ? `Du ${frDate(start)} au ${frDate(end)} — Revenus : ${fmt(totRev)} · Dépenses : ${fmt(totDep)} (${pct}%) · ${balance >= 0 ? "Épargne" : "Déficit"} : ${fmt(Math.abs(balance))}`
    : `Du ${frDate(start)} au ${frDate(end)} — ${fmt(totDep)} de dépenses enregistrées sans revenu saisi.`;

  const sent = await persistAndShow(userId, {
    key: `weekly-${weekKey}`,
    title: "Rapport hebdomadaire",
    body,
    type: "info",
    url: "/synthese",
  });
  if (sent) localStorage.setItem(WEEKLY_KEY, weekKey);
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function runChecks(
  userId: string,
  revenus: Revenu[],
  depenses: Depense[],
  envelopes: Envelope[],
  objectifs: Objectif[],
  fmt: Fmt
) {
  const budgetAlerts = areBudgetAlertsEnabled();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const monthRev = filterByMonth(revenus, month, year) as Revenu[];
  const monthDep = filterByMonth(depenses, month, year) as Depense[];
  const totRev = totalRevenus(monthRev);
  const totDep = totalDepenses(monthDep);
  const balance = totRev - totDep;

  const pending: AutoNotif[] = [];

  if (budgetAlerts) {
    // Dépenses excessives (>100% des revenus)
    if (totRev > 0 && totDep > totRev) {
      const overage = totDep - totRev;
      const pct = Math.round((totDep / totRev) * 100);
      pending.push({
        key: `overspend-${year}-${month}`,
        title: "Dépenses excessives",
        body: `Vous avez dépensé ${fmt(totDep)} pour ${fmt(totRev)} de revenus ce mois (${pct}%). Dépassement de ${fmt(overage)} — réduisez vos dépenses variables pour limiter les dégâts.`,
        type: "warning",
        url: "/depenses",
      });
    }
    // Budget serré (80–100% des revenus)
    else if (totRev > 0 && totDep > totRev * 0.8) {
      const remaining = totRev - totDep;
      const pct = Math.round((totDep / totRev) * 100);
      const perDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : remaining;
      pending.push({
        key: `high-spend-${year}-${month}`,
        title: "Budget serré",
        body: `${pct}% de vos revenus dépensés. Il vous reste ${fmt(remaining)} pour les ${daysRemaining} prochains jours, soit environ ${fmt(perDay)}/jour.`,
        type: "warning",
        url: "/depenses",
      });
    }

    // Alerte mi-mois (jours 13–17, entre 65% et 80% dépensé)
    if (totRev > 0 && dayOfMonth >= 13 && dayOfMonth <= 17) {
      const pct = (totDep / totRev) * 100;
      if (pct > 65 && pct <= 80) {
        const remaining = totRev - totDep;
        const perDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : remaining;
        pending.push({
          key: `midmonth-${year}-${month}`,
          title: "Attention à mi-mois",
          body: `À mi-parcours, ${Math.round(pct)}% de vos revenus sont déjà utilisés (${fmt(totDep)}/${fmt(totRev)}). Il reste ${fmt(remaining)} pour la 2ème moitié, soit ${fmt(perDay)}/jour.`,
          type: "warning",
          url: "/depenses",
        });
      }
    }

    // Revenus non renseignés (après le 5 du mois, dépenses sans revenus)
    if (dayOfMonth >= 5 && totRev === 0 && monthDep.length > 0) {
      pending.push({
        key: `no-income-${year}-${month}`,
        title: "Revenus non renseignés",
        body: `Vous avez ${monthDep.length} dépense${monthDep.length > 1 ? "s" : ""} enregistrée${monthDep.length > 1 ? "s" : ""} ce mois mais aucun revenu. Pensez à saisir votre salaire pour un suivi complet.`,
        type: "info",
        url: "/revenus",
      });
    }

    // Enveloppes dépassées
    for (const env of envelopes) {
      const spent = monthDep
        .filter((d) => d.envelope_id === env.id)
        .reduce((s, d) => s + Number(d.amount), 0);
      if (env.budgeted > 0 && spent > env.budgeted) {
        const overage = spent - env.budgeted;
        const pct = Math.round((spent / env.budgeted) * 100);
        pending.push({
          key: `env-over-${env.id}-${year}-${month}`,
          title: `Enveloppe "${env.name}" dépassée`,
          body: `${fmt(spent)} dépensés sur ${fmt(env.budgeted)} budgétisés (${pct}%). Dépassement de ${fmt(overage)}.`,
          type: "warning",
          url: "/depenses",
        });
      }
    }

    // Hausse des dépenses vs mois précédent (>+30%)
    {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const prevDep = filterByMonth(depenses, prevMonth, prevYear) as Depense[];
      const prevTot = totalDepenses(prevDep);
      if (prevTot > 0 && totDep > prevTot * 1.3) {
        const increase = totDep - prevTot;
        const pct = Math.round(((totDep - prevTot) / prevTot) * 100);
        pending.push({
          key: `spending-increase-${year}-${month}`,
          title: "Hausse des dépenses",
          body: `Vos dépenses ont augmenté de +${pct}% vs le mois dernier (${fmt(totDep)} vs ${fmt(prevTot)}, soit +${fmt(increase)}). Vérifiez les catégories en hausse.`,
          type: "warning",
          url: "/depenses",
        });
      }
    }
  }

  // Objectifs d'épargne
  for (const obj of objectifs) {
    const pct = Number(obj.target_amount) > 0
      ? (Number(obj.current_amount) / Number(obj.target_amount)) * 100
      : 0;
    const remaining = Number(obj.target_amount) - Number(obj.current_amount);

    if (pct >= 100) {
      pending.push({
        key: `obj-done-${obj.id}`,
        title: "Objectif atteint !",
        body: `Félicitations ! "${obj.label}" est complété (${fmt(Number(obj.target_amount))}). C'est le moment d'en définir un nouveau !`,
        type: "success",
        url: "/objectifs",
      });
    } else if (pct >= 50 && pct < 100) {
      pending.push({
        key: `obj-half-${obj.id}`,
        title: "Objectif à mi-chemin",
        body: `"${obj.label}" est à ${Math.round(pct)}% — encore ${fmt(Math.round(remaining))} à épargner. Continuez sur cette lancée !`,
        type: "info",
        url: "/objectifs",
      });
    }

    if (obj.deadline) {
      const [y, m, d] = obj.deadline.split("-").map(Number);
      const deadlineDate = new Date(y, m - 1, d);
      const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);
      if (daysLeft > 0 && daysLeft <= 7 && pct < 90) {
        pending.push({
          key: `obj-deadline-${obj.id}-${daysLeft}`,
          title: `Échéance dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
          body: `"${obj.label}" arrive à échéance dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""} avec ${Math.round(pct)}% atteints. Il manque encore ${fmt(Math.round(remaining))}.`,
          type: "warning",
          url: "/objectifs",
        });
      }
      if (daysLeft < 0 && pct < 100) {
        pending.push({
          key: `obj-expired-${obj.id}`,
          title: "Objectif non atteint",
          body: `L'échéance de "${obj.label}" est dépassée (${Math.round(pct)}% complété, manquait ${fmt(Math.round(remaining))}). Voulez-vous prolonger ou réviser cet objectif ?`,
          type: "warning",
          url: "/objectifs",
        });
      }
    }
  }

  // Bonne gestion budgétaire (≥30% d'épargne)
  if (totRev > 0 && balance >= 0 && balance / totRev >= 0.3) {
    const pct = Math.round((balance / totRev) * 100);
    pending.push({
      key: `good-saver-${year}-${month}`,
      title: "Excellent mois !",
      body: `Vous épargnez ${pct}% de vos revenus ce mois, soit ${fmt(balance)}. Bravo pour cette excellente discipline budgétaire !`,
      type: "success",
      url: "/synthese",
    });
  }

  if (pending.length === 0) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("title, type")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

  const existingKeys = new Set(
    (existing ?? []).map((n: { title: string; type: string }) => `${n.type}:${n.title}`)
  );

  for (const notif of pending) {
    if (existingKeys.has(`${notif.type}:${notif.title}`)) continue;
    await persistAndShow(userId, notif);
  }
}

async function persistAndShow(userId: string, notif: AutoNotif): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: notif.title,
    body: notif.body,
    type: notif.type,
    created_by: null,
  });

  if (error) return false;

  if (!areNotificationsEnabled()) return true;

  if ("serviceWorker" in navigator && Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(notif.title, {
        body: notif.body,
        icon: "/icon-192x192.svg",
        tag: notif.key,
        data: { url: notif.url },
      } as NotificationOptions);
    } catch { /* not critical */ }
  }

  return true;
}
