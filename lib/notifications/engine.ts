"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import type { Revenu, Depense, Envelope, Objectif } from "@/lib/supabase/types";

const CHECK_KEY = "monbudget-notif-last-check";
const MIN_INTERVAL = 3600_000; // 1 heure entre chaque vérification

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
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || hasRun.current) return;
    if (revenus.length === 0 && depenses.length === 0 && objectifs.length === 0) return;

    const lastCheck = localStorage.getItem(CHECK_KEY);
    if (lastCheck && Date.now() - Number(lastCheck) < MIN_INTERVAL) return;

    hasRun.current = true;
    runChecks(user.id, revenus, depenses, envelopes, objectifs);
    localStorage.setItem(CHECK_KEY, String(Date.now()));
  }, [user, revenus, depenses, envelopes, objectifs]);
}

async function runChecks(
  userId: string,
  revenus: Revenu[],
  depenses: Depense[],
  envelopes: Envelope[],
  objectifs: Objectif[]
) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthRev = filterByMonth(revenus, month, year) as Revenu[];
  const monthDep = filterByMonth(depenses, month, year) as Depense[];
  const totRev = totalRevenus(monthRev);
  const totDep = totalDepenses(monthDep);
  const balance = totRev - totDep;

  const pending: AutoNotif[] = [];

  if (totRev > 0 && totDep > totRev) {
    const pct = Math.round((totDep / totRev) * 100);
    pending.push({
      key: `overspend-${year}-${month}`,
      title: "Dépenses excessives",
      body: `Vous avez dépensé ${pct}% de vos revenus ce mois. Vos dépenses dépassent vos revenus.`,
      type: "warning",
    });
  }

  if (totRev > 0 && totDep > totRev * 0.8 && totDep <= totRev) {
    pending.push({
      key: `high-spend-${year}-${month}`,
      title: "Budget serré",
      body: `Vous avez utilisé ${Math.round((totDep / totRev) * 100)}% de vos revenus. Attention à vos dépenses restantes.`,
      type: "warning",
    });
  }

  for (const env of envelopes) {
    const spent = monthDep.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
    if (env.budgeted > 0 && spent > env.budgeted) {
      pending.push({
        key: `env-over-${env.id}-${year}-${month}`,
        title: `Enveloppe "${env.name}" dépassée`,
        body: `Vous avez dépensé ${Math.round(spent)} sur un budget de ${Math.round(env.budgeted)}. Dépassement de ${Math.round(spent - env.budgeted)}.`,
        type: "warning",
      });
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
          body: `Votre objectif "${obj.label}" arrive dans ${daysLeft} jour(s) et n'est qu'à ${Math.round(pct)}%.`,
          type: "warning",
        });
      }
      if (daysLeft < 0 && pct < 100) {
        pending.push({
          key: `obj-expired-${obj.id}`,
          title: "Échéance dépassée",
          body: `L'échéance de "${obj.label}" est passée. Objectif à ${Math.round(pct)}%.`,
          type: "warning",
        });
      }
    }
  }

  if (totRev > 0 && balance > 0 && balance / totRev >= 0.3) {
    pending.push({
      key: `good-saver-${year}-${month}`,
      title: "Excellent mois !",
      body: `Vous épargnez ${Math.round((balance / totRev) * 100)}% de vos revenus ce mois. Bravo !`,
      type: "success",
    });
  }

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
        body: `Vos dépenses ce mois sont ${Math.round(((totDep - prevTot) / prevTot) * 100)}% plus élevées que le mois dernier.`,
        type: "warning",
      });
    }
  }

  if (pending.length === 0) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("body")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

  const existingBodies = new Set((existing ?? []).map((n: { body: string }) => n.body));

  for (const notif of pending) {
    if (existingBodies.has(notif.body)) continue;

    await supabase.from("notifications").insert({
      user_id: userId,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      created_by: null,
    });
  }
}
