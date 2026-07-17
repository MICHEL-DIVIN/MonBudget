"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { useCurrency } from "@/lib/currency/provider";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import { areBudgetAlertsEnabled, areNotificationsEnabled } from "@/lib/notifications/prefs";
import type { Revenu, Depense, Envelope, Objectif, AppNotification } from "@/lib/supabase/types";

interface LocalAlert {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  message: string;
  link: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getNotifMeta(type: string, title: string) {
  if (type === "success") {
    if (title.toLowerCase().includes("objectif")) return { icon: "emoji_events", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    return { icon: "savings", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
  }
  if (type === "promo") return { icon: "campaign", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" };
  if (type === "warning") {
    if (title.toLowerCase().includes("enveloppe")) return { icon: "account_balance_wallet", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    if (title.toLowerCase().includes("échéance")) return { icon: "event_busy", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    if (title.toLowerCase().includes("hausse")) return { icon: "trending_up", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    if (title.toLowerCase().includes("excessif") || title.toLowerCase().includes("dépassé")) return { icon: "trending_down", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    return { icon: "warning", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  }
  // info
  if (title.toLowerCase().includes("hebdomadaire")) return { icon: "analytics", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" };
  if (title.toLowerCase().includes("objectif")) return { icon: "flag", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" };
  if (title.toLowerCase().includes("revenu")) return { icon: "currency_exchange", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" };
  return { icon: "info", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" };
}

function getActionLink(title: string, type: string): string {
  const t = title.toLowerCase();
  if (t.includes("enveloppe") || t.includes("dépassé") || t.includes("hausse") || t.includes("budget") || t.includes("mi-mois") || t.includes("mi-parcours")) return "/depenses";
  if (t.includes("revenu") && type === "info") return "/revenus";
  if (t.includes("objectif") || t.includes("échéance")) return "/objectifs";
  if (t.includes("hebdomadaire") || t.includes("excellent")) return "/synthese";
  return "/dashboard";
}

export default function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { data: revenus } = useOfflineData<Revenu>("revenus");
  const { data: depenses } = useOfflineData<Depense>("depenses");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");

  const [serverNotifs, setServerNotifs] = useState<AppNotification[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadServerNotifs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) setServerNotifs(data);
  }, [user]);

  useEffect(() => {
    if (open) loadServerNotifs();
  }, [open, loadServerNotifs]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setServerNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    if (!user) return;
    const unread = serverNotifs.filter((n) => !n.read && n.user_id === user.id);
    await Promise.all(unread.map((n) => supabase.from("notifications").update({ read: true }).eq("id", n.id)));
    setServerNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function deleteNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(id);
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) {
      setServerNotifs((prev) => prev.filter((n) => n.id !== id));
    }
    setDeleting(null);
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const localAlerts = useMemo((): LocalAlert[] => {
    const items: LocalAlert[] = [];
    if (!areNotificationsEnabled()) return items;

    const monthRev = filterByMonth(revenus, month, year) as Revenu[];
    const monthDep = filterByMonth(depenses, month, year) as Depense[];
    const totRev = totalRevenus(monthRev);
    const totDep = totalDepenses(monthDep);
    const balance = totRev - totDep;
    const budgetAlerts = areBudgetAlertsEnabled();

    if (budgetAlerts && totRev > 0 && totDep > totRev) {
      const pct = Math.round((totDep / totRev) * 100);
      items.push({
        id: "neg-bal",
        icon: "trending_down",
        iconColor: "#ef4444",
        iconBg: "rgba(239,68,68,0.15)",
        title: "Solde négatif",
        message: `${pct}% des revenus dépensés — dépassement de ${formatAmount(Math.abs(balance))}`,
        link: "/depenses",
      });
    } else if (budgetAlerts && totRev > 0 && totDep > totRev * 0.8) {
      const pct = Math.round((totDep / totRev) * 100);
      items.push({
        id: "high-spend",
        icon: "account_balance",
        iconColor: "#f59e0b",
        iconBg: "rgba(245,158,11,0.15)",
        title: "Budget serré",
        message: `${pct}% utilisés — il reste ${formatAmount(totRev - totDep)}`,
        link: "/depenses",
      });
    }

    if (budgetAlerts) {
      for (const env of envelopes) {
        const spent = monthDep
          .filter((d) => d.envelope_id === env.id)
          .reduce((s, d) => s + Number(d.amount), 0);
        if (env.budgeted > 0 && spent > env.budgeted) {
          items.push({
            id: `env-over-${env.id}`,
            icon: "account_balance_wallet",
            iconColor: "#ef4444",
            iconBg: "rgba(239,68,68,0.15)",
            title: `"${env.name}" dépassée`,
            message: `${formatAmount(spent)} / ${formatAmount(env.budgeted)} (+${formatAmount(spent - env.budgeted)})`,
            link: "/depenses",
          });
        } else if (env.budgeted > 0 && spent > env.budgeted * 0.8) {
          const pct = Math.round((spent / env.budgeted) * 100);
          items.push({
            id: `env-warn-${env.id}`,
            icon: "account_balance_wallet",
            iconColor: "#f59e0b",
            iconBg: "rgba(245,158,11,0.15)",
            title: `"${env.name}" bientôt épuisée`,
            message: `${pct}% utilisés — reste ${formatAmount(env.budgeted - spent)}`,
            link: "/depenses",
          });
        }
      }
    }

    for (const obj of objectifs) {
      const pct = Number(obj.target_amount) > 0
        ? (Number(obj.current_amount) / Number(obj.target_amount)) * 100
        : 0;
      if (pct >= 100) {
        items.push({
          id: `obj-done-${obj.id}`,
          icon: "emoji_events",
          iconColor: "#22c55e",
          iconBg: "rgba(34,197,94,0.15)",
          title: "Objectif atteint !",
          message: `"${obj.label}" — ${formatAmount(Number(obj.target_amount))}`,
          link: "/objectifs",
        });
      }
    }

    if (totRev > 0 && balance > 0 && balance / totRev >= 0.2) {
      const pct = Math.round((balance / totRev) * 100);
      items.push({
        id: "good-saver",
        icon: "savings",
        iconColor: "#22c55e",
        iconBg: "rgba(34,197,94,0.15)",
        title: "Bonne gestion",
        message: `${pct}% d'épargne ce mois — ${formatAmount(balance)}`,
        link: "/synthese",
      });
    }

    return items;
  }, [revenus, depenses, envelopes, objectifs, month, year, formatAmount]);

  const unreadServer = serverNotifs.filter((n) => !n.read).length;
  const totalUnread = unreadServer + localAlerts.length;

  if (!open) return null;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <h2 className="text-[15px] font-semibold text-on-surface">Notifications</h2>
          {totalUnread > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary min-w-[18px] text-center">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadServer > 0 && (
            <button
              onClick={markAllRead}
              className="text-[12px] text-primary font-medium px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
            >
              Tout lire
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {localAlerts.length === 0 && serverNotifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-success" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <p className="text-[15px] font-semibold text-on-surface">Tout va bien !</p>
            <p className="text-[13px] text-on-surface-variant mt-1 text-center">Aucune alerte ni notification pour le moment.</p>
          </div>
        ) : (
          <>
            {/* Alertes en direct */}
            {localAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Alertes en direct</p>
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                </div>
                <div className="space-y-1 px-2 pb-2">
                  {localAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={alert.link}
                      onClick={onClose}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: alert.iconBg }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 18, color: alert.iconColor, fontVariationSettings: "'FILL' 1" }}
                        >
                          {alert.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface leading-tight">{alert.title}</p>
                        <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">{alert.message}</p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-[16px] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0">
                        chevron_right
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Séparateur */}
            {localAlerts.length > 0 && serverNotifs.length > 0 && (
              <div className="mx-4 border-t border-white/[0.06]" />
            )}

            {/* Messages serveur */}
            {serverNotifs.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 pt-4 pb-2">
                  Messages
                </p>
                <div className="space-y-1 px-2 pb-4">
                  {serverNotifs.map((n) => {
                    const meta = getNotifMeta(n.type, n.title);
                    const actionLink = getActionLink(n.title, n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => !n.read && markRead(n.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors group relative ${!n.read ? "bg-white/[0.04] hover:bg-white/[0.07] cursor-pointer" : "opacity-60 hover:opacity-80 hover:bg-white/[0.03]"}`}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: meta.bg }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 18, color: meta.color, fontVariationSettings: "'FILL' 1" }}
                          >
                            {meta.icon}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold text-on-surface leading-tight truncate">{n.title}</p>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <p className="text-[10px] text-on-surface-variant/60">{relativeTime(n.created_at)}</p>
                            <Link
                              href={actionLink}
                              onClick={(e) => { e.stopPropagation(); onClose(); }}
                              className="text-[10px] text-primary font-medium hover:underline"
                            >
                              Voir →
                            </Link>
                          </div>
                        </div>

                        {/* Bouton supprimer */}
                        <button
                          onClick={(e) => deleteNotif(n.id, e)}
                          disabled={deleting === n.id}
                          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-error/20 transition-all"
                          title="Supprimer"
                        >
                          {deleting === n.id ? (
                            <span className="w-3 h-3 border border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>close</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm"
      />

      {/* Desktop dropdown */}
      <div
        className="hidden md:flex flex-col fixed z-[61] rounded-2xl overflow-hidden"
        style={{
          top: 60,
          right: 24,
          width: 380,
          maxHeight: "calc(100vh - 80px)",
          background: "#18181f",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {content}
      </div>

      {/* Mobile plein écran */}
      <div
        className="md:hidden flex flex-col fixed z-[61] overflow-hidden"
        style={{
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#0a0a0f",
        }}
      >
        {content}
      </div>
    </>
  );
}
