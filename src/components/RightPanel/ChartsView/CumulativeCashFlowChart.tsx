import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedScenario } from '../../../types/computed';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props { computed: ComputedScenario; realMode?: boolean; diffMode?: boolean }

export function CumulativeCashFlowChart({ computed, realMode, diffMode }: Props) {
  const cc = useChartColors();

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
          <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
          <XAxis dataKey="year" tick={cc.axisTick} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
          <Tooltip
            contentStyle={cc.tooltipStyle}
            labelStyle={cc.labelStyle}
            formatter={(v: number, name: string) => [formatShort(v), name]}
          />
          <Legend wrapperStyle={cc.legendStyle10} />
          <Bar dataKey="Annual CF (Nom)" fill="#64748b" fillOpacity={0.6} />
          <Bar dataKey="Annual CF (Real)" fill="#3b82f6" fillOpacity={0.6} />
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
        <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
        <XAxis dataKey="year" tick={cc.axisTick} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
        <Tooltip
          contentStyle={cc.tooltipStyle}
          labelStyle={cc.labelStyle}
          formatter={(v: number, name: string) => [formatShort(v), name]}
        />
        <Legend wrapperStyle={cc.legendStyle} />
        <Bar dataKey="Annual CF" fill="#2563eb" fillOpacity={0.7} />
        <Line type="monotone" dataKey="Cumulative CF" stroke="#059669" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
