"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import { filterByDateRange, getLastWeekRange } from "@/lib/utils/dates";
import { areNotificationsEnabled, areBudgetAlertsEnabled, isWeeklyReportEnabled } from "@/lib/notifications/prefs";
import type { Revenu, Depense, Envelope, Objectif } from "@/lib/supabase/types";

const CHECK_KEY = "monbudget-notif-last-check";
const WEEKLY_KEY = "monbudget-weekly-last-sent";
const MIN_INTERVAL = 3600_000;

interface AutoNotif {
  key: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success";
}

export function useNotificationEngine() {
  const { user } = useAuth();
  const { data: revenus } = useOfflineData<Revenu>("revenus");
  const { data: depenses } = useOfflineData<Depense>("depenses");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");
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
    runChecks(user.id, revenus, depenses, envelopes, objectifs);
    localStorage.setItem(CHECK_KEY, String(Date.now()));
  }, [user, revenus, depenses, envelopes, objectifs]);

  useEffect(() => {
    if (!user || !isWeeklyReportEnabled()) return;
    sendWeeklyReportIfDue(user.id, revenus, depenses);
  }, [user, revenus, depenses]);
}

async function sendWeeklyReportIfDue(userId: string, revenus: Revenu[], depenses: Depense[]) {
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

  const title = "Rapport hebdomadaire";
  const body = totRev > 0
    ? `Semaine du ${start} au ${end} : ${Math.round(totDep)} dépensés sur ${Math.round(totRev)} de revenus (${Math.round((totDep / totRev) * 100)}%). Solde : ${Math.round(balance)}.`
    : `Semaine du ${start} au ${end} : ${Math.round(totDep)} de dépenses enregistrées.`;

  const sent = await persistAndShow(userId, { key: `weekly-${weekKey}`, title, body, type: "info" });
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
  objectifs: Objectif[]
) {
  const budgetAlerts = areBudgetAlertsEnabled();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthRev = filterByMonth(revenus, month, year) as Revenu[];
  const monthDep = filterByMonth(depenses, month, year) as Depense[];
  const totRev = totalRevenus(monthRev);
  const totDep = totalDepenses(monthDep);
  const balance = totRev - totDep;

  const pending: AutoNotif[] = [];

  if (budgetAlerts && totRev > 0 && totDep > totRev) {
    pending.push({
      key: `overspend-${year}-${month}`,
      title: "Dépenses excessives",
      body: `Vous avez dépensé ${Math.round((totDep / totRev) * 100)}% de vos revenus ce mois.`,
      type: "warning",
    });
  }

  if (budgetAlerts && totRev > 0 && totDep > totRev * 0.8 && totDep <= totRev) {
    pending.push({
      key: `high-spend-${year}-${month}`,
      title: "Budget serré",
      body: `Vous avez utilisé ${Math.round((totDep / totRev) * 100)}% de vos revenus.`,
      type: "warning",
    });
  }

  if (budgetAlerts) {
    for (const env of envelopes) {
      const spent = monthDep.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
      if (env.budgeted > 0 && spent > env.budgeted) {
        pending.push({
          key: `env-over-${env.id}-${year}-${month}`,
          title: `Enveloppe "${env.name}" dépassée`,
          body: `Dépassement de ${Math.round(spent - env.budgeted)} sur un budget de ${Math.round(env.budgeted)}.`,
          type: "warning",
        });
      }
    }
  }

  for (const obj of objectifs) {
    const pct = Number(obj.target_amount) > 0 ? (Number(obj.current_amount) / Number(obj.target_amount)) * 100 : 0;

    if (pct >= 100) {
      pending.push({
        key: `obj-done-${obj.id}`,
        title: "Objectif atteint !",
        body: `Félicitations ! Votre objectif "${obj.label}" a été atteint.`,
        type: "success",
      });
    }

    if (pct >= 50 && pct < 100) {
      pending.push({
        key: `obj-half-${obj.id}`,
        title: "Objectif à mi-chemin",
        body: `Votre objectif "${obj.label}" est à ${Math.round(pct)}%. Continuez !`,
        type: "info",
      });
    }

    if (obj.deadline) {
      const deadlineDate = new Date(obj.deadline);
      const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);
      if (daysLeft > 0 && daysLeft <= 7 && pct < 90) {
        pending.push({
          key: `obj-deadline-${obj.id}-${daysLeft}d`,
          title: "Échéance proche",
          body: `"${obj.label}" arrive dans ${daysLeft} jour(s) (${Math.round(pct)}%).`,
          type: "warning",
        });
      }
      if (daysLeft < 0 && pct < 100) {
        pending.push({
          key: `obj-expired-${obj.id}`,
          title: "Échéance dépassée",
          body: `L'échéance de "${obj.label}" est passée (${Math.round(pct)}%).`,
          type: "warning",
        });
      }
    }
  }

  if (totRev > 0 && balance > 0 && balance / totRev >= 0.3) {
    pending.push({
      key: `good-saver-${year}-${month}`,
      title: "Excellent mois !",
      body: `Vous épargnez ${Math.round((balance / totRev) * 100)}% de vos revenus ce mois.`,
      type: "success",
    });
  }

  if (budgetAlerts) {
    const dayOfMonth = now.getDate();
    if (dayOfMonth === 1 || dayOfMonth === 15) {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const prevDep = filterByMonth(depenses, prevMonth, prevYear) as Depense[];
      const prevTot = totalDepenses(prevDep);
      if (prevTot > 0 && totDep > prevTot * 1.3) {
        pending.push({
          key: `spending-increase-${year}-${month}`,
          title: "Hausse des dépenses",
          body: `Dépenses +${Math.round(((totDep - prevTot) / prevTot) * 100)}% vs mois dernier.`,
          type: "warning",
        });
      }
    }
  }

  if (pending.length === 0) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("title, type")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

  const existingKeys = new Set((existing ?? []).map((n: { title: string; type: string }) => `${n.type}:${n.title}`));

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
        data: { url: "/dashboard" },
      } as NotificationOptions);
    } catch { /* not critical */ }
  }

  return true;
}
