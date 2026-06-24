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
    <div className="bg-surface-container rounded-[20px] p-5">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>
      <p className="text-sm text-on-surface-variant mt-3">{label}</p>
      <p className="text-xl font-bold text-on-surface mt-1">{value}</p>
    </div>
  );
}
