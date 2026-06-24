"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { useCurrency } from "@/lib/currency/provider";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import type { Revenu, Depense, Envelope, Objectif, AppNotification } from "@/lib/supabase/types";

interface NotifItem {
  id: string;
  icon: string;
  color: string;
  bg: string;
  title: string;
  message: string;
  type: "warning" | "success" | "info" | "promo";
  read: boolean;
  fromServer: boolean;
  time?: string;
}

export default function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { data: revenus } = useOfflineData<Revenu>("revenus");
  const { data: depenses } = useOfflineData<Depense>("depenses");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");

  const [serverNotifs, setServerNotifs] = useState<AppNotification[]>([]);

  const loadServerNotifs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setServerNotifs(data);
  }, [user]);

  useEffect(() => {
    if (open) loadServerNotifs();
  }, [open, loadServerNotifs]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setServerNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    if (!user) return;
    const unread = serverNotifs.filter((n) => !n.read && n.user_id === user.id);
    for (const n of unread) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    setServerNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const localAlerts = useMemo(() => {
    const items: NotifItem[] = [];
    const monthRev = filterByMonth(revenus, month, year) as Revenu[];
    const monthDep = filterByMonth(depenses, month, year) as Depense[];
    const totRev = totalRevenus(monthRev);
    const totDep = totalDepenses(monthDep);
    const balance = totRev - totDep;

    if (balance < 0) {
      items.push({ id: "neg", icon: "warning", color: "text-error", bg: "bg-error/15", title: "Solde négatif", message: `Dépenses dépassent les revenus de ${formatAmount(Math.abs(balance))}`, type: "warning", read: false, fromServer: false });
    }

    for (const env of envelopes) {
      const spent = monthDep.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
      if (env.budgeted > 0 && spent > env.budgeted) {
        items.push({ id: `env-${env.id}`, icon: "account_balance_wallet", color: "text-error", bg: "bg-error/15", title: `${env.name} dépassée`, message: `${formatAmount(spent)} / ${formatAmount(env.budgeted)} (+${formatAmount(spent - env.budgeted)})`, type: "warning", read: false, fromServer: false });
      } else if (env.budgeted > 0 && spent > env.budgeted * 0.8) {
        items.push({ id: `envw-${env.id}`, icon: "account_balance_wallet", color: "text-warning", bg: "bg-warning/15", title: `${env.name} bientôt épuisée`, message: `${Math.round((spent / env.budgeted) * 100)}% utilisés`, type: "warning", read: false, fromServer: false });
      }
    }

    for (const obj of objectifs) {
      const pct = Number(obj.target_amount) > 0 ? (Number(obj.current_amount) / Number(obj.target_amount)) * 100 : 0;
      if (pct >= 100) {
        items.push({ id: `obj-${obj.id}`, icon: "emoji_events", color: "text-success", bg: "bg-success/15", title: "Objectif atteint !", message: `"${obj.label}"`, type: "success", read: false, fromServer: false });
      }
    }

    if (totRev > 0 && balance > 0 && balance / totRev >= 0.2) {
      items.push({ id: "good", icon: "thumb_up", color: "text-success", bg: "bg-success/15", title: "Bonne gestion", message: `${Math.round((balance / totRev) * 100)}% d'épargne ce mois`, type: "success", read: false, fromServer: false });
    }

    return items;
  }, [revenus, depenses, envelopes, objectifs, month, year, formatAmount]);

  const serverItems: NotifItem[] = serverNotifs.map((n) => ({
    id: n.id,
    icon: n.type === "warning" ? "warning" : n.type === "success" ? "check_circle" : n.type === "promo" ? "campaign" : "info",
    color: n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : n.type === "promo" ? "text-primary" : "text-primary",
    bg: n.type === "warning" ? "bg-warning/15" : n.type === "success" ? "bg-success/15" : n.type === "promo" ? "bg-primary/15" : "bg-primary/15",
    title: n.title,
    message: n.body,
    type: n.type,
    read: n.read,
    fromServer: true,
    time: new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  }));

  const allNotifs = [...serverItems, ...localAlerts];
  const unreadCount = allNotifs.filter((n) => !n.read).length;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 md:bg-transparent" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-14 md:right-8 md:left-auto z-50 md:w-[360px] max-h-[80vh] md:max-h-[75vh] bg-surface-container rounded-t-2xl md:rounded-2xl border border-outline-variant/20 shadow-elevated overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
          <h2 className="text-sm font-semibold text-on-surface">Notifications</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary font-medium hover:underline">
                Tout lire
              </button>
            )}
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[65vh]">
          {allNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-success text-xl">check_circle</span>
              </div>
              <p className="text-sm text-on-surface font-medium">Tout va bien !</p>
              <p className="text-xs text-on-surface-variant text-center mt-1">Aucune notification.</p>
            </div>
          ) : (
            <div className="py-1">
              {serverItems.length > 0 && (
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Messages</p>
              )}
              {serverItems.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer ${n.read ? "opacity-60" : "hover:bg-surface-container-high"}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className={`w-9 h-9 rounded-lg ${n.bg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-base ${n.color}`}>{n.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-on-surface truncate">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{n.message}</p>
                    {n.time && <p className="text-[10px] text-on-surface-variant/60 mt-1">{n.time}</p>}
                  </div>
                </div>
              ))}

              {localAlerts.length > 0 && (
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Alertes budget</p>
              )}
              {localAlerts.map((n) => (
                <div key={n.id} className="flex gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-lg ${n.bg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-base ${n.color}`}>{n.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{n.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
