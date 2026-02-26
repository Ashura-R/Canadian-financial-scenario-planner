import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort } from '../../../utils/formatters';

interface Props { years: ComputedYear[]; realMode?: boolean; diffMode?: boolean }

export function TaxWaterfallChart({ years, realMode, diffMode }: Props) {
  if (diffMode) {
    const data = years.map(y => ({
      year: y.year,
      'Total Tax (Nom)': Math.round(y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI),
      'Total Tax (Real)': Math.round((y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI) / y.inflationFactor),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#0f172a' }}
            formatter={(v: number, name: string) => [formatShort(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          <Bar dataKey="Total Tax (Nom)" fill="#f87171" fillOpacity={0.85} />
          <Bar dataKey="Total Tax (Real)" fill="#60a5fa" fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map(y => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      'Federal Tax': Math.round(y.tax.federalTaxPayable / f),
      'Provincial Tax': Math.round(y.tax.provincialTaxPayable / f),
      'CPP': Math.round(y.cpp.totalCPPPaid / f),
      'EI': Math.round(y.ei.totalEI / f),
      'After-Tax': Math.round(Math.max(0, y.waterfall.afterTaxIncome / f)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tickFormatter={v => formatShort(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#0f172a' }}
          formatter={(v: number, name: string) => [formatShort(v), name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
        <Bar dataKey="After-Tax" stackId="a" fill="#059669" fillOpacity={0.85} />
        <Bar dataKey="Federal Tax" stackId="a" fill="#dc2626" fillOpacity={0.85} />
        <Bar dataKey="Provincial Tax" stackId="a" fill="#ea580c" fillOpacity={0.85} />
        <Bar dataKey="CPP" stackId="a" fill="#d97706" fillOpacity={0.85} />
        <Bar dataKey="EI" stackId="a" fill="#ca8a04" fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
