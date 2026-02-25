import React from 'react';
import type { ComputedScenario } from '../../types/computed';
import type { Scenario } from '../../types/scenario';
import { formatShort, formatPct } from '../../utils/formatters';

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

export function DiffTable({ scenarios, computed }: Props) {
  const groups = [...new Set(METRICS.map(m => m.group))];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="py-2.5 px-4 text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wide w-44">Metric</th>
            {scenarios.map(sc => (
              <th key={sc.id} className="py-2.5 px-4 text-right text-[10px] text-slate-700 font-semibold whitespace-nowrap">
                {sc.name}
              </th>
            ))}
            {scenarios.length === 2 && (
              <th className="py-2.5 px-4 text-right text-[10px] text-slate-500 font-medium uppercase tracking-wide">Diff</th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <React.Fragment key={group}>
              <tr className="bg-slate-50 border-y border-slate-100">
                <td colSpan={scenarios.length + 2} className="py-1.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {group}
                </td>
              </tr>
              {METRICS.filter(m => m.group === group).map(metric => {
                const values = computed.map(c => metric.fn(c));
                const maxVal = Math.max(...values);
                const minVal = Math.min(...values);
                const diff = scenarios.length === 2 ? values[1] - values[0] : null;

                return (
                  <tr key={metric.label} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-4 text-xs text-slate-600">{metric.label}</td>
                    {values.map((v, i) => {
                      const isBest = metric.higherIsBetter ? v === maxVal : v === minVal;
                      const isWorst = metric.higherIsBetter ? v === minVal : v === maxVal;
                      const color = values.length > 1
                        ? isBest ? 'text-emerald-600 font-semibold' : isWorst ? 'text-red-600' : 'text-slate-700'
                        : 'text-slate-800';
                      return (
                        <td key={i} className={`py-2 px-4 text-right text-xs ${color}`}>
                          {fmt(v, metric.format)}
                        </td>
                      );
                    })}
                    {diff !== null && (
                      <td className={`py-2 px-4 text-right text-xs font-medium ${
                        (metric.higherIsBetter ? diff > 0 : diff < 0) ? 'text-emerald-600' :
                        (metric.higherIsBetter ? diff < 0 : diff > 0) ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff, metric.format)}
                      </td>
                    )}
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
