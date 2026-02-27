import React, { useState } from 'react';
import {
  AreaChart, Area, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ComputedScenario } from '../../types/computed';
import type { Scenario } from '../../types/scenario';
import { formatShort, safe } from '../../utils/formatters';
import { ChartRangeSelector, sliceByRange } from '../ChartRangeSelector';
import type { ChartRange } from '../ChartRangeSelector';

export const SCENARIO_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

/* CSS-variable-backed chart tokens */
const GRID = 'var(--app-chart-grid)';
const TICK = 'var(--app-chart-tick)';
const TT_BG = 'var(--app-surface)';
const TT_BORDER = 'var(--app-border)';
const LEGEND_COLOR = 'var(--app-text3)';

interface Props {
  scenarios: Scenario[];
  computed: ComputedScenario[];
}

function ChartCard({ title, children }: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app-surface border border-app-border/60 rounded-lg shadow-sm">
      <div className="px-3 py-2 border-b border-app-border">
        <div className="text-[11px] font-semibold text-app-text2">{title}</div>
      </div>
      <div style={{ height: 280, padding: '8px 8px 4px' }}>
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
      row[scenarios[i]?.name ?? `S${i + 1}`] = idx >= 0 ? safe(valueFn(c, idx)) : 0;
    });
    return row;
  });
}

const tooltipStyle = {
  contentStyle: { background: TT_BG, border: `1px solid ${TT_BORDER}`, borderRadius: 6, fontSize: 11 },
  labelStyle: { color: 'var(--app-text)' },
};

