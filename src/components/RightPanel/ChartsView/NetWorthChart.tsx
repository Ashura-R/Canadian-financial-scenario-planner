import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort, formatPct, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props { years: ComputedYear[]; realMode?: boolean; diffMode?: boolean }

const ACCOUNTS = [
  { key: 'RRSP',    color: '#2563eb' },
  { key: 'TFSA',    color: '#059669' },
  { key: 'FHSA',    color: '#0891b2' },
  { key: 'Non-Reg', color: '#d97706' },
  { key: 'Savings', color: '#0284c7' },
] as const;

function NetWorthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-app-surface border border-app-border rounded-lg shadow-sm p-3 text-xs min-w-[160px]">
      <div className="font-semibold text-app-text2 mb-2 pb-1.5 border-b border-app-border">{label}</div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-app-text3">{p.dataKey}</span>
          </div>
          <span className="font-medium text-app-text tabular-nums">{formatShort(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-app-border">
        <span className="font-semibold text-app-text2">Total</span>
        <span className="font-bold text-app-text tabular-nums">{formatShort(total)}</span>
      </div>
    </div>
  );
}

function DiffTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const nominal = payload.find((p: any) => p.dataKey === 'Nominal NW')?.value ?? 0;
  const real = payload.find((p: any) => p.dataKey === 'Real NW')?.value ?? 0;
  const erosion = nominal > 0 ? (nominal - real) / nominal : 0;
  return (
    <div className="bg-app-surface border border-app-border rounded-lg shadow-sm p-3 text-xs min-w-[180px]">
      <div className="font-semibold text-app-text2 mb-2 pb-1.5 border-b border-app-border">{label}</div>
      <div className="flex items-center justify-between gap-3 py-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-app-text3" />
          <span className="text-app-text3">Nominal NW</span>
        </div>
        <span className="font-medium text-app-text tabular-nums">{formatShort(nominal)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 py-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-app-accent">Real NW</span>
        </div>
        <span className="font-medium text-app-accent tabular-nums">{formatShort(real)}</span>
      </div>
      {erosion > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-app-border">
          <span className="text-orange-600">Inflation Erosion</span>
          <span className="font-semibold text-orange-600 tabular-nums">-{formatPct(erosion)}</span>
        </div>
      )}
    </div>
  );
}

export function NetWorthChart({ years, realMode, diffMode }: Props) {
  const cc = useChartColors();

  if (diffMode) {
    const data = years.map(y => ({
      year: y.year,
      'Nominal NW': Math.round(safe(y.accounts.netWorth)),
      'Real NW': Math.round(safe(y.realNetWorth)),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
          <XAxis dataKey="year" tick={cc.axisTick} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
          <Tooltip content={<DiffTooltip />} />
          <Legend wrapperStyle={cc.legendStyle} />
          <Area
            type="monotone"
            dataKey="Nominal NW"
            stroke="#64748b"
            fill="#64748b"
            fillOpacity={0.25}
          />
          <Area
            type="monotone"
            dataKey="Real NW"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map(y => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      RRSP: Math.round(safe(y.accounts.rrspEOY / f)),
      TFSA: Math.round(safe(y.accounts.tfsaEOY / f)),
      FHSA: Math.round(safe(y.accounts.fhsaEOY / f)),
      'Non-Reg': Math.round(safe(y.accounts.nonRegEOY / f)),
      Savings: Math.round(safe(y.accounts.savingsEOY / f)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
        <XAxis dataKey="year" tick={cc.axisTick} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
        <Tooltip content={<NetWorthTooltip />} />
        <Legend wrapperStyle={cc.legendStyle} />
        {ACCOUNTS.map(a => (
          <Area
            key={a.key}
            type="monotone"
            dataKey={a.key}
            stackId="1"
            stroke={a.color}
            fill={a.color}
            fillOpacity={0.5}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
