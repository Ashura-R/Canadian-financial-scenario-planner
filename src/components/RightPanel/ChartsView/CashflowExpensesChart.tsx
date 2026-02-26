import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import type { YearData } from '../../../types/scenario';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props {
  years: ComputedYear[];
  rawYears: YearData[];
  modern?: boolean;
}

const COLORS = {
  afterTax: '#10b981',
  rrsp: '#3b82f6',
  tfsa: '#06b6d4',
  fhsa: '#8b5cf6',
  nonReg: '#f59e0b',
  savings: '#0284c7',
  debt: '#f43f5e',
  netCF: '#f59e0b',
};

function ModernTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => (p.value ?? 0) !== 0);
  return (
    <div style={{
      background: 'var(--app-tooltip-bg)', borderRadius: 12, padding: '12px 14px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--app-glass-border)', fontSize: 12, minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--app-text2)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--app-border)' }}>{label}</div>
      {items.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.stroke || p.fill || p.color }} />
            <span style={{ color: 'var(--app-text3)' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 500, color: 'var(--app-text)', fontVariantNumeric: 'tabular-nums' }}>{formatShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function LegacyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-app-surface border border-app-border rounded-lg shadow-sm p-3 text-xs min-w-[180px]">
      <div className="font-semibold text-app-text2 mb-2 pb-1.5 border-b border-app-border">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
            <span className="text-app-text3">{p.name}</span>
          </div>
          <span className="font-medium text-app-text tabular-nums">{formatShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function CashflowExpensesChart({ years, rawYears, modern }: Props) {
  const cc = useChartColors();
  const barRadius: [number, number, number, number] = modern ? [3, 3, 0, 0] : [0, 0, 0, 0];

  const data = years.map((y, i) => {
    const raw = rawYears[i];
    if (!raw) return { year: y.year };
    return {
      year: y.year,
      'After-Tax': Math.round(safe(y.waterfall.afterTaxIncome)),
      'RRSP': Math.round(safe(raw.rrspContribution)),
      'TFSA': Math.round(safe(raw.tfsaContribution)),
      'FHSA': Math.round(safe(raw.fhsaContribution)),
      'Non-Reg': Math.round(safe(raw.nonRegContribution)),
      'Savings': Math.round(safe(raw.savingsDeposit)),
      'Debt': Math.round(safe(y.totalDebtPayment ?? 0)),
      'Net CF': Math.round(safe(y.waterfall.netCashFlow)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <Tooltip content={modern ? <ModernTooltipContent /> : <LegacyTooltip />} />
        {!modern && <Legend wrapperStyle={{ fontSize: 10, color: 'var(--app-text3)' }} />}
        <Bar dataKey="After-Tax" fill={COLORS.afterTax} fillOpacity={0.7} radius={barRadius} />
        <Bar dataKey="RRSP" stackId="outflows" fill={COLORS.rrsp} fillOpacity={0.7} />
        <Bar dataKey="TFSA" stackId="outflows" fill={COLORS.tfsa} fillOpacity={0.7} />
        <Bar dataKey="FHSA" stackId="outflows" fill={COLORS.fhsa} fillOpacity={0.7} />
        <Bar dataKey="Non-Reg" stackId="outflows" fill={COLORS.nonReg} fillOpacity={0.7} />
        <Bar dataKey="Savings" stackId="outflows" fill={COLORS.savings} fillOpacity={0.7} />
        <Bar dataKey="Debt" stackId="outflows" fill={COLORS.debt} fillOpacity={0.7} />
        <Line type="monotone" dataKey="Net CF" stroke={COLORS.netCF} strokeWidth={modern ? 2.5 : 2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
