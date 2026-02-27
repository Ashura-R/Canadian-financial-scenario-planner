import React from 'react';
import type { ComputedScenario } from '../../types/computed';
import type { Scenario } from '../../types/scenario';
import { formatShort, formatPct } from '../../utils/formatters';

const SCENARIO_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
const GROUP_ACCENTS: Record<string, string> = {
  'Income': 'bg-emerald-500',
  'Tax': 'bg-red-500',
  'Rates': 'bg-amber-500',
  'Cash Flow': 'bg-blue-500',
  'Real Values': 'bg-purple-500',
  'Net Worth': 'bg-cyan-500',
  'Carry-forwards': 'bg-gray-400',
};

interface Props {
  scenarios: Scenario[];
  computed: ComputedScenario[];
}

interface MetricDef {
  label: string;
  group: string;
  fn: (c: ComputedScenario) => number;
  format: 'cad' | 'pct';
  higherIsBetter: boolean;
}

const METRICS: MetricDef[] = [
  // Income
  { group: 'Income', label: 'Avg Gross Income', fn: c => c.analytics.lifetimeGrossIncome / c.years.length, format: 'cad', higherIsBetter: true },
  { group: 'Income', label: 'Avg Net Taxable', fn: c => c.years.reduce((s, y) => s + y.tax.netTaxableIncome, 0) / c.years.length, format: 'cad', higherIsBetter: false },
  { group: 'Income', label: 'Avg After-Tax', fn: c => c.analytics.lifetimeAfterTaxIncome / c.years.length, format: 'cad', higherIsBetter: true },
  { group: 'Income', label: 'Lifetime Gross', fn: c => c.analytics.lifetimeGrossIncome, format: 'cad', higherIsBetter: true },
  { group: 'Income', label: 'Lifetime After-Tax', fn: c => c.analytics.lifetimeAfterTaxIncome, format: 'cad', higherIsBetter: true },
  // Tax
  { group: 'Tax', label: 'Lifetime Tax', fn: c => c.analytics.lifetimeTotalTax, format: 'cad', higherIsBetter: false },
  { group: 'Tax', label: 'Lifetime CPP+EI', fn: c => c.analytics.lifetimeCPPEI, format: 'cad', higherIsBetter: false },
  { group: 'Tax', label: 'Avg Tax Rate', fn: c => c.analytics.lifetimeAvgTaxRate, format: 'pct', higherIsBetter: false },
  { group: 'Tax', label: 'All-In Rate', fn: c => c.analytics.lifetimeAvgAllInRate, format: 'pct', higherIsBetter: false },
  // Rates
  { group: 'Rates', label: 'Final Marginal', fn: c => c.years[c.years.length - 1]?.tax.marginalCombinedRate ?? 0, format: 'pct', higherIsBetter: false },
  { group: 'Rates', label: 'Final Effective', fn: c => c.years[c.years.length - 1]?.tax.avgIncomeTaxRate ?? 0, format: 'pct', higherIsBetter: false },
  { group: 'Rates', label: 'Final All-In', fn: c => c.years[c.years.length - 1]?.tax.avgAllInRate ?? 0, format: 'pct', higherIsBetter: false },
  // Cash Flow
  { group: 'Cash Flow', label: 'Lifetime CF', fn: c => c.analytics.lifetimeCashFlow, format: 'cad', higherIsBetter: true },
  { group: 'Cash Flow', label: 'Final Year CF', fn: c => c.years[c.years.length - 1]?.waterfall.netCashFlow ?? 0, format: 'cad', higherIsBetter: true },
  // Real Values
  { group: 'Real Values', label: 'Real After-Tax', fn: c => c.years.reduce((s, y) => s + y.realAfterTaxIncome, 0), format: 'cad', higherIsBetter: true },
  { group: 'Real Values', label: 'Real CF', fn: c => c.years.reduce((s, y) => s + y.realNetCashFlow, 0), format: 'cad', higherIsBetter: true },
  { group: 'Real Values', label: 'Real Net Worth', fn: c => c.years[c.years.length - 1]?.realNetWorth ?? 0, format: 'cad', higherIsBetter: true },
  // Net Worth
  { group: 'Net Worth', label: 'RRSP', fn: c => c.years[c.years.length - 1]?.accounts.rrspEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'TFSA', fn: c => c.years[c.years.length - 1]?.accounts.tfsaEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'FHSA', fn: c => c.years[c.years.length - 1]?.accounts.fhsaEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Non-Reg', fn: c => c.years[c.years.length - 1]?.accounts.nonRegEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Savings', fn: c => c.years[c.years.length - 1]?.accounts.savingsEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Net Worth', fn: c => c.years[c.years.length - 1]?.accounts.netWorth ?? 0, format: 'cad', higherIsBetter: true },
  // Carry-forwards
  { group: 'Carry-forwards', label: 'RRSP Room', fn: c => c.years[c.years.length - 1]?.rrspUnusedRoom ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Carry-forwards', label: 'TFSA Room', fn: c => c.years[c.years.length - 1]?.tfsaUnusedRoom ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Carry-forwards', label: 'Cap Loss C/F', fn: c => c.years[c.years.length - 1]?.capitalLossCF ?? 0, format: 'cad', higherIsBetter: false },
];

function fmt(val: number, format: 'cad' | 'pct') {
  return format === 'pct' ? formatPct(val, 1) : formatShort(val);
}

function getBestWorstIdx(values: number[], higherIsBetter: boolean): { best: number; worst: number } {
  let bestIdx = 0, worstIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherIsBetter ? values[i] > values[bestIdx] : values[i] < values[bestIdx]) bestIdx = i;
    if (higherIsBetter ? values[i] < values[worstIdx] : values[i] > values[worstIdx]) worstIdx = i;
  }
  return { best: bestIdx, worst: worstIdx };
}

