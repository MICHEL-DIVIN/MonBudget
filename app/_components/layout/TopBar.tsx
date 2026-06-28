"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useOffline } from "@/lib/offline/provider";
import { useAuth } from "@/lib/auth/provider";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import NotificationPanel from "./NotificationPanel";

export default function TopBar() {
  const { isOnline } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq("read", false);
    setUnreadCount(count ?? 0);
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

  const Bell = ({ className }: { className: string }) => (
    <button
      onClick={handleToggle}
      className={`${className} rounded-xl hover:bg-surface-container-high flex items-center justify-center transition-colors relative`}
    >
      <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

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
