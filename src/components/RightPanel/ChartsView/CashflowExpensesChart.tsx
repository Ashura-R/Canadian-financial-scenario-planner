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
}

const COLORS = {
  afterTax: '#059669',
  rrsp: '#2563eb',
  tfsa: '#0891b2',
  fhsa: '#8b5cf6',
  nonReg: '#d97706',
  savings: '#0284c7',
  debt: '#dc2626',
  netCF: '#f59e0b',
};

function CashflowTooltip({ active, payload, label }: any) {
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

export function CashflowExpensesChart({ years, rawYears }: Props) {
  const cc = useChartColors();

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
        <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
        <XAxis dataKey="year" tick={cc.axisTick} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
        <Tooltip content={<CashflowTooltip />} />
        <Legend wrapperStyle={cc.legendStyle10} />
        <Bar dataKey="After-Tax" fill={COLORS.afterTax} fillOpacity={0.7} />
        <Bar dataKey="RRSP" stackId="outflows" fill={COLORS.rrsp} fillOpacity={0.7} />
        <Bar dataKey="TFSA" stackId="outflows" fill={COLORS.tfsa} fillOpacity={0.7} />
        <Bar dataKey="FHSA" stackId="outflows" fill={COLORS.fhsa} fillOpacity={0.7} />
        <Bar dataKey="Non-Reg" stackId="outflows" fill={COLORS.nonReg} fillOpacity={0.7} />
        <Bar dataKey="Savings" stackId="outflows" fill={COLORS.savings} fillOpacity={0.7} />
        <Bar dataKey="Debt" stackId="outflows" fill={COLORS.debt} fillOpacity={0.7} />
        <Line type="monotone" dataKey="Net CF" stroke={COLORS.netCF} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