export function DiffTable({ scenarios, computed }: Props) {
  // Pre-compute all values: values[metricIdx][scenarioIdx]
  const allValues = METRICS.map(m => computed.map(c => m.fn(c)));
  const is2 = scenarios.length === 2;

  // Build grouped column spans for the group header row
  const groupSpans: { group: string; count: number }[] = [];
  for (const m of METRICS) {
    const last = groupSpans[groupSpans.length - 1];
    if (last && last.group === m.group) last.count++;
    else groupSpans.push({ group: m.group, count: 1 });
  }

  return (
    <div>
      <div className="overflow-x-auto w-full bg-app-surface border border-app-border rounded-lg shadow-sm">
        <table className="text-xs border-collapse w-full">
          <thead>
            {/* Group header row */}
            <tr className="border-b border-app-border">
              <th className="sticky left-0 z-10 bg-app-surface2 py-1.5 px-3" />
              {groupSpans.map(g => (
                <th key={g.group} colSpan={g.count} className="py-1.5 px-1 text-center border-l border-app-border">
                  <div className="flex items-center justify-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${GROUP_ACCENTS[g.group] ?? 'bg-gray-400'}`} />
                    <span className="text-[9px] font-semibold text-app-text4 uppercase tracking-wider">{g.group}</span>
                  </div>
                </th>
              ))}
            </tr>
            {/* Metric header row */}
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="sticky left-0 z-10 bg-app-surface2 py-2 px-3 text-left text-[10px] text-app-text3 font-semibold whitespace-nowrap w-0">Scenario</th>
              {METRICS.map((m, mIdx) => {
                const isGroupStart = mIdx === 0 || METRICS[mIdx - 1].group !== m.group;
                return (
                  <th key={m.label} className={`py-2 px-3 text-right text-[10px] text-app-text3 font-medium whitespace-nowrap ${isGroupStart ? 'border-l border-app-border' : ''}`}>
                    {m.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((sc, sIdx) => {
              const stripe = sIdx % 2 !== 0 ? 'bg-app-surface2/50' : '';
              return (
                <tr key={sc.id} className={`border-b border-app-border hover:bg-app-accent-light/30 ${stripe}`}>
                  <td className="sticky left-0 z-10 bg-app-surface py-1.5 px-3 whitespace-nowrap border-r border-app-border">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[sIdx % SCENARIO_COLORS.length] }} />
                      <span className="text-xs font-medium text-app-text">{sc.name}</span>
                    </div>
                  </td>
                  {METRICS.map((m, mIdx) => {
                    const colValues = allValues[mIdx];
                    const { best, worst } = getBestWorstIdx(colValues, m.higherIsBetter);
                    const showWinner = computed.length >= 2 && colValues[best] !== colValues[worst];
                    const isBest = showWinner && sIdx === best;
                    const isWorst = showWinner && sIdx === worst;
                    const isGroupStart = mIdx === 0 || METRICS[mIdx - 1].group !== m.group;
                    return (
                      <td key={m.label} className={`py-1.5 px-3 text-right tabular-nums text-xs ${isGroupStart ? 'border-l border-app-border' : ''} ${isBest ? 'bg-emerald-50/60 text-emerald-700 font-semibold' : isWorst ? 'text-app-text3' : 'text-app-text2'}`}>
                        {fmt(colValues[sIdx], m.format)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Bottom row: Diff (2 scenarios) or Spread (3+) */}
            <tr className="border-t-2 border-app-border bg-app-surface2">
              <td className="sticky left-0 z-10 bg-app-surface2 py-1.5 px-3 whitespace-nowrap border-r border-app-border">
                <span className="text-[10px] font-semibold text-app-text3 uppercase">{is2 ? 'Diff' : 'Spread'}</span>
                {!is2 && <span className="text-[9px] text-app-text4 ml-1">(max−min)</span>}
              </td>
              {METRICS.map((m, mIdx) => {
                const vals = allValues[mIdx];
                const isGroupStart = mIdx === 0 || METRICS[mIdx - 1].group !== m.group;
                if (is2) {
                  const diff = vals[1] - vals[0];
                  const isGood = m.higherIsBetter ? diff > 0 : diff < 0;
                  return (
                    <td key={m.label} className={`py-1.5 px-3 text-right text-xs ${isGroupStart ? 'border-l border-app-border' : ''}`}>
                      <span className={`font-medium ${isGood ? 'text-emerald-600' : diff === 0 ? 'text-app-text4' : 'text-app-text3'}`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff, m.format)}
                      </span>
                    </td>
                  );
                }
                const spread = Math.max(...vals) - Math.min(...vals);
                return (
                  <td key={m.label} className={`py-1.5 px-3 text-right text-xs ${isGroupStart ? 'border-l border-app-border' : ''}`}>
                    <span className={`font-medium ${spread === 0 ? 'text-app-text4' : 'text-app-text3'}`}>
                      {fmt(spread, m.format)}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
