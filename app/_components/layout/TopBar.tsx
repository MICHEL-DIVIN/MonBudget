"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useOffline } from "@/lib/offline/provider";
import { useAuth } from "@/lib/auth/provider";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { useOfflineData } from "@/lib/offline/hooks";
import { filterByMonth, totalDepenses, totalRevenus } from "@/lib/utils/calculations";
import { areBudgetAlertsEnabled, areNotificationsEnabled } from "@/lib/notifications/prefs";
import NotificationPanel from "./NotificationPanel";
import type { Revenu, Depense, Envelope, Objectif } from "@/lib/supabase/types";

export default function TopBar() {
  const { isOnline } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [showNotifs, setShowNotifs] = useState(false);
  const [serverUnread, setServerUnread] = useState(0);

  // Données pour les alertes locales
  const { data: revenus } = useOfflineData<Revenu>("revenus");
  const { data: depenses } = useOfflineData<Depense>("depenses");
  const { data: envelopes } = useOfflineData<Envelope>("envelopes");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");

  const localAlertCount = useMemo(() => {
    if (!areNotificationsEnabled()) return 0;
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const monthRev = filterByMonth(revenus, m, y) as Revenu[];
    const monthDep = filterByMonth(depenses, m, y) as Depense[];
    const totRev = totalRevenus(monthRev);
    const totDep = totalDepenses(monthDep);
    const balance = totRev - totDep;
    let count = 0;

    if (areBudgetAlertsEnabled()) {
      if (totRev > 0 && totDep > totRev * 0.8) count++;
      for (const env of envelopes) {
        const spent = monthDep
          .filter((d) => d.envelope_id === env.id)
          .reduce((s, d) => s + Number(d.amount), 0);
        if (env.budgeted > 0 && spent > env.budgeted * 0.8) count++;
      }
    }

    for (const obj of objectifs) {
      const pct = Number(obj.target_amount) > 0
        ? (Number(obj.current_amount) / Number(obj.target_amount)) * 100
        : 0;
      if (pct >= 100) count++;
    }

    if (totRev > 0 && balance > 0 && balance / totRev >= 0.2) count++;

    return count;
  }, [revenus, depenses, envelopes, objectifs]);

  const loadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq("read", false);
    setServerUnread(count ?? 0);
  }, [user]);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [loadCount]);

  function handleToggle() {
    setShowNotifs(!showNotifs);
    if (!showNotifs) setTimeout(loadCount, 2000);
  }

  const totalUnread = serverUnread + localAlertCount;

  const Bell = ({ className }: { className: string }) => (
    <button
      onClick={handleToggle}
      className={`${className} rounded-xl hover:bg-surface-container-high flex items-center justify-center transition-colors relative`}
    >
      <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
      {totalUnread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] min-w-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}
    </button>
  );

  // Supprimer l'avertissement isOnline si non utilisé
  void isOnline;

  return (
    <>
      {/* Desktop */}
      <header className="hidden md:flex sticky top-0 z-30 items-center justify-between h-14 px-8 bg-background/90 backdrop-blur-xl border-b border-outline-variant/30">
        <span className="text-primary font-bold">MonBudget</span>
        <div className="flex items-center gap-2">
          <Link
            href="/synthese"
            className={`hidden md:flex w-9 h-9 rounded-xl hover:bg-surface-container-high items-center justify-center transition-colors ${pathname.startsWith("/synthese") ? "text-primary" : "text-on-surface-variant"}`}
            title={t.nav.summary}
          >
            <span className="material-symbols-outlined text-xl">assessment</span>
          </Link>
          <Bell className="w-9 h-9" />
        </div>
      </header>

      {/* Mobile */}
      <header className="flex md:hidden sticky top-0 z-30 items-center justify-between h-14 px-5 bg-background/90 backdrop-blur-xl">
        <span className="text-primary font-bold text-[15px]">MonBudget</span>
        <div className="flex items-center gap-2">
          <Bell className="w-10 h-10" />
        </div>
      </header>

      <NotificationPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
    </>
  );
}
