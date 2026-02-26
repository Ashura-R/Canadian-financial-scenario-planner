import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useScenario } from '../store/ScenarioContext';
import { computeCPPDeferral, computeOASDeferral } from '../engine/retirementAnalysis';
import { computeSensitivity } from '../engine/sensitivityEngine';
import { computeWithdrawalStrategies } from '../engine/optimizerEngine';
import { ChartRangeSelector, sliceByRange } from '../components/ChartRangeSelector';
import { formatShort, formatPct } from '../utils/formatters';
import { useChartColors } from '../hooks/useChartColors';
import type { ChartRange } from '../components/ChartRangeSelector';
import type { DeferralScenario } from '../engine/retirementAnalysis';
import type { SensitivityAnalysis } from '../engine/sensitivityEngine';
import type { WithdrawalStrategy } from '../engine/optimizerEngine';
import type { ComputedYear, ComputedScenario } from '../types/computed';

// ── Shared styles ────────────────────────────────────────────────────
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

const tooltipFmt = (v: number, name: string) => [formatShort(v), name];
const pctFmt = (v: number) => formatPct(v);
const pctTooltipFmt = (v: number, name: string) => [formatPct(v), name];

// ── KPI card ─────────────────────────────────────────────────────────
function KPI({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-lg px-4 py-3 min-w-0">
      <div className="text-[10px] text-app-text4 uppercase tracking-wider font-medium truncate">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${cls ?? 'text-app-text'}`}>{value}</div>
      {sub && <div className="text-[10px] text-app-text4 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Chart wrapper ────────────────────────────────────────────────────
function AnalysisChartCard({ title, range, onRangeChange, children, height = 240 }: {
  title: string;
  range?: ChartRange;
  onRangeChange?: (v: ChartRange) => void;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="bg-app-surface border border-app-border rounded-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
        <div className="text-xs font-semibold text-app-text2">{title}</div>
        {range && onRangeChange && <ChartRangeSelector value={range} onChange={onRangeChange} />}
      </div>
      <div style={{ height, padding: '12px 12px 8px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-3">
      <h3 className="text-sm font-bold text-app-text">{title}</h3>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

// ── Inline input ─────────────────────────────────────────────────────
function InlineInput({ label, value, onChange, width = 'w-24' }: {
  label: string; value: number; onChange: (v: number) => void; width?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-app-text3">
      {label}
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className={`${width} px-2 py-1 text-xs border border-app-border2 rounded tabular-nums`}
      />
    </label>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Section 1: Lifetime Tax Efficiency
// ══════════════════════════════════════════════════════════════════════
function TaxEfficiencySection({ computed }: { computed: ComputedScenario }) {
  const { analytics, years } = computed;
  const chartColors = useChartColors();

  const chartData = useMemo(() =>
    years.map((y, i) => ({
      year: y.year,
      'Cumulative Tax': Math.round(analytics.cumulativeTotalTax[i] ?? 0),
      'Cumulative After-Tax': Math.round(analytics.cumulativeAfterTaxIncome[i] ?? 0),
    })),
    [years, analytics]
  );

  const rateData = useMemo(() =>
    years.map(y => ({
      year: y.year,
      'Avg Income Tax Rate': y.tax.avgIncomeTaxRate,
      'Avg All-In Rate': y.tax.avgAllInRate,
    })),
    [years]
  );

  return (
    <section>
      <SectionHeader title="Lifetime Tax Efficiency" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="Lifetime Gross Income" value={formatShort(analytics.lifetimeGrossIncome)} />
        <KPI label="Lifetime Total Tax" value={formatShort(analytics.lifetimeTotalTax)} cls="text-red-600" />
        <KPI label="Lifetime After-Tax" value={formatShort(analytics.lifetimeAfterTaxIncome)} cls="text-emerald-600" />
        <KPI label="Lifetime Avg Tax Rate" value={formatPct(analytics.lifetimeAvgTaxRate)} cls="text-amber-600" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnalysisChartCard title="Cumulative Tax vs After-Tax Income">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
              <Legend wrapperStyle={chartColors.legendStyle10} />
              <Area type="monotone" dataKey="Cumulative After-Tax" stackId="1" stroke="#059669" fill="#059669" fillOpacity={0.3} />
              <Area type="monotone" dataKey="Cumulative Tax" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </AnalysisChartCard>

        <AnalysisChartCard title="Effective Tax Rate Over Time">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={pctFmt} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} formatter={pctTooltipFmt} />
              <Legend wrapperStyle={chartColors.legendStyle10} />
              <Line type="monotone" dataKey="Avg Income Tax Rate" stroke="#d97706" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Avg All-In Rate" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </AnalysisChartCard>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Section 2: Marginal Rates & Retirement Income
// ══════════════════════════════════════════════════════════════════════
function RateTimelineSection({ computed }: { computed: ComputedScenario }) {
  const { years } = computed;
  const chartColors = useChartColors();

  const marginalData = useMemo(() =>
    years.map(y => ({
      year: y.year,
      'Federal': y.tax.marginalFederalRate,
      'Provincial': y.tax.marginalProvincialRate,
      'Combined': y.tax.marginalCombinedRate,
    })),
    [years]
  );

  const hasRetirement = years.some(y => y.retirement.cppIncome > 0 || y.retirement.oasIncome > 0 || y.retirement.gisIncome > 0);

  const retirementData = useMemo(() => {
    if (!hasRetirement) return [];
    return years.map(y => ({
      year: y.year,
      CPP: Math.round(y.retirement.cppIncome),
      OAS: Math.round(y.retirement.oasIncome),
      GIS: Math.round(y.retirement.gisIncome),
    }));
  }, [years, hasRetirement]);

  return (
    <section>
      <SectionHeader title="Marginal Rates & Retirement Income" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnalysisChartCard title="Marginal Tax Rate Timeline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marginalData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={pctFmt} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} formatter={pctTooltipFmt} />
              <Legend wrapperStyle={chartColors.legendStyle10} />
              <Line type="monotone" dataKey="Federal" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Provincial" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Combined" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </AnalysisChartCard>

        {hasRetirement ? (
          <AnalysisChartCard title="Retirement Income Sources">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={retirementData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                <XAxis dataKey="year" tick={chartColors.axisTick} />
                <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
                <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
                <Legend wrapperStyle={chartColors.legendStyle10} />
                <Area type="monotone" dataKey="CPP" stackId="1" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                <Area type="monotone" dataKey="OAS" stackId="1" stroke="#059669" fill="#059669" fillOpacity={0.4} />
                <Area type="monotone" dataKey="GIS" stackId="1" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </AnalysisChartCard>
        ) : (
          <div className="bg-app-surface border border-app-border rounded-lg flex items-center justify-center h-[280px]">
            <p className="text-xs text-app-text4">Configure retirement age &amp; birth year to see retirement income sources.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Section 3: CPP / OAS Deferral
// ══════════════════════════════════════════════════════════════════════

function DeferralChart({ scenarios, startAge, endAge, keyAges, label }: {
  scenarios: DeferralScenario[];
  startAge: number;
  endAge: number;
  keyAges: number[];
  label: string;
}) {
  const chartColors = useChartColors();
  const deferralColors = ['#dc2626', '#d97706', '#2563eb', '#059669', '#7c3aed', '#0891b2'];
  const filtered = scenarios.filter(s => keyAges.includes(s.startAge));

  const chartData = useMemo(() => {
    const points: Record<string, number | string>[] = [];
    for (let age = startAge; age <= endAge; age++) {
      const pt: Record<string, number | string> = { age };
      for (const s of filtered) {
        const idx = age - startAge;
        pt[`Age ${s.startAge}`] = Math.round(s.cumulativeByAge[idx] ?? 0);
      }
      points.push(pt);
    }
    return points;
  }, [filtered, startAge, endAge]);

  // Find optimal by cumulative at age 85
  const age85Idx = 85 - startAge;
  const optimal = filtered.reduce((best, s) => (s.cumulativeByAge[age85Idx] ?? 0) > (best.cumulativeByAge[age85Idx] ?? 0) ? s : best, filtered[0]);
  const at65 = filtered.find(s => s.startAge === 65);
  const at70 = filtered.find(s => s.startAge === 70);
  const diff70vs65 = at70 && at65 ? (at70.cumulativeByAge[age85Idx] ?? 0) - (at65.cumulativeByAge[age85Idx] ?? 0) : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <KPI label={`Optimal ${label} Start (by 85)`} value={`Age ${optimal?.startAge ?? '?'}`} cls="text-app-accent" />
        <KPI label="Deferring to 70 vs 65 (by 85)" value={diff70vs65 > 0 ? `+${formatShort(diff70vs65)}` : formatShort(diff70vs65)} cls={diff70vs65 > 0 ? 'text-emerald-600' : 'text-red-600'} />
      </div>
      <AnalysisChartCard title={`${label} Cumulative Benefit by Start Age`} height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
            <XAxis dataKey="age" tick={chartColors.axisTick} />
            <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
            <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
            <Legend wrapperStyle={chartColors.legendStyle10} />
            {filtered.map((s, i) => (
              <Line
                key={s.startAge}
                type="monotone"
                dataKey={`Age ${s.startAge}`}
                stroke={deferralColors[i % deferralColors.length]}
                strokeWidth={s.startAge === 65 ? 2.5 : 1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </AnalysisChartCard>
    </div>
  );
}

function CPPDeferralSection({ scenarios, cppMonthly, onCppChange }: {
  scenarios: DeferralScenario[];
  cppMonthly: number;
  onCppChange: (v: number) => void;
}) {
  return (
    <div>
      <SectionHeader title="CPP Start Age">
        <InlineInput label="Monthly @ 65:" value={cppMonthly} onChange={onCppChange} />
      </SectionHeader>
      <DeferralChart
        scenarios={scenarios}
        startAge={60}
        endAge={90}
        keyAges={[60, 62, 65, 67, 70]}
        label="CPP"
      />
      <div className="mt-3">
        <DeferralTable scenarios={scenarios} cumulativeAgeLabel="80" cumulativeIdx={20} />
      </div>
    </div>
  );
}

function OASDeferralSection({ scenarios, oasMonthly, onOasChange }: {
  scenarios: DeferralScenario[];
  oasMonthly: number;
  onOasChange: (v: number) => void;
}) {
  return (
    <div>
      <SectionHeader title="OAS Start Age">
        <InlineInput label="Monthly @ 65:" value={oasMonthly} onChange={onOasChange} />
      </SectionHeader>
      <DeferralChart
        scenarios={scenarios}
        startAge={65}
        endAge={90}
        keyAges={[65, 66, 67, 68, 69, 70]}
        label="OAS"
      />
      <div className="mt-3">
        <DeferralTable scenarios={scenarios} cumulativeAgeLabel="80" cumulativeIdx={15} />
      </div>
    </div>
  );
}

function DeferralTable({ scenarios, cumulativeAgeLabel, cumulativeIdx }: {
  scenarios: DeferralScenario[];
  cumulativeAgeLabel: string;
  cumulativeIdx: number;
}) {
  return (
    <div className="bg-app-surface rounded-lg border border-app-border p-3 overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="border-b border-app-border">
            <th className="text-left py-1.5 pr-3 text-app-text3 font-medium">Start</th>
            <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Adj.</th>
            <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Monthly</th>
            <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Annual</th>
            <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Cumul. @ {cumulativeAgeLabel}</th>
            <th className="text-right py-1.5 pl-2 text-app-text3 font-medium">Break-Even</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map(s => (
            <tr key={s.startAge} className={`border-b border-app-border ${s.startAge === 65 ? 'bg-app-accent-light font-semibold' : ''}`}>
              <td className="py-1.5 pr-3">{s.startAge}</td>
              <td className="text-right py-1.5 px-2">
                <span className={s.adjustmentPct < 0 ? 'text-red-600' : s.adjustmentPct > 0 ? 'text-green-600' : ''}>
                  {s.adjustmentPct > 0 ? '+' : ''}{(s.adjustmentPct * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.monthlyAmount).toLocaleString()}</td>
              <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.annualAmount).toLocaleString()}</td>
              <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.cumulativeByAge[cumulativeIdx] ?? 0)}</td>
              <td className="text-right py-1.5 pl-2">
                {s.breakEvenVs65 !== null ? `Age ${s.breakEvenVs65}` : s.startAge === 65 ? '—' : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Section 4: Sensitivity Analysis
// ══════════════════════════════════════════════════════════════════════
function SensitivitySection({ analysis, years }: { analysis: SensitivityAnalysis; years: ComputedYear[] }) {
  const [range, setRange] = useState<ChartRange>('all');
  const chartColors = useChartColors();

  const lineStyles: Record<string, { color: string; dash?: string; width: number }> = {
    '-4%': { color: '#dc2626', dash: '5 3', width: 1.5 },
    '-2%': { color: '#d97706', dash: '5 3', width: 1.5 },
    'Base': { color: '#2563eb', width: 2.5 },
    '+2%': { color: '#059669', dash: '5 3', width: 1.5 },
    '+4%': { color: '#065f46', dash: '5 3', width: 1.5 },
  };

  const chartData = useMemo(() => {
    const len = analysis.scenarios[0]?.yearlyNetWorth.length ?? 0;
    const startYear = years[0]?.year ?? new Date().getFullYear();
    const points: Record<string, number | string>[] = [];
    for (let i = 0; i < len; i++) {
      const pt: Record<string, number | string> = { year: startYear + i };
      for (const s of analysis.scenarios) {
        pt[s.label] = Math.round(s.yearlyNetWorth[i] ?? 0);
      }
      points.push(pt);
    }
    return points;
  }, [analysis, years]);

  const sliced = sliceByRange(chartData, range);

  const finals = analysis.scenarios.map(s => s.finalNetWorth);
  const minNW = Math.min(...finals);
  const maxNW = Math.max(...finals);
  const taxes = analysis.scenarios.map(s => s.lifetimeTax);
  const minTax = Math.min(...taxes);
  const maxTax = Math.max(...taxes);

  return (
    <section>
      <SectionHeader title="Sensitivity Analysis — Equity Return Offsets" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="Net Worth Range (End)" value={`${formatShort(minNW)} — ${formatShort(maxNW)}`} />
        <KPI label="NW Spread" value={formatShort(maxNW - minNW)} cls="text-amber-600" />
        <KPI label="Lifetime Tax Range" value={`${formatShort(minTax)} — ${formatShort(maxTax)}`} />
        <KPI label="Tax Spread" value={formatShort(maxTax - minTax)} cls="text-red-600" />
      </div>

      <AnalysisChartCard title="Net Worth Fan Chart" range={range} onRangeChange={setRange} height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
            <XAxis dataKey="year" tick={chartColors.axisTick} />
            <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
            <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
            <Legend wrapperStyle={chartColors.legendStyle10} />
            {analysis.scenarios.map(s => {
              const style = lineStyles[s.label] ?? { color: '#64748b', width: 1.5 };
              return (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  dot={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </AnalysisChartCard>

      <div className="mt-3 bg-app-surface rounded-lg border border-app-border p-3 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-app-border">
              <th className="text-left py-1.5 pr-3 text-app-text3 font-medium">Scenario</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Final Net Worth</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Real Net Worth</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Lifetime After-Tax</th>
              <th className="text-right py-1.5 pl-2 text-app-text3 font-medium">Lifetime Tax</th>
            </tr>
          </thead>
          <tbody>
            {analysis.scenarios.map(s => (
              <tr key={s.label} className={`border-b border-app-border ${s.equityOffset === 0 ? 'bg-app-accent-light font-semibold' : ''}`}>
                <td className="py-1.5 pr-3">{s.label}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.finalNetWorth)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.finalRealNetWorth)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.lifetimeAfterTax)}</td>
                <td className="text-right py-1.5 pl-2 tabular-nums">{formatShort(s.lifetimeTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Section 5: Withdrawal Strategies
// ══════════════════════════════════════════════════════════════════════
function WithdrawalSection({ strategies, years, withdrawalTarget, onTargetChange }: {
  strategies: WithdrawalStrategy[];
  years: ComputedYear[];
  withdrawalTarget: number;
  onTargetChange: (v: number) => void;
}) {
  const [range, setRange] = useState<ChartRange>('all');
  const chartColors = useChartColors();

  if (strategies.length === 0) return null;

  const best = strategies.reduce((a, b) => a.lifetimeTax < b.lifetimeTax ? a : b);
  const worst = strategies.reduce((a, b) => a.lifetimeTax > b.lifetimeTax ? a : b);
  const equalSplit = strategies.find(s => s.name === 'Equal Split');
  const taxSavingsVsWorst = worst.lifetimeTax - best.lifetimeTax;
  const taxSavingsVsEqual = equalSplit ? equalSplit.lifetimeTax - best.lifetimeTax : 0;

  const startYear = years[0]?.year ?? new Date().getFullYear();
  const stratColors = [COLORS[0], COLORS[1], COLORS[2], COLORS[3]];

  const nwData = useMemo(() => {
    const len = strategies[0]?.yearlyNetWorth.length ?? 0;
    const points: Record<string, number | string>[] = [];
    for (let i = 0; i < len; i++) {
      const pt: Record<string, number | string> = { year: startYear + i };
      for (const s of strategies) {
        pt[s.name] = Math.round(s.yearlyNetWorth[i] ?? 0);
      }
      points.push(pt);
    }
    return points;
  }, [strategies, startYear]);

  const taxData = useMemo(() => {
    const len = strategies[0]?.yearlyTax.length ?? 0;
    const points: Record<string, number | string>[] = [];
    for (let i = 0; i < len; i++) {
      const pt: Record<string, number | string> = { year: startYear + i };
      for (const s of strategies) {
        let cumTax = 0;
        for (let j = 0; j <= i; j++) cumTax += s.yearlyTax[j] ?? 0;
        pt[s.name] = Math.round(cumTax);
      }
      points.push(pt);
    }
    return points;
  }, [strategies, startYear]);

  const slicedNW = sliceByRange(nwData, range);
  const slicedTax = sliceByRange(taxData, range);

  return (
    <section>
      <SectionHeader title="Withdrawal Strategy Comparison">
        <InlineInput label="Annual Target:" value={withdrawalTarget} onChange={onTargetChange} width="w-28" />
      </SectionHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <KPI label="Best Strategy" value={best.name} cls="text-emerald-600" />
        <KPI label="Tax Savings vs Worst" value={formatShort(taxSavingsVsWorst)} cls="text-emerald-600" />
        <KPI label="Tax Savings vs Equal Split" value={formatShort(taxSavingsVsEqual)} cls="text-app-accent" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-3">
        <AnalysisChartCard title="Net Worth by Strategy" range={range} onRangeChange={setRange} height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={slicedNW} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
              <Legend wrapperStyle={chartColors.legendStyle10} />
              {strategies.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={stratColors[i]} strokeWidth={s === best ? 2.5 : 1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </AnalysisChartCard>

        <AnalysisChartCard title="Cumulative Tax by Strategy" range={range} onRangeChange={setRange} height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={slicedTax} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} formatter={tooltipFmt} />
              <Legend wrapperStyle={chartColors.legendStyle10} />
              {strategies.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={stratColors[i]} strokeWidth={s === best ? 2.5 : 1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </AnalysisChartCard>
      </div>

      <div className="bg-app-surface rounded-lg border border-app-border p-3 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-app-border">
              <th className="text-left py-1.5 pr-3 text-app-text3 font-medium">Strategy</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Lifetime Tax</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Lifetime After-Tax</th>
              <th className="text-right py-1.5 px-2 text-app-text3 font-medium">Final Net Worth</th>
              <th className="text-right py-1.5 pl-2 text-app-text3 font-medium">Avg Tax Rate</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map(s => (
              <tr key={s.name} className={`border-b border-app-border ${s === best ? 'bg-app-accent-light font-semibold' : ''}`}>
                <td className="py-1.5 pr-3">
                  {s.name}
                  {s === best && <span className="ml-1 text-[9px] text-green-600 font-bold">BEST</span>}
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.lifetimeTax)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.lifetimeAfterTax)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{formatShort(s.finalNetWorth)}</td>
                <td className="text-right py-1.5 pl-2 tabular-nums">{formatPct(s.avgTaxRate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} className="pt-2 text-[10px] text-app-text4">{strategies.map(s => s.description).join(' | ')}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════
export function AnalysisPage() {
  const { activeScenario, activeComputed } = useScenario();
  const [cppMonthly, setCppMonthly] = useState(900);
  const [oasMonthly, setOasMonthly] = useState(700);
  const [withdrawalTarget, setWithdrawalTarget] = useState(50000);

  const cppScenarios = useMemo(
    () => computeCPPDeferral(cppMonthly, activeScenario?.assumptions.inflationRate ?? 0.02),
    [cppMonthly, activeScenario?.assumptions.inflationRate]
  );

  const oasScenarios = useMemo(
    () => computeOASDeferral(oasMonthly, activeScenario?.assumptions.inflationRate ?? 0.02),
    [oasMonthly, activeScenario?.assumptions.inflationRate]
  );

  const sensitivity = useMemo(
    () => activeScenario ? computeSensitivity(activeScenario) : null,
    [activeScenario]
  );

  const withdrawalStrategies = useMemo(
    () => activeScenario && withdrawalTarget > 0
      ? computeWithdrawalStrategies(activeScenario, withdrawalTarget)
      : [],
    [activeScenario, withdrawalTarget]
  );

  if (!activeScenario || !activeComputed) return null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <h2 className="text-lg font-bold text-app-text">Advanced Analysis</h2>

      {/* Section 1: Lifetime Tax Efficiency */}
      <TaxEfficiencySection computed={activeComputed} />

      {/* Section 2: Marginal Rates & Retirement Income */}
      <RateTimelineSection computed={activeComputed} />

      {/* Section 3: CPP / OAS Deferral */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CPPDeferralSection scenarios={cppScenarios} cppMonthly={cppMonthly} onCppChange={setCppMonthly} />
        <OASDeferralSection scenarios={oasScenarios} oasMonthly={oasMonthly} onOasChange={setOasMonthly} />
      </div>

      {/* Section 4: Sensitivity */}
      {sensitivity && <SensitivitySection analysis={sensitivity} years={activeComputed.years} />}

      {/* Section 5: Withdrawal Strategies */}
      <WithdrawalSection
        strategies={withdrawalStrategies}
        years={activeComputed.years}
        withdrawalTarget={withdrawalTarget}
        onTargetChange={setWithdrawalTarget}
      />
    </div>
  );
}
