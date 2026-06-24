"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";
import { useCurrency } from "@/lib/currency/provider";
import { useToast } from "@/app/_components/ui/Toast";
import type { Profile, Revenu, Depense, Envelope, Objectif, AppNotification } from "@/lib/supabase/types";

type Tab = "overview" | "users" | "transactions" | "activity" | "notifications" | "support";

interface UserFull extends Profile {
  revenus_count: number;
  depenses_count: number;
  envelopes_count: number;
  total_revenus: number;
  total_depenses: number;
  balance: number;
  last_activity: string | null;
}

interface TransactionRow {
  id: string;
  type: "revenu" | "depense";
  label: string;
  amount: number;
  date: string;
  user_id: string;
  user_name: string;
  category: string;
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-surface-container rounded-2xl p-4 md:p-5 border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-white text-base">{icon}</span>
        </div>
        <span className="text-xs text-on-surface-variant">{label}</span>
      </div>
      <p className="text-xl font-bold text-on-surface">{value}</p>
      {sub && <p className="text-[11px] text-on-surface-variant mt-1">{sub}</p>}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
        active ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allRevenus, setAllRevenus] = useState<Revenu[]>([]);
  const [allDepenses, setAllDepenses] = useState<Depense[]>([]);
  const [allEnvelopes, setAllEnvelopes] = useState<Envelope[]>([]);
  const [allObjectifs, setAllObjectifs] = useState<Objectif[]>([]);

  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "revenu" | "depense">("all");
  const [txSearch, setTxSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState<{ id: string; actor_id: string; action: string; target_id: string | null; details: Record<string, string>; created_at: string }[]>([]);
  const [sentNotifs, setSentNotifs] = useState<AppNotification[]>([]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifType, setNotifType] = useState<"info" | "warning" | "success" | "promo">("info");
  const [notifTarget, setNotifTarget] = useState<"all" | string>("all");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [supportMessages, setSupportMessages] = useState<{ id: string; user_id: string | null; user_email: string | null; message: string; status: string; admin_reply: string | null; created_at: string }[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const checkAdmin = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    setIsAdmin(data?.role === "admin");
  }, [user]);

  const loadAll = useCallback(async () => {
    const [p, r, d, e, o] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("revenus").select("*").order("date", { ascending: false }).limit(2000),
      supabase.from("depenses").select("*").order("date", { ascending: false }).limit(2000),
      supabase.from("envelopes").select("*").limit(1000),
      supabase.from("objectifs").select("*").limit(1000),
    ]);
    setAllProfiles(p.data ?? []);
    setAllRevenus(r.data ?? []);
    setAllDepenses(d.data ?? []);
    setAllEnvelopes(e.data ?? []);
    setAllObjectifs(o.data ?? []);
    try {
      const { data: logs } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50);
      setAuditLogs(logs ?? []);
    } catch { /* table might not exist yet */ }
    try {
      const { data: notifs } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      setSentNotifs(notifs ?? []);
    } catch { /* table might not exist yet */ }
    try {
      const { data: msgs } = await supabase.from("support_messages").select("*").order("created_at", { ascending: false }).limit(50);
      setSupportMessages(msgs ?? []);
    } catch { /* table might not exist yet */ }
    setLoading(false);
  }, []);

  useEffect(() => { checkAdmin(); }, [checkAdmin]);
  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  // === Derived data ===
  const usersWithStats: UserFull[] = allProfiles.map((p) => {
    const uRev = allRevenus.filter((r) => r.user_id === p.id);
    const uDep = allDepenses.filter((d) => d.user_id === p.id);
    const uEnv = allEnvelopes.filter((e) => e.user_id === p.id);
    const totalR = uRev.reduce((s, r) => s + Number(r.amount), 0);
    const totalD = uDep.reduce((s, d) => s + Number(d.amount), 0);
    const allDates = [...uRev.map((r) => r.date), ...uDep.map((d) => d.date)].sort().reverse();
    return {
      ...p,
      role: p.role || "user",
      revenus_count: uRev.length,
      depenses_count: uDep.length,
      envelopes_count: uEnv.length,
      total_revenus: totalR,
      total_depenses: totalD,
      balance: totalR - totalD,
      last_activity: allDates[0] ?? null,
    };
  });

  const transactions: TransactionRow[] = [
    ...allRevenus.map((r) => ({
      id: r.id, type: "revenu" as const, label: r.label, amount: Number(r.amount),
      date: r.date, user_id: r.user_id, category: r.category,
      user_name: allProfiles.find((p) => p.id === r.user_id)?.full_name || "—",
    })),
    ...allDepenses.map((d) => ({
      id: d.id, type: "depense" as const, label: d.label, amount: Number(d.amount),
      date: d.date, user_id: d.user_id, category: d.category,
      user_name: allProfiles.find((p) => p.id === d.user_id)?.full_name || "—",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const revThisMonth = allRevenus.filter((r) => r.date.startsWith(thisMonth)).reduce((s, r) => s + Number(r.amount), 0);
  const depThisMonth = allDepenses.filter((d) => d.date.startsWith(thisMonth)).reduce((s, d) => s + Number(d.amount), 0);
  const activeUsers = new Set([...allRevenus.map((r) => r.user_id), ...allDepenses.map((d) => d.user_id)]).size;
  const newUsers30d = allProfiles.filter((p) => new Date(p.created_at) > new Date(Date.now() - 30 * 86400000)).length;

  // === Actions ===
  async function toggleRole(p: UserFull) {
    if (p.id === user?.id) { toast("Impossible de modifier votre propre rôle", "error"); return; }
    const newRole = p.role === "admin" ? "user" : "admin";
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", p.id);
    if (error) toast("Erreur : " + error.message, "error");
    else { toast(`${p.full_name} → ${newRole}`, "success"); loadAll(); }
  }

  async function deleteUser(p: UserFull) {
    if (p.id === user?.id) { toast("Impossible de supprimer votre propre compte", "error"); return; }
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) toast("Erreur : " + error.message, "error");
    else { toast(`${p.full_name} supprimé`, "success"); setExpandedUser(null); loadAll(); }
  }

  async function sendNotification() {
    if (!notifTitle || !notifBody) { toast("Remplissez le titre et le message", "error"); return; }
    setSendingNotif(true);
    if (notifTarget === "all") {
      const { error } = await supabase.from("notifications").insert({
        user_id: null,
        title: notifTitle,
        body: notifBody,
        type: notifType,
        created_by: user?.id,
      });
      if (error) toast("Erreur : " + error.message, "error");
      else toast("Notification envoyée à tous les utilisateurs", "success");
    } else {
      const { error } = await supabase.from("notifications").insert({
        user_id: notifTarget,
        title: notifTitle,
        body: notifBody,
        type: notifType,
        created_by: user?.id,
      });
      if (error) toast("Erreur : " + error.message, "error");
      else {
        const targetName = allProfiles.find((p) => p.id === notifTarget)?.full_name || "Utilisateur";
        toast(`Notification envoyée à ${targetName}`, "success");
      }
    }
    setNotifTitle("");
    setNotifBody("");
    setSendingNotif(false);
    loadAll();
  }

  async function replySupportMessage(id: string) {
    if (!replyText.trim()) return;
    const msg = supportMessages.find((m) => m.id === id);
    await supabase.from("support_messages").update({ admin_reply: replyText.trim(), status: "resolved" }).eq("id", id);
    if (msg?.user_id) {
      await supabase.from("notifications").insert({
        user_id: msg.user_id,
        title: "Réponse du support",
        body: replyText.trim(),
        type: "info",
        created_by: user?.id,
      });
    }
    toast("Réponse envoyée", "success");
    setReplyText("");
    setReplyingTo(null);
    loadAll();
  }

  async function markSupportRead(id: string) {
    await supabase.from("support_messages").update({ status: "read" }).eq("id", id);
    setSupportMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: "read" } : m));
  }

  async function deleteNotif(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setSentNotifs((prev) => prev.filter((n) => n.id !== id));
    toast("Notification supprimée", "info");
  }

  // === Guards ===
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-error/15 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-3xl">block</span>
        </div>
        <h1 className="text-xl font-bold text-on-surface">Accès refusé</h1>
        <p className="text-on-surface-variant text-sm text-center">Vous n&apos;avez pas les droits administrateur.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-2 px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm">
          Retour au dashboard
        </button>
      </div>
    );
  }

  if (isAdmin === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-outline-variant border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // === Filters ===
  const filteredUsers = usersWithStats.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search)
  );

  const filteredTx = transactions
    .filter((t) => txFilter === "all" || t.type === txFilter)
    .filter((t) => t.label.toLowerCase().includes(txSearch.toLowerCase()) || t.user_name.toLowerCase().includes(txSearch.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Administration</h1>
          <p className="text-xs text-on-surface-variant">Panel de gestion</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        <TabButton active={tab === "overview"} icon="dashboard" label="Vue d'ensemble" onClick={() => setTab("overview")} />
        <TabButton active={tab === "users"} icon="group" label="Utilisateurs" onClick={() => setTab("users")} />
        <TabButton active={tab === "transactions"} icon="receipt_long" label="Transactions" onClick={() => setTab("transactions")} />
        <TabButton active={tab === "activity"} icon="timeline" label="Activité" onClick={() => setTab("activity")} />
        <TabButton active={tab === "notifications"} icon="campaign" label="Notifications" onClick={() => setTab("notifications")} />
        <TabButton active={tab === "support"} icon="support_agent" label="Support" onClick={() => setTab("support")} />
      </div>

      {/* ──────── TAB: Overview ──────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon="group" label="Utilisateurs" value={String(allProfiles.length)} sub={`${newUsers30d} nouveaux ce mois`} color="bg-primary" />
            <StatCard icon="person" label="Actifs" value={String(activeUsers)} sub={`${allProfiles.length > 0 ? Math.round((activeUsers / allProfiles.length) * 100) : 0}% du total`} color="bg-secondary" />
            <StatCard icon="trending_up" label="Revenus (mois)" value={formatAmount(revThisMonth)} sub={`${allRevenus.filter((r) => r.date.startsWith(thisMonth)).length} transactions`} color="bg-success" />
            <StatCard icon="trending_down" label="Dépenses (mois)" value={formatAmount(depThisMonth)} sub={`${allDepenses.filter((d) => d.date.startsWith(thisMonth)).length} transactions`} color="bg-error" />
          </div>

          {/* Totaux globaux */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Totaux globaux</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-on-surface-variant">Revenus</p>
                <p className="text-lg font-bold text-success">{formatAmount(allRevenus.reduce((s, r) => s + Number(r.amount), 0))}</p>
                <p className="text-[11px] text-on-surface-variant">{allRevenus.length} entrées</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Dépenses</p>
                <p className="text-lg font-bold text-error">{formatAmount(allDepenses.reduce((s, d) => s + Number(d.amount), 0))}</p>
                <p className="text-[11px] text-on-surface-variant">{allDepenses.length} entrées</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Enveloppes</p>
                <p className="text-lg font-bold text-on-surface">{allEnvelopes.length}</p>
                <p className="text-[11px] text-on-surface-variant">{formatAmount(allEnvelopes.reduce((s, e) => s + Number(e.budgeted), 0))} budgétés</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Objectifs</p>
                <p className="text-lg font-bold text-on-surface">{allObjectifs.length}</p>
                <p className="text-[11px] text-on-surface-variant">{formatAmount(allObjectifs.reduce((s, o) => s + Number(o.current_amount), 0))} épargnés</p>
              </div>
            </div>
          </div>

          {/* Top 5 utilisateurs */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface mb-3">Top 5 utilisateurs par volume</h3>
            <div className="space-y-2">
              {usersWithStats.sort((a, b) => (b.revenus_count + b.depenses_count) - (a.revenus_count + a.depenses_count)).slice(0, 5).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 py-2">
                  <span className="text-xs font-bold text-on-surface-variant w-5">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-sm">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{u.full_name || "Sans nom"}</p>
                    <p className="text-[11px] text-on-surface-variant">{u.revenus_count + u.depenses_count} transactions</p>
                  </div>
                  <span className={`text-sm font-semibold ${u.balance >= 0 ? "text-success" : "text-error"}`}>
                    {formatAmount(u.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──────── TAB: Users ──────── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm text-on-surface outline-none focus:border-primary"
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-on-surface-variant whitespace-nowrap">{filteredUsers.length} utilisateur(s)</span>
          </div>

          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden transition-colors hover:border-primary/20"
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-lg">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-on-surface text-sm truncate">{u.full_name || "Sans nom"}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                        u.role === "admin" ? "bg-primary/20 text-primary" : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")} · {u.currency}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${u.balance >= 0 ? "text-success" : "text-error"}`}>
                      {formatAmount(u.balance)}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {u.revenus_count + u.depenses_count} tx
                    </p>
                  </div>
                  <span className={`material-symbols-outlined text-on-surface-variant text-lg transition-transform ${expandedUser === u.id ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </div>

                {expandedUser === u.id && (
                  <div className="px-4 pb-4 border-t border-outline-variant/10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4 text-sm">
                      <div className="bg-surface-container-high rounded-lg p-3">
                        <p className="text-[11px] text-on-surface-variant mb-1">Revenus</p>
                        <p className="font-semibold text-success">{formatAmount(u.total_revenus)}</p>
                        <p className="text-[10px] text-on-surface-variant">{u.revenus_count} entrées</p>
                      </div>
                      <div className="bg-surface-container-high rounded-lg p-3">
                        <p className="text-[11px] text-on-surface-variant mb-1">Dépenses</p>
                        <p className="font-semibold text-error">{formatAmount(u.total_depenses)}</p>
                        <p className="text-[10px] text-on-surface-variant">{u.depenses_count} entrées</p>
                      </div>
                      <div className="bg-surface-container-high rounded-lg p-3">
                        <p className="text-[11px] text-on-surface-variant mb-1">Enveloppes</p>
                        <p className="font-semibold text-on-surface">{u.envelopes_count}</p>
                      </div>
                      <div className="bg-surface-container-high rounded-lg p-3">
                        <p className="text-[11px] text-on-surface-variant mb-1">Dernière activité</p>
                        <p className="font-semibold text-on-surface text-xs">
                          {u.last_activity ? new Date(u.last_activity).toLocaleDateString("fr-FR") : "Aucune"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleRole(u)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">
                          {u.role === "admin" ? "person_remove" : "shield_person"}
                        </span>
                        {u.role === "admin" ? "Rétrograder" : "Promouvoir admin"}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Supprimer ${u.full_name} et toutes ses données ?`)) deleteUser(u); }}
                        className="px-4 py-2.5 rounded-xl bg-error/10 text-error text-sm font-medium hover:bg-error/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-on-surface-variant text-sm">
                Aucun utilisateur trouvé
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────── TAB: Transactions ──────── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm text-on-surface outline-none focus:border-primary"
                placeholder="Rechercher par libellé ou utilisateur..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["all", "revenu", "depense"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    txFilter === f ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {f === "all" ? "Tout" : f === "revenu" ? "Revenus" : "Dépenses"}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-on-surface-variant">{filteredTx.length} transaction(s)</p>

          <div className="space-y-1">
            {filteredTx.slice(0, 100).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3 px-3 bg-surface-container rounded-xl border border-outline-variant/5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  t.type === "revenu" ? "bg-success/15" : "bg-error/15"
                }`}>
                  <span className={`material-symbols-outlined text-sm ${t.type === "revenu" ? "text-success" : "text-error"}`}>
                    {t.type === "revenu" ? "arrow_downward" : "arrow_upward"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{t.label}</p>
                  <p className="text-[11px] text-on-surface-variant">{t.user_name} · {t.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${t.type === "revenu" ? "text-success" : "text-error"}`}>
                    {t.type === "revenu" ? "+" : "-"}{formatAmount(t.amount)}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            ))}

            {filteredTx.length === 0 && (
              <div className="text-center py-12 text-on-surface-variant text-sm">
                Aucune transaction trouvée
              </div>
            )}

            {filteredTx.length > 100 && (
              <p className="text-center text-xs text-on-surface-variant py-4">
                Affichage limité aux 100 dernières transactions
              </p>
            )}
          </div>
        </div>
      )}

      {/* ──────── TAB: Activity ──────── */}
      {tab === "activity" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-on-surface">Activité récente</h2>

          {/* Audit Log */}
          {auditLogs.length > 0 && (
            <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                Journal d&apos;audit
              </h3>
              <div className="space-y-3">
                {auditLogs.map((log) => {
                  const actorName = allProfiles.find((p) => p.id === log.actor_id)?.full_name || "Inconnu";
                  const icon = log.action === "role_change" ? "shield_person" : "history";
                  const color = log.action === "role_change" ? "text-warning" : "text-on-surface-variant";
                  const bgColor = log.action === "role_change" ? "bg-warning/15" : "bg-surface-container-high";
                  return (
                    <div key={log.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
                        <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface">
                          <strong>{actorName}</strong>
                          {log.action === "role_change" && log.details && (
                            <> a changé le rôle de <strong>{log.details.target_name}</strong> : {log.details.old_role} → {log.details.new_role}</>
                          )}
                        </p>
                      </div>
                      <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inscriptions récentes */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Dernières inscriptions
            </h3>
            <div className="space-y-3">
              {allProfiles.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-sm">person_add</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{p.full_name || "Sans nom"}</p>
                    <p className="text-[11px] text-on-surface-variant">{p.currency} · {(p as Profile).role || "user"}</p>
                  </div>
                  <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dernières transactions */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Dernières transactions
            </h3>
            <div className="space-y-3">
              {transactions.slice(0, 15).map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    t.type === "revenu" ? "bg-success/15" : "bg-error/15"
                  }`}>
                    <span className={`material-symbols-outlined text-sm ${t.type === "revenu" ? "text-success" : "text-error"}`}>
                      {t.type === "revenu" ? "add" : "remove"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{t.label}</p>
                    <p className="text-[11px] text-on-surface-variant">{t.user_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${t.type === "revenu" ? "text-success" : "text-error"}`}>
                      {t.type === "revenu" ? "+" : "-"}{formatAmount(t.amount)}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">Aucune transaction</p>
              )}
            </div>
          </div>

          {/* Résumé par utilisateur */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Résumé par utilisateur
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-on-surface-variant uppercase">
                    <th className="pb-2 font-medium">Utilisateur</th>
                    <th className="pb-2 font-medium text-right">Revenus</th>
                    <th className="pb-2 font-medium text-right">Dépenses</th>
                    <th className="pb-2 font-medium text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithStats.map((u) => (
                    <tr key={u.id} className="border-t border-outline-variant/10">
                      <td className="py-2.5">
                        <span className="text-on-surface truncate block max-w-[140px]">{u.full_name || "Sans nom"}</span>
                      </td>
                      <td className="py-2.5 text-right text-success font-medium">{formatAmount(u.total_revenus)}</td>
                      <td className="py-2.5 text-right text-error font-medium">{formatAmount(u.total_depenses)}</td>
                      <td className={`py-2.5 text-right font-semibold ${u.balance >= 0 ? "text-success" : "text-error"}`}>
                        {formatAmount(u.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────── TAB: Notifications ──────── */}
      {tab === "notifications" && (
        <div className="space-y-6">
          {/* Formulaire d'envoi */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">send</span>
              Envoyer une notification
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1">Destinataire</label>
                <select
                  value={notifTarget}
                  onChange={(e) => setNotifTarget(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm text-on-surface outline-none focus:border-primary"
                >
                  <option value="all">Tous les utilisateurs</option>
                  {allProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || "Sans nom"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1">Type</label>
                <div className="flex gap-2">
                  {(["info", "success", "warning", "promo"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNotifType(t)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        notifType === t ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {t === "info" ? "Info" : t === "success" ? "Succès" : t === "warning" ? "Alerte" : "Promo"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1">Titre</label>
                <input
                  className="w-full px-3 py-2.5 bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm text-on-surface outline-none focus:border-primary"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="Titre de la notification"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1">Message</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-surface-container-high border border-outline-variant/20 rounded-xl text-sm text-on-surface outline-none focus:border-primary resize-none"
                  rows={3}
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  placeholder="Contenu du message..."
                />
              </div>
              <button
                onClick={sendNotification}
                disabled={sendingNotif || !notifTitle || !notifBody}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">send</span>
                {sendingNotif ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>

          {/* Historique */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center justify-between">
              <span>Historique ({sentNotifs.length})</span>
            </h3>
            {sentNotifs.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6">Aucune notification envoyée</p>
            ) : (
              <div className="space-y-2">
                {sentNotifs.map((n) => {
                  const targetName = n.user_id ? (allProfiles.find((p) => p.id === n.user_id)?.full_name || "Utilisateur") : "Tous";
                  const typeIcon = n.type === "warning" ? "warning" : n.type === "success" ? "check_circle" : n.type === "promo" ? "campaign" : "info";
                  const typeColor = n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : n.type === "promo" ? "text-primary" : "text-primary";
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-high/50">
                      <span className={`material-symbols-outlined text-base mt-0.5 ${typeColor}`}>{typeIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface">{n.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{n.body}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-on-surface-variant/60">
                            → {targetName}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/60">·</span>
                          <span className="text-[10px] text-on-surface-variant/60">
                            {new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteNotif(n.id)} className="text-on-surface-variant hover:text-error transition-colors shrink-0">
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────── TAB: Support ──────── */}
      {tab === "support" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-on-surface">Messages support</h2>
            <span className="text-xs text-on-surface-variant">
              {supportMessages.filter((m) => m.status === "new").length} nouveau(x)
            </span>
          </div>

          {supportMessages.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant text-sm">Aucun message</div>
          ) : (
            <div className="space-y-3">
              {supportMessages.map((msg) => {
                const userName = msg.user_id ? (allProfiles.find((p) => p.id === msg.user_id)?.full_name || "Utilisateur") : "Anonyme";
                const statusColor = msg.status === "new" ? "bg-error" : msg.status === "read" ? "bg-warning" : "bg-success";
                const statusLabel = msg.status === "new" ? "Nouveau" : msg.status === "read" ? "Lu" : "Résolu";

                return (
                  <div key={msg.id} className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-sm">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface">{userName}</p>
                          <p className="text-[10px] text-on-surface-variant">{msg.user_email || "—"}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <p className="text-sm text-on-surface bg-surface-container-high rounded-lg p-3 leading-relaxed">{msg.message}</p>

                      <p className="text-[10px] text-on-surface-variant mt-2">
                        {new Date(msg.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>

                      {msg.admin_reply && (
                        <div className="mt-3 flex gap-2">
                          <div className="w-1 rounded-full bg-primary shrink-0" />
                          <div>
                            <p className="text-[11px] text-primary font-medium mb-1">Votre réponse</p>
                            <p className="text-sm text-on-surface-variant">{msg.admin_reply}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex border-t border-outline-variant/10">
                      {msg.status === "new" && (
                        <button onClick={() => markSupportRead(msg.id)} className="flex-1 py-2.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                          Marquer lu
                        </button>
                      )}
                      {!msg.admin_reply && (
                        <button
                          onClick={() => { setReplyingTo(replyingTo === msg.id ? null : msg.id); setReplyText(""); }}
                          className="flex-1 py-2.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          Répondre
                        </button>
                      )}
                    </div>

                    {replyingTo === msg.id && (
                      <div className="px-4 pb-4 space-y-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Votre réponse..."
                          className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary resize-none h-20"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setReplyingTo(null)} className="flex-1 py-2 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-medium">
                            Annuler
                          </button>
                          <button onClick={() => replySupportMessage(msg.id)} disabled={!replyText.trim()} className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50">
                            Envoyer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
