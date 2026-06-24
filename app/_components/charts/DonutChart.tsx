"use client";

import { useCurrency } from "@/lib/currency/provider";

interface DonutChartProps {
  value: number;
  total: number;
  label?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({ value, total, label, color = "text-primary", size = 140, strokeWidth = 2.5 }: DonutChartProps) {
  const { formatAmount } = useCurrency();
  const pct = Math.min(100, Math.max(0, total > 0 ? (value / total) * 100 : 0));
  const path = "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831";

  function shortAmount(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
    return formatAmount(n);
  }

  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="w-full h-full">
          <path d={path} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-outline-variant/30" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={`${pct}, 100`} strokeLinecap="round" className={`${color} transition-all duration-700 ease-out`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" suppressHydrationWarning>
          <span className="text-base font-bold text-on-surface tabular-nums tracking-tight" suppressHydrationWarning>
            {shortAmount(value)}
          </span>
          {label && <span className="text-[9px] text-on-surface-variant mt-0.5">{label}</span>}
        </div>
      </div>
    </div>
  );
}
