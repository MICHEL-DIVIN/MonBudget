"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", icon: "home", label: "Accueil" },
  { href: "/revenus", icon: "account_balance_wallet", label: "Revenus" },
  { href: "/depenses", icon: "receipt_long", label: "Dépenses" },
  { href: "/objectifs", icon: "savings", label: "Épargne" },
  { href: "/profil", icon: "settings", label: "Réglages" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-container-lowest border-t border-outline-variant/20" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 w-14">
              <span
                className={`material-symbols-outlined text-[22px] transition-colors ${active ? "text-primary" : "text-on-surface-variant"}`}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className={`text-[9px] leading-none ${active ? "text-primary font-medium" : "text-on-surface-variant"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
