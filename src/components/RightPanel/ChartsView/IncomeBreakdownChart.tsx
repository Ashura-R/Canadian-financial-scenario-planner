import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

const PALETTE = {
  employment: '#3b82f6', selfEmploy: '#8b5cf6', eligDiv: '#10b981',
  nonEligDiv: '#14b8a6', interest: '#06b6d4', capGains: '#f59e0b', other: '#94a3b8',
};

interface Props {
  years: ComputedYear[];
  rawYears: import('../../../types/scenario').YearData[];
  diffMode?: boolean;
  modern?: boolean;
}

function ModernTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => (p.value ?? 0) !== 0);
  const total = items.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
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
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.fill || p.color }} />
            <span style={{ color: 'var(--app-text3)' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 500, color: 'var(--app-text)', fontVariantNumeric: 'tabular-nums' }}>{formatShort(p.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 6, borderTop: '1px solid var(--app-border)', fontWeight: 600 }}>
          <span style={{ color: 'var(--app-text2)' }}>Total</span>
          <span style={{ color: 'var(--app-text)', fontVariantNumeric: 'tabular-nums' }}>{formatShort(total)}</span>
        </div>
      )}
    </div>
  );
}

export function IncomeBreakdownChart({ years, rawYears, diffMode, modern }: Props) {
  const cc = useChartColors();
  const barRadius: [number, number, number, number] = modern ? [3, 3, 0, 0] : [0, 0, 0, 0];
  const TooltipComp = modern ? ModernTooltipContent : undefined;

  if (diffMode) {
    const data = years.map((y) => ({
      year: y.year,
      'Gross Income (Nom)': Math.round(safe(y.waterfall.grossIncome)),
      'Gross Income (Real)': Math.round(safe(y.realGrossIncome)),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
          <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
          {!modern && <Legend wrapperStyle={cc.legendStyle} />}
          <Bar dataKey="Gross Income (Nom)" fill="#64748b" fillOpacity={0.85} radius={barRadius} />
          <Bar dataKey="Gross Income (Real)" fill="#3b82f6" fillOpacity={0.85} radius={barRadius} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map((y, i) => ({
    year: y.year,
    Employment: Math.round(safe(rawYears[i]?.employmentIncome ?? 0)),
    'Self-Empl.': Math.round(safe(rawYears[i]?.selfEmploymentIncome ?? 0)),
    'Elig. Div.': Math.round(safe(rawYears[i]?.eligibleDividends ?? 0)),
    'Non-Elig. Div.': Math.round(safe(rawYears[i]?.nonEligibleDividends ?? 0)),
    Interest: Math.round(safe(rawYears[i]?.interestIncome ?? 0)),
    'Cap. Gains': Math.round(safe(rawYears[i]?.capitalGainsRealized ?? 0)),
    Other: Math.round(safe(rawYears[i]?.otherTaxableIncome ?? 0)),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
        {!modern && <Legend wrapperStyle={cc.legendStyle10} />}
        <Bar dataKey="Employment" stackId="a" fill={PALETTE.employment} radius={barRadius} />
        <Bar dataKey="Self-Empl." stackId="a" fill={PALETTE.selfEmploy} />
        <Bar dataKey="Elig. Div." stackId="a" fill={PALETTE.eligDiv} />
        <Bar dataKey="Non-Elig. Div." stackId="a" fill={PALETTE.nonEligDiv} />
        <Bar dataKey="Interest" stackId="a" fill={PALETTE.interest} />
        <Bar dataKey="Cap. Gains" stackId="a" fill={PALETTE.capGains} />
        <Bar dataKey="Other" stackId="a" fill={PALETTE.other} />
      </BarChart>
    </ResponsiveContainer>
  );
}
