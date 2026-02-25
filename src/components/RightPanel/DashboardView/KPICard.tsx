import React from 'react';
import { formatShort, formatPct } from '../../../utils/formatters';

interface Props {
  label: string;
  value: number;
  format?: 'cad' | 'pct';
  sub?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function KPICard({ label, value, format = 'cad', sub, color, trend }: Props) {
  const displayValue = format === 'pct' ? formatPct(value, 1) : formatShort(value);
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="flex flex-col gap-0.5 py-2">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-lg font-bold ${color ?? 'text-slate-900'}`}>{displayValue}</div>
      {sub && <div className={`text-[10px] ${trendColor}`}>{sub}</div>}
    </div>
  );
}
