import React from 'react';
import type { ComputedYear } from '../../../types/computed';
import { formatShort, formatPct } from '../../../utils/formatters';

interface Props {
  years: ComputedYear[];
}

export function YoYTable({ years }: Props) {
  if (!years.length) return null;

  const cols: { label: string; fn: (y: ComputedYear) => string; color?: string | ((y: ComputedYear) => string) }[] = [
    { label: 'Year', fn: y => String(y.year), color: 'text-app-text2 font-medium' },
    { label: 'Gross Income', fn: y => formatShort(y.waterfall.grossIncome), color: 'text-app-text' },
    { label: 'Net Taxable', fn: y => formatShort(y.tax.netTaxableIncome), color: 'text-app-text2' },
    { label: 'Fed Tax', fn: y => formatShort(y.tax.federalTaxPayable), color: 'text-red-600' },
    { label: 'Prov Tax', fn: y => formatShort(y.tax.provincialTaxPayable), color: 'text-red-600' },
    { label: 'CPP+EI', fn: y => formatShort(y.cpp.totalCPPPaid + y.ei.totalEI), color: 'text-amber-600' },
    { label: 'After-Tax', fn: y => formatShort(y.waterfall.afterTaxIncome), color: 'text-emerald-600' },
    {
      label: 'Net CF',
      fn: y => formatShort(y.waterfall.netCashFlow),
      color: (y: ComputedYear) => y.waterfall.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    { label: 'Marg Rate', fn: y => formatPct(y.tax.marginalCombinedRate), color: 'text-app-text3' },
    { label: 'Net Worth', fn: y => formatShort(y.accounts.netWorth), color: 'text-app-accent font-medium' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-app-surface2 border-b border-app-border">
            {cols.map(c => (
              <th key={c.label} className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 whitespace-nowrap uppercase tracking-wide">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((yr, i) => (
            <tr key={yr.year} className={`border-b border-app-border hover:bg-app-accent-light/40 transition-colors ${i % 2 === 1 ? 'bg-app-surface2/50' : ''}`}>
              {cols.map(c => {
                const colorVal = typeof c.color === 'function'
                  ? (c as { label: string; fn: (y: ComputedYear) => string; color: (y: ComputedYear) => string }).color(yr)
                  : c.color;
                return (
                  <td key={c.label} className={`py-1.5 px-3 whitespace-nowrap ${colorVal ?? 'text-app-text2'}`}>
                    {c.fn(yr)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
