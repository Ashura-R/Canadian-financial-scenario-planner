import React from 'react';
import type { ComputedScenario } from '../../types/computed';
import type { Scenario } from '../../types/scenario';
import { formatShort, formatPct } from '../../utils/formatters';

const SCENARIO_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
const RANK_COLORS = ['#d97706', '#94a3b8', '#b45309']; // gold, silver, bronze
const GROUP_ACCENTS: Record<string, string> = {
  'Income': 'border-l-emerald-500',
  'Tax': 'border-l-red-500',
  'Rates': 'border-l-amber-500',
  'Cash Flow': 'border-l-blue-500',
  'Real Values': 'border-l-purple-500',
  'Net Worth': 'border-l-cyan-500',
  'Carry-forwards': 'border-l-gray-400',
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
  { group: 'Income', label: 'Lifetime Gross Income', fn: c => c.analytics.lifetimeGrossIncome, format: 'cad', higherIsBetter: true },
  { group: 'Income', label: 'Lifetime After-Tax Income', fn: c => c.analytics.lifetimeAfterTaxIncome, format: 'cad', higherIsBetter: true },
  // Tax
  { group: 'Tax', label: 'Lifetime Total Tax', fn: c => c.analytics.lifetimeTotalTax, format: 'cad', higherIsBetter: false },
  { group: 'Tax', label: 'Lifetime CPP+EI', fn: c => c.analytics.lifetimeCPPEI, format: 'cad', higherIsBetter: false },
  { group: 'Tax', label: 'Lifetime Avg Tax Rate', fn: c => c.analytics.lifetimeAvgTaxRate, format: 'pct', higherIsBetter: false },
  { group: 'Tax', label: 'Lifetime All-In Rate', fn: c => c.analytics.lifetimeAvgAllInRate, format: 'pct', higherIsBetter: false },
  // Rates
  { group: 'Rates', label: 'Final Year Marginal Rate', fn: c => c.years[c.years.length - 1]?.tax.marginalCombinedRate ?? 0, format: 'pct', higherIsBetter: false },
  { group: 'Rates', label: 'Final Year Effective Rate', fn: c => c.years[c.years.length - 1]?.tax.avgIncomeTaxRate ?? 0, format: 'pct', higherIsBetter: false },
  { group: 'Rates', label: 'Final Year All-In Rate', fn: c => c.years[c.years.length - 1]?.tax.avgAllInRate ?? 0, format: 'pct', higherIsBetter: false },
  // Cash Flow
  { group: 'Cash Flow', label: 'Lifetime Cash Flow', fn: c => c.analytics.lifetimeCashFlow, format: 'cad', higherIsBetter: true },
  { group: 'Cash Flow', label: 'Final Year CF', fn: c => c.years[c.years.length - 1]?.waterfall.netCashFlow ?? 0, format: 'cad', higherIsBetter: true },
  // Real Values
  { group: 'Real Values', label: 'Real Lifetime After-Tax', fn: c => c.years.reduce((s, y) => s + y.realAfterTaxIncome, 0), format: 'cad', higherIsBetter: true },
  { group: 'Real Values', label: 'Real Lifetime Cash Flow', fn: c => c.years.reduce((s, y) => s + y.realNetCashFlow, 0), format: 'cad', higherIsBetter: true },
  { group: 'Real Values', label: 'Real Final Net Worth', fn: c => c.years[c.years.length - 1]?.realNetWorth ?? 0, format: 'cad', higherIsBetter: true },
  // Net Worth
  { group: 'Net Worth', label: 'Final RRSP', fn: c => c.years[c.years.length - 1]?.accounts.rrspEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Final TFSA', fn: c => c.years[c.years.length - 1]?.accounts.tfsaEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Final FHSA', fn: c => c.years[c.years.length - 1]?.accounts.fhsaEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Final Non-Reg', fn: c => c.years[c.years.length - 1]?.accounts.nonRegEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Final Savings', fn: c => c.years[c.years.length - 1]?.accounts.savingsEOY ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Net Worth', label: 'Final Net Worth', fn: c => c.years[c.years.length - 1]?.accounts.netWorth ?? 0, format: 'cad', higherIsBetter: true },
  // Carry-forwards
  { group: 'Carry-forwards', label: 'Final RRSP Unused Room', fn: c => c.years[c.years.length - 1]?.rrspUnusedRoom ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Carry-forwards', label: 'Final TFSA Unused Room', fn: c => c.years[c.years.length - 1]?.tfsaUnusedRoom ?? 0, format: 'cad', higherIsBetter: true },
  { group: 'Carry-forwards', label: 'Final Capital Loss C/F', fn: c => c.years[c.years.length - 1]?.capitalLossCF ?? 0, format: 'cad', higherIsBetter: false },
];

function fmt(val: number, format: 'cad' | 'pct') {
  return format === 'pct' ? formatPct(val, 1) : formatShort(val);
}

function getRanks(values: number[], higherIsBetter: boolean): number[] {
  const sorted = [...values].map((v, i) => ({ v, i }));
  sorted.sort((a, b) => higherIsBetter ? b.v - a.v : a.v - b.v);
  const ranks = new Array(values.length);
  sorted.forEach((item, rank) => { ranks[item.i] = rank; });
  return ranks;
}

export function DiffTable({ scenarios, computed }: Props) {
  const groups = [...new Set(METRICS.map(m => m.group))];
  const showRanks = scenarios.length >= 3;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-app-surface2 border-b border-app-border">
            <th className="py-2.5 px-4 text-left text-[10px] text-app-text3 font-semibold uppercase tracking-wide w-44">Metric</th>
            {showRanks && (
              <th className="py-2.5 px-2 text-center text-[10px] text-app-text3 font-semibold uppercase tracking-wide w-16">Rank</th>
            )}
            {scenarios.map((sc, i) => (
              <th key={sc.id} className="py-2.5 px-4 text-right text-[10px] text-app-text2 font-semibold whitespace-nowrap">
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                {sc.name}
              </th>
            ))}
            <th className="py-2.5 px-4 text-right text-[10px] text-app-text3 font-medium uppercase tracking-wide">
              {scenarios.length === 2 ? 'Diff' : 'Delta vs Best'}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <React.Fragment key={group}>
              <tr className={`bg-app-surface2 border-y border-app-border border-l-3 ${GROUP_ACCENTS[group] ?? 'border-l-app-border'}`}>
                <td colSpan={scenarios.length + (showRanks ? 3 : 2)} className="py-2 px-4 text-[10px] font-semibold text-app-text4 uppercase tracking-widest">
                  {group}
                </td>
              </tr>
              {METRICS.filter(m => m.group === group).map(metric => {
                const values = computed.map(c => metric.fn(c));
                const ranks = getRanks(values, metric.higherIsBetter);
                const bestVal = metric.higherIsBetter ? Math.max(...values) : Math.min(...values);

                return (
                  <tr key={metric.label} className="border-b border-app-border hover:bg-app-accent-light/30 transition-colors">
                    <td className="py-2 px-4 text-xs text-app-text2">{metric.label}</td>
                    {showRanks && (
                      <td className="py-2 px-2 text-center">
                        <div className="flex gap-0.5 justify-center">
                          {ranks.map((rank, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white"
                              style={{ backgroundColor: RANK_COLORS[rank] ?? '#94a3b8' }}
                              title={`${scenarios[i]?.name}: #${rank + 1}`}
                            >
                              {rank + 1}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    {values.map((v, i) => {
                      const isBest = ranks[i] === 0 && values.length > 1;
                      const isWorst = ranks[i] === values.length - 1 && values.length > 1;
                      const color = values.length > 1
                        ? isBest ? 'text-emerald-600 font-semibold' : isWorst ? 'text-red-600' : 'text-app-text2'
                        : 'text-app-text';
                      return (
                        <td key={i} className={`py-2 px-4 text-right text-xs ${color}`}>
                          {fmt(v, metric.format)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-4 text-right text-xs">
                      {scenarios.length === 2 ? (() => {
                        const diff = values[1] - values[0];
                        const isGood = metric.higherIsBetter ? diff > 0 : diff < 0;
                        const isBad = metric.higherIsBetter ? diff < 0 : diff > 0;
                        return (
                          <span className={`font-medium ${isGood ? 'text-emerald-600' : isBad ? 'text-red-600' : 'text-app-text4'}`}>
                            {diff >= 0 ? '+' : ''}{fmt(diff, metric.format)}
                          </span>
                        );
                      })() : (() => {
                        // Show max delta from best
                        const worstVal = metric.higherIsBetter ? Math.min(...values) : Math.max(...values);
                        const delta = Math.abs(bestVal - worstVal);
                        return (
                          <span className="text-app-text4">{fmt(delta, metric.format)}</span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
