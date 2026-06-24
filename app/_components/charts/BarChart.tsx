"use client";

import React, { useState } from "react";
import { useCurrency } from "@/lib/currency/provider";

interface BarData {
  label: string;
  values: number[];
  colors?: string[];
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = ["bg-primary/30", "bg-primary"];

export default function BarChart({
  data,
  height = 200,
  className = "",
}: BarChartProps) {
  const { formatAmount } = useCurrency();
  const [tooltip, setTooltip] = useState<{
    groupIdx: number;
    barIdx: number;
  } | null>(null);

  // Find global max value across all bars
  const maxValue = Math.max(
    ...data.flatMap((d) => d.values),
    1 // avoid division by zero
  );

  return (
    <div className={className}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((group, gi) => {
          const colors = group.colors ?? DEFAULT_COLORS;
          return (
            <div
              key={gi}
              className="flex-1 flex items-end justify-center gap-1"
              style={{ height: "100%" }}
            >
              {group.values.map((val, bi) => {
                const barHeight = maxValue > 0 ? (val / maxValue) * 100 : 0;
                const isHovered =
                  tooltip?.groupIdx === gi && tooltip?.barIdx === bi;
                return (
                  <div
                    key={bi}
                    className="relative flex items-end justify-center"
                    style={{ height: "100%", flex: 1 }}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {formatAmount(val)}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-lg transition-all cursor-pointer ${colors[bi] ?? colors[0]}`}
                      style={{
                        height: `${barHeight}%`,
                        minHeight: val > 0 ? 4 : 0,
                      }}
                      onMouseEnter={() =>
                        setTooltip({ groupIdx: gi, barIdx: bi })
                      }
                      onMouseLeave={() => setTooltip(null)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-2 mt-2">
        {data.map((group, gi) => (
          <div
            key={gi}
            className="flex-1 text-center text-xs text-on-surface-variant"
          >
            {group.label}
          </div>
        ))}
      </div>
    </div>
  );
}
