"use client";

import React from "react";
import { useCurrency } from "@/lib/currency/provider";

interface PieChartSegment {
  value: number;
  color: string;
  label: string;
}

interface PieChartProps {
  segments: PieChartSegment[];
  size?: number;
  className?: string;
}

export default function PieChart({
  segments,
  size = 120,
  className = "",
}: PieChartProps) {
  const { formatAmount } = useCurrency();
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const stops: string[] = [];
  let cumulative = 0;
  for (const segment of segments) {
    const startPct = cumulative;
    const pct = total > 0 ? (segment.value / total) * 100 : 0;
    cumulative += pct;
    stops.push(`${segment.color} ${startPct}% ${cumulative}%`);
  }
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className={`flex flex-col items-center gap-3 md:flex-row md:gap-6 ${className}`}>
      <div
        className="rounded-full shrink-0"
        style={{ width: size, height: size, maxWidth: "100%", background: gradient }}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center md:flex-col md:gap-2">
        {segments.map((segment, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
            <span className="text-[12px] text-on-surface-variant">{segment.label}</span>
            <span className="text-[12px] font-semibold text-on-surface tabular-nums" suppressHydrationWarning>{formatAmount(segment.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
