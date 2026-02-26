import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

const PALETTE = {
  federal: '#f43f5e', provincial: '#fb923c', cpp: '#fbbf24', ei: '#a3e635', afterTax: '#10b981',
};

interface Props { years: ComputedYear[]; realMode?: boolean; diffMode?: boolean; modern?: boolean }

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

export function TaxWaterfallChart({ years, realMode, diffMode, modern }: Props) {
  const cc = useChartColors();
  const barRadius: [number, number, number, number] = modern ? [3, 3, 0, 0] : [0, 0, 0, 0];
  const TooltipComp = modern ? ModernTooltipContent : undefined;

  if (diffMode) {
    const data = years.map(y => ({
      year: y.year,
      'Total Tax (Nom)': Math.round(safe(y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI)),
      'Total Tax (Real)': Math.round(safe((y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI) / y.inflationFactor)),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
          <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
          {!modern && <Legend wrapperStyle={cc.legendStyle} />}
          <Bar dataKey="Total Tax (Nom)" fill="#f87171" fillOpacity={0.85} radius={barRadius} />
          <Bar dataKey="Total Tax (Real)" fill="#60a5fa" fillOpacity={0.85} radius={barRadius} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map(y => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      'After-Tax': Math.round(safe(y.waterfall.afterTaxIncome / f)),
      'Federal Tax': Math.round(safe(y.tax.federalTaxPayable / f)),
      'Provincial Tax': Math.round(safe(y.tax.provincialTaxPayable / f)),
      'CPP': Math.round(safe(y.cpp.totalCPPPaid / f)),
      'EI': Math.round(safe(y.ei.totalEI / f)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
        {!modern && <Legend wrapperStyle={cc.legendStyle} />}
        <Bar dataKey="After-Tax" stackId="a" fill={PALETTE.afterTax} fillOpacity={0.85} radius={barRadius} />
        <Bar dataKey="Federal Tax" stackId="a" fill={PALETTE.federal} fillOpacity={0.85} />
        <Bar dataKey="Provincial Tax" stackId="a" fill={PALETTE.provincial} fillOpacity={0.85} />
        <Bar dataKey="CPP" stackId="a" fill={PALETTE.cpp} fillOpacity={0.85} />
        <Bar dataKey="EI" stackId="a" fill={PALETTE.ei} fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
