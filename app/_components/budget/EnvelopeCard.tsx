"use client";

import { useCurrency } from "@/lib/currency/provider";

interface EnvelopeCardProps {
  name: string;
  icon: string;
  amount: number;
  remaining: number;
  color: string;
  className?: string;
  onClick?: () => void;
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  "bg-env-green": { bg: "bg-env-green/15", text: "text-env-green" },
  "bg-env-pink": { bg: "bg-env-pink/15", text: "text-env-pink" },
  "bg-env-blue": { bg: "bg-env-blue/15", text: "text-env-blue" },
  "bg-env-yellow": { bg: "bg-env-yellow/15", text: "text-env-yellow" },
  "bg-env-purple": { bg: "bg-env-purple/15", text: "text-env-purple" },
  "bg-env-orange": { bg: "bg-env-orange/15", text: "text-env-orange" },
};

export default function EnvelopeCard({ name, icon, amount, remaining, color, className = "", onClick }: EnvelopeCardProps) {
  const { formatAmount } = useCurrency();
  const spent = amount - remaining;
  const pct = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
  const isOver = remaining < 0;
  const c = COLOR_MAP[color] ?? { bg: "bg-primary/15", text: "text-primary" };

  return (
    <div
      className={`bg-surface-container rounded-2xl p-4 flex flex-col items-center text-center ${onClick ? "active:scale-[0.97] cursor-pointer" : ""} transition-transform duration-150 ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <span className={`material-symbols-outlined text-xl ${c.text}`}>{icon}</span>
      </div>

      {/* Name */}
      <p className="text-[14px] font-semibold text-on-surface mb-1 truncate w-full">{name}</p>

      {/* Amount remaining */}
      <p className={`text-[12px] sm:text-[13px] font-bold tabular-nums truncate w-full ${isOver ? "text-error" : "text-on-surface"}`} suppressHydrationWarning>
        {formatAmount(remaining)}
      </p>
      <p className="text-[10px] text-on-surface-variant mt-0.5 truncate w-full">sur {formatAmount(amount)}</p>

      {/* Progress bar */}
      <div className="w-full h-1 bg-outline-variant/20 rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-error" : c.text.replace("text-", "bg-")}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
