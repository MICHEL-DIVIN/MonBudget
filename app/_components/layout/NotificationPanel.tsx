"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { useCurrency } from "@/lib/currency/provider";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import { areBudgetAlertsEnabled, areNotificationsEnabled } from "@/lib/notifications/prefs";
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
    if (!areNotificationsEnabled()) return items;

    const monthRev = filterByMonth(revenus, month, year) as Revenu[];
    const monthDep = filterByMonth(depenses, month, year) as Depense[];
    const totRev = totalRevenus(monthRev);
    const totDep = totalDepenses(monthDep);
    const balance = totRev - totDep;
    const budgetAlerts = areBudgetAlertsEnabled();

    if (budgetAlerts && balance < 0) {
      items.push({ id: "neg", icon: "warning", color: "text-error", bg: "bg-error/15", title: "Solde négatif", message: `Dépenses dépassent les revenus de ${formatAmount(Math.abs(balance))}`, type: "warning", read: false, fromServer: false });
    }

    if (budgetAlerts) {
    for (const env of envelopes) {
      const spent = monthDep.filter((d) => d.envelope_id === env.id).reduce((s, d) => s + Number(d.amount), 0);
      if (env.budgeted > 0 && spent > env.budgeted) {
        items.push({ id: `env-${env.id}`, icon: "account_balance_wallet", color: "text-error", bg: "bg-error/15", title: `${env.name} dépassée`, message: `${formatAmount(spent)} / ${formatAmount(env.budgeted)} (+${formatAmount(spent - env.budgeted)})`, type: "warning", read: false, fromServer: false });
      } else if (env.budgeted > 0 && spent > env.budgeted * 0.8) {
        items.push({ id: `envw-${env.id}`, icon: "account_balance_wallet", color: "text-warning", bg: "bg-warning/15", title: `${env.name} bientôt épuisée`, message: `${Math.round((spent / env.budgeted) * 100)}% utilisés`, type: "warning", read: false, fromServer: false });
      }
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

  const renderNotifs = () => (
    <>
      {allNotifs.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#22c55e" }}>check_circle</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f4" }}>Tout va bien !</p>
          <p style={{ fontSize: 12, color: "#6b6b80", marginTop: 4 }}>Aucune notification.</p>
        </div>
      ) : (
        <div style={{ paddingBottom: 8 }}>
          {serverItems.length > 0 && (
            <p style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1 }}>Messages</p>
          )}
          {serverItems.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              style={{ display: "flex", gap: 10, padding: "12px 16px", opacity: n.read ? 0.5 : 1, cursor: n.read ? "default" : "pointer" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: n.bg.includes("error") ? "rgba(239,68,68,0.15)" : n.bg.includes("success") ? "rgba(34,197,94,0.15)" : "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: n.color.includes("error") ? "#ef4444" : n.color.includes("success") ? "#22c55e" : "#8b5cf6" }}>{n.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 12, color: "#6b6b80", marginTop: 2, lineHeight: 1.4 }}>{n.message}</p>
                {n.time && <p style={{ fontSize: 10, color: "#4a4a5c", marginTop: 4 }}>{n.time}</p>}
              </div>
            </div>
          ))}
          {localAlerts.length > 0 && (
            <p style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1 }}>Alertes budget</p>
          )}
          {localAlerts.map((n) => (
            <div key={n.id} style={{ display: "flex", gap: 10, padding: "12px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: n.bg.includes("error") ? "rgba(239,68,68,0.15)" : n.bg.includes("success") ? "rgba(34,197,94,0.15)" : n.bg.includes("warning") ? "rgba(245,158,11,0.15)" : "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: n.color.includes("error") ? "#ef4444" : n.color.includes("success") ? "#22c55e" : n.color.includes("warning") ? "#f59e0b" : "#8b5cf6" }}>{n.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f4" }}>{n.title}</p>
                <p style={{ fontSize: 12, color: "#6b6b80", marginTop: 2, lineHeight: 1.4 }}>{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(42,42,54,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onClose} className="md:hidden" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#f0f0f4" }}>arrow_back</span>
        </button>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f4" }}>Notifications</h2>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
            Tout lire
          </button>
        )}
        <span style={{ fontSize: 11, color: "#6b6b80", background: "#1e1e28", padding: "2px 8px", borderRadius: 99 }}>
          {unreadCount}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)" }}
      />

      {/* Desktop: dropdown */}
      <div
        className="hidden md:block"
        style={{
          position: "fixed",
          top: 56,
          right: 24,
          width: 380,
          maxHeight: "70vh",
          zIndex: 61,
          background: "#18181f",
          borderRadius: 16,
          border: "1px solid rgba(42,42,54,0.4)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          overflowY: "auto",
        }}
      >
        {header}
        {renderNotifs()}
      </div>

      {/* Mobile: plein écran */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          background: "#0a0a0f",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {header}
        {renderNotifs()}
      </div>
    </>
  );
}
