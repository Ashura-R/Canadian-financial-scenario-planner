import React, { useState } from 'react';
import {
  AreaChart, Area, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedScenario } from '../../types/computed';
import type { Scenario } from '../../types/scenario';
import { formatShort } from '../../utils/formatters';
import { ChartRangeSelector, sliceByRange } from '../ChartRangeSelector';
import type { ChartRange } from '../ChartRangeSelector';

const SCENARIO_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

interface Props {
  scenarios: Scenario[];
  computed: ComputedScenario[];
}

function ChartCard({ title, range, onRangeChange, children }: {
  title: string;
  range: ChartRange;
  onRangeChange: (v: ChartRange) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <ChartRangeSelector value={range} onChange={onRangeChange} />
      </div>
      <div style={{ height: 240, padding: '8px 8px 4px' }}>
        {children}
      </div>
    </div>
  );
}

function buildData(
  computed: ComputedScenario[],
  scenarios: Scenario[],
  valueFn: (c: ComputedScenario, yearIdx: number) => number
) {
  const allYears = [...new Set(computed.flatMap(c => c.years.map(y => y.year)))].sort();
  return allYears.map((year, yIdx) => {
    const row: Record<string, number | string> = { year };
    computed.forEach((c, i) => {
      const idx = c.years.findIndex(yy => yy.year === year);
      row[scenarios[i]?.name ?? `S${i + 1}`] = idx >= 0 ? valueFn(c, idx) : 0;
    });
    return row;
  });
}

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 },
  labelStyle: { color: '#0f172a' },
};

function OverlayLine({ data, scenarios, title, range, onRangeChange }: {
  data: Record<string, any>[];
  scenarios: Scenario[];
  title: string;
  range: ChartRange;
  onRangeChange: (v: ChartRange) => void;
}) {
  const sliced = sliceByRange(data, range);
  return (
    <ChartCard title={title} range={range} onRangeChange={onRangeChange}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sliced} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v as number)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          {scenarios.map((sc, i) => (
            <Line key={sc.id} type="monotone" dataKey={sc.name} stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function OverlayArea({ data, scenarios, title, range, onRangeChange }: {
  data: Record<string, any>[];
  scenarios: Scenario[];
  title: string;
  range: ChartRange;
  onRangeChange: (v: ChartRange) => void;
}) {
  const sliced = sliceByRange(data, range);
  return (
    <ChartCard title={title} range={range} onRangeChange={onRangeChange}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sliced} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v as number)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          {scenarios.map((sc, i) => (
            <Area key={sc.id} type="monotone" dataKey={sc.name} stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} fillOpacity={0.15} strokeWidth={2} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OverlayCharts({ scenarios, computed }: Props) {
  const [chartRange, setChartRange] = useState<ChartRange>('all');

  const netWorthData = buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.netWorth ?? 0);
  const taxData = buildData(computed, scenarios, (c, i) => {
    const y = c.years[i];
    return y ? y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI : 0;
  });
  const afterTaxData = buildData(computed, scenarios, (c, i) => c.years[i]?.waterfall.afterTaxIncome ?? 0);
  const cfData = buildData(computed, scenarios, (c, i) => c.analytics.cumulativeCashFlow[i] ?? 0);
  const cumGrossData = buildData(computed, scenarios, (c, i) => c.analytics.cumulativeGrossIncome[i] ?? 0);
  const cumAfterTaxData = buildData(computed, scenarios, (c, i) => c.analytics.cumulativeAfterTaxIncome[i] ?? 0);
  const cumTotalTaxData = buildData(computed, scenarios, (c, i) => c.analytics.cumulativeTotalTax[i] ?? 0);
  const realNWData = buildData(computed, scenarios, (c, i) => c.years[i]?.realNetWorth ?? 0);
  const realCFData = buildData(computed, scenarios, (c, i) => c.analytics.cumulativeRealCashFlow[i] ?? 0);
  const rrspData = buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.rrspEOY ?? 0);
  const tfsaData = buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.tfsaEOY ?? 0);

  const rp = { range: chartRange, onRangeChange: setChartRange };

  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      <OverlayArea data={netWorthData} scenarios={scenarios} title="Net Worth Over Time" {...rp} />
      <OverlayLine data={taxData} scenarios={scenarios} title="Total Tax + CPP + EI" {...rp} />
      <OverlayLine data={afterTaxData} scenarios={scenarios} title="After-Tax Income" {...rp} />
      <OverlayLine data={cfData} scenarios={scenarios} title="Cumulative Cash Flow" {...rp} />
      <OverlayLine data={cumGrossData} scenarios={scenarios} title="Cumulative Gross Income" {...rp} />
      <OverlayLine data={cumAfterTaxData} scenarios={scenarios} title="Cumulative After-Tax Income" {...rp} />
      <OverlayLine data={cumTotalTaxData} scenarios={scenarios} title="Cumulative Total Tax" {...rp} />
      <OverlayArea data={realNWData} scenarios={scenarios} title="Real Net Worth Over Time" {...rp} />
      <OverlayLine data={realCFData} scenarios={scenarios} title="Real Cumulative Cash Flow" {...rp} />
      <OverlayLine data={rrspData} scenarios={scenarios} title="RRSP Balance" {...rp} />
      <OverlayLine data={tfsaData} scenarios={scenarios} title="TFSA Balance" {...rp} />
    </div>
  );
}
