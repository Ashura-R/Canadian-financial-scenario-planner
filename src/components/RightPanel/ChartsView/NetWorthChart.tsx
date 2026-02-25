import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort } from '../../../utils/formatters';

interface Props { years: ComputedYear[]; realMode?: boolean }

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
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 text-xs min-w-[160px]">
      <div className="font-semibold text-slate-700 mb-2 pb-1.5 border-b border-slate-100">{label}</div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-600">{p.dataKey}</span>
          </div>
          <span className="font-medium text-slate-800 tabular-nums">{formatShort(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-slate-100">
        <span className="font-semibold text-slate-700">Total</span>
        <span className="font-bold text-slate-900 tabular-nums">{formatShort(total)}</span>
      </div>
    </div>
  );
}

export function NetWorthChart({ years, realMode }: Props) {
  const data = years.map(y => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      RRSP: Math.round(y.accounts.rrspEOY / f),
      TFSA: Math.round(y.accounts.tfsaEOY / f),
      FHSA: Math.round(y.accounts.fhsaEOY / f),
      'Non-Reg': Math.round(y.accounts.nonRegEOY / f),
      Savings: Math.round(y.accounts.savingsEOY / f),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tickFormatter={v => formatShort(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip content={<NetWorthTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
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
