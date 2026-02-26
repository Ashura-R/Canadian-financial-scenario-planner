import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedScenario } from '../../../types/computed';
import { formatShort } from '../../../utils/formatters';

interface Props { computed: ComputedScenario; realMode?: boolean; diffMode?: boolean }

export function CumulativeCashFlowChart({ computed, realMode, diffMode }: Props) {
  if (diffMode) {
    const data = computed.years.map((y, i) => ({
      year: y.year,
      'Annual CF (Nom)': Math.round(computed.analytics.annualCashFlow[i] ?? 0),
      'Annual CF (Real)': Math.round((computed.analytics.annualCashFlow[i] ?? 0) / y.inflationFactor),
      'Cumulative (Nom)': Math.round(computed.analytics.cumulativeCashFlow[i] ?? 0),
      'Cumulative (Real)': Math.round(computed.analytics.cumulativeRealCashFlow[i] ?? 0),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#0f172a' }}
            formatter={(v: number, name: string) => [formatShort(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
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
      'Annual CF': Math.round((computed.analytics.annualCashFlow[i] ?? 0) / f),
      'Cumulative CF': Math.round(realMode
        ? (computed.analytics.cumulativeRealCashFlow[i] ?? 0)
        : (computed.analytics.cumulativeCashFlow[i] ?? 0)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tickFormatter={v => formatShort(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#0f172a' }}
          formatter={(v: number, name: string) => [formatShort(v), name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
        <Bar dataKey="Annual CF" fill="#2563eb" fillOpacity={0.7} />
        <Line type="monotone" dataKey="Cumulative CF" stroke="#059669" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
