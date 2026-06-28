"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

const navItems = [
  { href: "/dashboard", icon: "home", labelKey: "home" as const },
  { href: "/revenus", icon: "account_balance_wallet", labelKey: "income" as const },
  { href: "/depenses", icon: "receipt_long", labelKey: "expenses" as const },
  { href: "/objectifs", icon: "savings", labelKey: "savings" as const },
  { href: "/synthese", icon: "assessment", labelKey: "summary" as const },
];

const settingsItem = { href: "/profil", icon: "settings", labelKey: "settings" as const };

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("role").eq("id", user.id).single()
      .then(({ data }) => { if (data?.role === "admin") setIsAdmin(true); });
  }, [user]);

  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[264px] flex-col bg-surface-container-lowest z-40 p-6 border-r border-outline-variant/20">
      {/* App logo */}
      <div className="mb-8 pb-6 border-b border-outline-variant/20">
        <h1 className="text-primary font-bold text-lg">Mon Budget</h1>
        <h2 className="text-primary font-bold text-lg">Familial</h2>
        <p className="text-on-surface-variant text-xs mt-1">Family Finance</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
              isActive(item.href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{t.nav[item.labelKey]}</span>
          </Link>
        ))}
      </nav>

      {/* Admin link */}
      {isAdmin && (
        <Link
          href="/admin"
          className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
            isActive("/admin")
              ? "bg-primary/10 text-primary font-medium"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined">admin_panel_settings</span>
          <span>Administration</span>
        </Link>
      )}

      {/* Bottom: Settings */}
      <Link
        href={settingsItem.href}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
          isActive(settingsItem.href)
            ? "bg-primary/10 text-primary font-medium"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
      >
        <span className="material-symbols-outlined">{settingsItem.icon}</span>
        <span>{t.nav[settingsItem.labelKey]}</span>
      </Link>
    </aside>
  );
}
