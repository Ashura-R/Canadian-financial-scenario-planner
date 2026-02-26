import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedScenario } from '../../../types/computed';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props { computed: ComputedScenario; realMode?: boolean; diffMode?: boolean; modern?: boolean }

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

export function CumulativeCashFlowChart({ computed, realMode, diffMode, modern }: Props) {
  const cc = useChartColors();
  const barRadius: [number, number, number, number] = modern ? [3, 3, 0, 0] : [0, 0, 0, 0];
  const TooltipComp = modern ? ModernTooltipContent : undefined;

  if (diffMode) {
    const data = computed.years.map((y, i) => ({
      year: y.year,
      'Annual CF (Nom)': Math.round(safe(computed.analytics.annualCashFlow[i] ?? 0)),
      'Annual CF (Real)': Math.round(safe((computed.analytics.annualCashFlow[i] ?? 0) / y.inflationFactor)),
      'Cumulative (Nom)': Math.round(safe(computed.analytics.cumulativeCashFlow[i] ?? 0)),
      'Cumulative (Real)': Math.round(safe(computed.analytics.cumulativeRealCashFlow[i] ?? 0)),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
          <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
          <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
          {!modern && <Legend wrapperStyle={cc.legendStyle10} />}
          <Bar dataKey="Annual CF (Nom)" fill="#64748b" fillOpacity={0.6} radius={barRadius} />
          <Bar dataKey="Annual CF (Real)" fill="#3b82f6" fillOpacity={0.6} radius={barRadius} />
          <Line type="monotone" dataKey="Cumulative (Nom)" stroke="#64748b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Cumulative (Real)" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const data = computed.years.map((y, i) => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      'Annual CF': Math.round(safe((computed.analytics.annualCashFlow[i] ?? 0) / f)),
      'Cumulative CF': Math.round(safe(realMode
        ? (computed.analytics.cumulativeRealCashFlow[i] ?? 0)
        : (computed.analytics.cumulativeCashFlow[i] ?? 0))),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray={modern ? undefined : "3 3"} />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={!modern} tickLine={!modern} />
        <Tooltip content={TooltipComp ? <ModernTooltipContent /> : undefined} contentStyle={!TooltipComp ? cc.tooltipStyle : undefined} labelStyle={!TooltipComp ? cc.labelStyle : undefined} formatter={!TooltipComp ? ((v: number, name: string) => [formatShort(v), name]) : undefined} />
        {!modern && <Legend wrapperStyle={cc.legendStyle} />}
        <Bar dataKey="Annual CF" fill="#3b82f6" fillOpacity={0.7} radius={barRadius} />
        <Line type="monotone" dataKey="Cumulative CF" stroke="#10b981" strokeWidth={modern ? 2.5 : 2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
