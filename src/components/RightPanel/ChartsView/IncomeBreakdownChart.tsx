import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedYear } from '../../../types/computed';
import { formatShort } from '../../../utils/formatters';
import { useChartColors } from '../../../hooks/useChartColors';

interface Props {
  years: ComputedYear[];
  rawYears: import('../../../types/scenario').YearData[];
  diffMode?: boolean;
}

export function IncomeBreakdownChart({ years, rawYears, diffMode }: Props) {
  const cc = useChartColors();

  if (diffMode) {
    const data = years.map((y, i) => ({
      year: y.year,
      'Gross Income (Nom)': Math.round(y.waterfall.grossIncome),
      'Gross Income (Real)': Math.round(y.realGrossIncome),
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
          <Bar dataKey="Gross Income (Nom)" fill="#64748b" fillOpacity={0.85} />
          <Bar dataKey="Gross Income (Real)" fill="#3b82f6" fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map((y, i) => ({
    year: y.year,
    Employment: Math.round(rawYears[i]?.employmentIncome ?? 0),
    'Self-Empl.': Math.round(rawYears[i]?.selfEmploymentIncome ?? 0),
    'Elig. Div.': Math.round(rawYears[i]?.eligibleDividends ?? 0),
    'Non-Elig. Div.': Math.round(rawYears[i]?.nonEligibleDividends ?? 0),
    Interest: Math.round(rawYears[i]?.interestIncome ?? 0),
    'Cap. Gains': Math.round(rawYears[i]?.capitalGainsRealized ?? 0),
    Other: Math.round(rawYears[i]?.otherTaxableIncome ?? 0),
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
        <Legend wrapperStyle={cc.legendStyle10} />
        <Bar dataKey="Employment" stackId="a" fill="#2563eb" />
        <Bar dataKey="Self-Empl." stackId="a" fill="#7c3aed" />
        <Bar dataKey="Elig. Div." stackId="a" fill="#059669" />
        <Bar dataKey="Non-Elig. Div." stackId="a" fill="#0d9488" />
        <Bar dataKey="Interest" stackId="a" fill="#0891b2" />
        <Bar dataKey="Cap. Gains" stackId="a" fill="#d97706" />
        <Bar dataKey="Other" stackId="a" fill="#94a3b8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
