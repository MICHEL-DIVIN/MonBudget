"use client";

interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  color?: string;
  showArea?: boolean;
  className?: string;
}

export default function TrendChart({
  data,
  height = 120,
  color = "text-primary",
  showArea = true,
  className = "",
}: TrendChartProps) {
  if (data.length < 2) return null;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  const padding = 20;
  const chartWidth = 300;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
    const y = padding + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length-1].x},${height - padding} L${points[0].x},${height - padding} Z`;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = padding + chartHeight * (1 - pct);
          return <line key={pct} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} className="text-outline" />;
        })}

        {/* Area fill */}
        {showArea && (
          <path d={areaPath} fill="currentColor" fillOpacity={0.1} className={color} />
        )}

        {/* Line */}
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={color} />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="currentColor" className={color} />
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between px-5 mt-1">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-on-surface-variant">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
