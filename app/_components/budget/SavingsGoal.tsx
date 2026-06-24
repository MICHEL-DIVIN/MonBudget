"use client";

import { useCurrency } from "@/lib/currency/provider";

interface SavingsGoalProps {
  label: string;
  target: number;
  current?: number;
}

export default function SavingsGoal({ label, target, current = 0 }: SavingsGoalProps) {
  const { formatAmount } = useCurrency();
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  return (
    <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-base">savings</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">{label}</p>
          <p className="text-xs text-on-surface-variant" suppressHydrationWarning>
            {formatAmount(current)} / {formatAmount(target)}
          </p>
        </div>
        <span className={`text-sm font-bold ${pct >= 100 ? "text-success" : "text-primary"}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
