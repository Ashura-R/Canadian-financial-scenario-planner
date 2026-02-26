import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort, safe } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props { years: ComputedYear[]; realMode?: boolean; diffMode?: boolean }

export function TaxWaterfallChart({ years, realMode, diffMode }: Props) {
  const cc = useChartColors();

  if (diffMode) {
    const data = years.map(y => ({
      year: y.year,
      'Total Tax (Nom)': Math.round(safe(y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI)),
      'Total Tax (Real)': Math.round(safe((y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI) / y.inflationFactor)),
    }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
          <XAxis dataKey="year" tick={cc.axisTick} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
          <Tooltip
            contentStyle={cc.tooltipStyle}
            labelStyle={cc.labelStyle}
            formatter={(v: number, name: string) => [formatShort(v), name]}
          />
          <Legend wrapperStyle={cc.legendStyle} />
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
      'Federal Tax': Math.round(safe(y.tax.federalTaxPayable / f)),
      'Provincial Tax': Math.round(safe(y.tax.provincialTaxPayable / f)),
      'CPP': Math.round(safe(y.cpp.totalCPPPaid / f)),
      'EI': Math.round(safe(y.ei.totalEI / f)),
      'After-Tax': Math.round(Math.max(0, safe(y.waterfall.afterTaxIncome / f))),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
        <XAxis dataKey="year" tick={cc.axisTick} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} />
        <Tooltip
          contentStyle={cc.tooltipStyle}
          labelStyle={cc.labelStyle}
          formatter={(v: number, name: string) => [formatShort(v), name]}
        />
        <Legend wrapperStyle={cc.legendStyle} />
        <Bar dataKey="After-Tax" stackId="a" fill="#059669" fillOpacity={0.85} />
        <Bar dataKey="Federal Tax" stackId="a" fill="#dc2626" fillOpacity={0.85} />
        <Bar dataKey="Provincial Tax" stackId="a" fill="#ea580c" fillOpacity={0.85} />
        <Bar dataKey="CPP" stackId="a" fill="#d97706" fillOpacity={0.85} />
        <Bar dataKey="EI" stackId="a" fill="#ca8a04" fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
