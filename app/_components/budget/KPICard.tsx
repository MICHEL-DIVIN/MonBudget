"use client";

import Badge from "@/app/_components/ui/Badge";

interface KPICardProps {
  icon: string;
  iconBg: string;
  label: string;
  value: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "error" | "info";
}

export default function KPICard({
  icon,
  iconBg,
  label,
  value,
  badge,
  badgeVariant = "success",
}: KPICardProps) {
  return (
    <div className="bg-surface-container rounded-[20px] p-3 md:p-5 min-w-0 overflow-hidden">
      <div className="flex items-start gap-2">
        <div
          className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-xl ${iconBg} flex items-center justify-center`}
        >
          <span className="material-symbols-outlined text-[18px] md:text-[24px]">{icon}</span>
        </div>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>
      <p className="text-[11px] md:text-sm text-on-surface-variant mt-2 md:mt-3 truncate">{label}</p>
      <p className="text-[13px] md:text-xl font-bold text-on-surface mt-0.5 md:mt-1 leading-tight break-words" suppressHydrationWarning>{value}</p>
    </div>
  );
}
