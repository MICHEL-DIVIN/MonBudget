"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

const tabs = [
  { href: "/dashboard", icon: "home", labelKey: "home" as const },
  { href: "/revenus", icon: "account_balance_wallet", labelKey: "income" as const },
  { href: "/depenses", icon: "receipt_long", labelKey: "expenses" as const },
  { href: "/synthese", icon: "assessment", labelKey: "summary" as const },
  { href: "/objectifs", icon: "savings", labelKey: "savings" as const },
  { href: "/profil", icon: "settings", labelKey: "settings" as const },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-container-lowest border-t border-outline-variant/20" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 w-12 min-w-0 flex-1">
              <span
                className={`material-symbols-outlined text-[20px] transition-colors ${active ? "text-primary" : "text-on-surface-variant"}`}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className={`text-[8px] leading-none truncate max-w-full ${active ? "text-primary font-medium" : "text-on-surface-variant"}`}>
                {t.nav[tab.labelKey]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