function OverlayLine({ data, scenarios, title }: {
  data: Record<string, any>[];
  scenarios: Scenario[];
  title: string;
}) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="year" tick={{ fill: TICK, fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v as number)} tick={{ fill: TICK, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: LEGEND_COLOR }} />
          {scenarios.map((sc, i) => (
            <Line key={sc.id} type="monotone" dataKey={sc.name} stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function OverlayArea({ data, scenarios, title }: {
  data: Record<string, any>[];
  scenarios: Scenario[];
  title: string;
}) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="year" tick={{ fill: TICK, fontSize: 10 }} />
          <YAxis tickFormatter={v => formatShort(v as number)} tick={{ fill: TICK, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: LEGEND_COLOR }} />
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

  const netWorthData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.netWorth ?? 0), chartRange);
  const taxData = sliceByRange(buildData(computed, scenarios, (c, i) => {
    const y = c.years[i];
    return y ? y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI : 0;
  }), chartRange);
  const afterTaxData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.waterfall.afterTaxIncome ?? 0), chartRange);
  const cfData = sliceByRange(buildData(computed, scenarios, (c, i) => c.analytics.cumulativeCashFlow[i] ?? 0), chartRange);
  const cumGrossData = sliceByRange(buildData(computed, scenarios, (c, i) => c.analytics.cumulativeGrossIncome[i] ?? 0), chartRange);
  const cumAfterTaxData = sliceByRange(buildData(computed, scenarios, (c, i) => c.analytics.cumulativeAfterTaxIncome[i] ?? 0), chartRange);
  const cumTotalTaxData = sliceByRange(buildData(computed, scenarios, (c, i) => c.analytics.cumulativeTotalTax[i] ?? 0), chartRange);
  const realNWData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.realNetWorth ?? 0), chartRange);
  const realCFData = sliceByRange(buildData(computed, scenarios, (c, i) => c.analytics.cumulativeRealCashFlow[i] ?? 0), chartRange);
  const rrspData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.rrspEOY ?? 0), chartRange);
  const tfsaData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.tfsaEOY ?? 0), chartRange);
  const fhsaData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.fhsaEOY ?? 0), chartRange);
  const nonRegData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.nonRegEOY ?? 0), chartRange);
  const savingsData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.savingsEOY ?? 0), chartRange);
  const liraData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.liraEOY ?? 0), chartRange);
  const respData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.respEOY ?? 0), chartRange);
  const liData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.accounts.liCashValueEOY ?? 0), chartRange);
  const marginalData = sliceByRange(buildData(computed, scenarios, (c, i) => (c.years[i]?.tax.marginalCombinedRate ?? 0) * 100), chartRange);
  const expensesData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.waterfall.totalLivingExpenses ?? 0), chartRange);
  const pnlData = sliceByRange(buildData(computed, scenarios, (c, i) => c.years[i]?.pnl?.totalGain ?? 0), chartRange);

  // Check if any accounts have balances across all scenarios
  const hasAccount = (fn: (c: ComputedScenario) => boolean) => computed.some(fn);
  const hasFHSA = hasAccount(c => c.years.some(y => y.accounts.fhsaEOY > 0));
  const hasNonReg = hasAccount(c => c.years.some(y => y.accounts.nonRegEOY > 0));
  const hasSavings = hasAccount(c => c.years.some(y => y.accounts.savingsEOY > 0));
  const hasLIRA = hasAccount(c => c.years.some(y => y.accounts.liraEOY > 0));
  const hasRESP = hasAccount(c => c.years.some(y => y.accounts.respEOY > 0));
  const hasLI = hasAccount(c => c.years.some(y => y.accounts.liCashValueEOY > 0));
  const hasExpenses = hasAccount(c => c.years.some(y => (y.waterfall.totalLivingExpenses ?? 0) > 0));
  const hasPnL = hasAccount(c => c.years.some(y => (y.pnl?.totalGain ?? 0) !== 0));

  return (
    <div>
      {/* Global range selector */}
      <div className="flex items-center justify-end mb-3">
        <ChartRangeSelector value={chartRange} onChange={setChartRange} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <OverlayArea data={netWorthData} scenarios={scenarios} title="Net Worth Over Time" />
        <OverlayLine data={taxData} scenarios={scenarios} title="Total Tax + CPP + EI" />
        <OverlayLine data={afterTaxData} scenarios={scenarios} title="After-Tax Income" />
        <OverlayLine data={marginalData} scenarios={scenarios} title="Marginal Combined Rate (%)" />
        <OverlayLine data={cfData} scenarios={scenarios} title="Cumulative Cash Flow" />
        {hasExpenses && <OverlayLine data={expensesData} scenarios={scenarios} title="Living Expenses" />}
        <OverlayLine data={cumGrossData} scenarios={scenarios} title="Cumulative Gross Income" />
        <OverlayLine data={cumAfterTaxData} scenarios={scenarios} title="Cumulative After-Tax Income" />
        <OverlayLine data={cumTotalTaxData} scenarios={scenarios} title="Cumulative Total Tax" />
        <OverlayArea data={realNWData} scenarios={scenarios} title="Real Net Worth Over Time" />
        <OverlayLine data={realCFData} scenarios={scenarios} title="Real Cumulative Cash Flow" />
        {hasPnL && <OverlayLine data={pnlData} scenarios={scenarios} title="Unrealized Gain/Loss (P&L)" />}
        <OverlayLine data={rrspData} scenarios={scenarios} title="RRSP Balance" />
        <OverlayLine data={tfsaData} scenarios={scenarios} title="TFSA Balance" />
        {hasFHSA && <OverlayLine data={fhsaData} scenarios={scenarios} title="FHSA Balance" />}
        {hasNonReg && <OverlayLine data={nonRegData} scenarios={scenarios} title="Non-Reg Balance" />}
        {hasSavings && <OverlayLine data={savingsData} scenarios={scenarios} title="Savings Balance" />}
        {hasLIRA && <OverlayLine data={liraData} scenarios={scenarios} title="LIRA/LIF Balance" />}
        {hasRESP && <OverlayLine data={respData} scenarios={scenarios} title="RESP Balance" />}
        {hasLI && <OverlayLine data={liData} scenarios={scenarios} title="Life Insurance Cash Value" />}
      </div>
    </div>
  );
}
