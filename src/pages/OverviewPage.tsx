import React from 'react';
import { useScenario } from '../store/ScenarioContext';
import { formatShort, formatPct } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { NetWorthChart } from '../components/RightPanel/ChartsView/NetWorthChart';
import { TaxWaterfallChart } from '../components/RightPanel/ChartsView/TaxWaterfallChart';
import { IncomeBreakdownChart } from '../components/RightPanel/ChartsView/IncomeBreakdownChart';
import { CumulativeCashFlowChart } from '../components/RightPanel/ChartsView/CumulativeCashFlowChart';
import type { ComputedYear } from '../types/computed';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
      {title}
    </div>
  );
}

function KPIStat({ label, value, valueClass = 'text-slate-900' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-700">{title}</div>
      <div style={{ height: 220, padding: '12px 12px 8px' }}>
        {children}
      </div>
    </div>
  );
}

function getYoYCols(real: boolean): { label: string; fn: (y: ComputedYear) => string; cls?: string | ((y: ComputedYear) => string) }[] {
  const d = (v: number, y: ComputedYear) => real ? v / y.inflationFactor : v;
  return [
    { label: 'Year', fn: y => String(y.year), cls: 'text-slate-700 font-medium' },
    { label: real ? 'Real Gross' : 'Gross Income', fn: y => formatShort(real ? y.realGrossIncome : y.waterfall.grossIncome) },
    { label: 'Net Taxable', fn: y => formatShort(d(y.tax.netTaxableIncome, y)) },
    { label: 'Fed Tax', fn: y => formatShort(d(y.tax.federalTaxPayable, y)), cls: 'text-red-600' },
    { label: 'Prov Tax', fn: y => formatShort(d(y.tax.provincialTaxPayable, y)), cls: 'text-red-600' },
    { label: 'CPP+EI', fn: y => formatShort(d(y.cpp.totalCPPPaid + y.ei.totalEI, y)) },
    { label: real ? 'Real After-Tax' : 'After-Tax', fn: y => formatShort(real ? y.realAfterTaxIncome : y.waterfall.afterTaxIncome), cls: 'text-emerald-600' },
    {
      label: real ? 'Real CF' : 'Net CF',
      fn: y => formatShort(real ? y.realNetCashFlow : y.waterfall.netCashFlow),
      cls: (y: ComputedYear) => (real ? y.realNetCashFlow : y.waterfall.netCashFlow) >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    { label: 'Marg Rate', fn: y => formatPct(y.tax.marginalCombinedRate) },
    { label: real ? 'Real NW' : 'Net Worth', fn: y => formatShort(real ? y.realNetWorth : y.accounts.netWorth), cls: 'font-medium' },
  ];
}

export function OverviewPage() {
  const { activeComputed, activeScenario } = useScenario();
  const [realMode, setRealMode] = React.useState(false);

  if (!activeComputed || !activeScenario) {
    return <div className="p-8 text-slate-400 text-sm">No scenario data.</div>;
  }

  const years = activeComputed.years;
  const [selectedYearIdx, setSelectedYearIdx] = usePersistedYear(years.length - 1);
  const yr = years[selectedYearIdx] ?? years[years.length - 1];
  const analytics = activeComputed.analytics;

  if (!yr) return null;

  // When in real mode, deflate nominal values by the inflation factor
  const deflate = (v: number, y: ComputedYear) => realMode ? v / y.inflationFactor : v;

  const { tax, cpp, ei, waterfall, accounts } = yr;
  const grossIncome = realMode ? yr.realGrossIncome : waterfall.grossIncome;
  const afterTaxIncome = realMode ? yr.realAfterTaxIncome : waterfall.afterTaxIncome;
  const netWorth = realMode ? yr.realNetWorth : accounts.netWorth;
  const netCashFlow = realMode ? yr.realNetCashFlow : waterfall.netCashFlow;
  const warnings = years.flatMap(y => y.warnings.filter(w => w.severity === 'error'));

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-5 space-y-6">

        {/* Warnings banner */}
        {warnings.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="text-xs font-semibold text-red-700 mb-1">Validation Issues ({warnings.length})</div>
            <ul className="text-xs text-red-600 space-y-0.5">
              {warnings.slice(0, 3).map((w, i) => <li key={i}>• {w.message}</li>)}
              {warnings.length > 3 && <li className="text-slate-500">...and {warnings.length - 3} more</li>}
            </ul>
          </div>
        )}

        {/* Year selector + KPI strip */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Current Year Snapshot" />
            <div className="flex items-center gap-3">
              <div className="flex border border-slate-200 rounded overflow-hidden">
                <button
                  onClick={() => setRealMode(false)}
                  className={`px-3 py-1 text-xs transition-colors ${!realMode ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >Nominal</button>
                <button
                  onClick={() => setRealMode(true)}
                  className={`px-3 py-1 text-xs transition-colors ${realMode ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >Real</button>
              </div>
              <select
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none focus:border-blue-500"
                value={selectedYearIdx}
                onChange={e => setSelectedYearIdx(Number(e.target.value))}
              >
                {years.map((y, i) => (
                  <option key={y.year} value={i}>{y.year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI row 1 */}
          <div className="grid grid-cols-5 gap-6 pb-4 border-b border-slate-100">
            <KPIStat label={realMode ? "Real Gross Income" : "Gross Income"} value={formatShort(grossIncome)} />
            <KPIStat label="Net Taxable" value={formatShort(deflate(tax.netTaxableIncome, yr))} />
            <KPIStat label="Federal Tax" value={formatShort(deflate(tax.federalTaxPayable, yr))} valueClass="text-red-600" />
            <KPIStat label="Provincial Tax" value={formatShort(deflate(tax.provincialTaxPayable, yr))} valueClass="text-red-600" />
            <KPIStat label={realMode ? "Real After-Tax" : "After-Tax Income"} value={formatShort(afterTaxIncome)} valueClass="text-emerald-600" />
          </div>

          {/* KPI row 2 */}
          <div className="grid grid-cols-5 gap-6 pt-4">
            <KPIStat label="CPP + EI" value={formatShort(deflate(cpp.totalCPPPaid + ei.totalEI, yr))} />
            <KPIStat label="Total Tax+CPP+EI" value={formatShort(deflate(tax.totalIncomeTax + cpp.totalCPPPaid + ei.totalEI, yr))} valueClass="text-red-600" />
            <KPIStat label={realMode ? "Real Net CF" : "Net Cash Flow"} value={formatShort(netCashFlow)} valueClass={netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            <KPIStat label="Marginal Rate" value={formatPct(tax.marginalCombinedRate)} />
            <KPIStat label={realMode ? "Real Net Worth" : "Net Worth"} value={formatShort(netWorth)} />
          </div>
        </div>

        {/* Account balances strip */}
        <div>
          <SectionHeader title="Account Balances (EOY)" />
          <div className="grid grid-cols-5 gap-6">
            <KPIStat label="RRSP" value={formatShort(accounts.rrspEOY)} />
            <KPIStat label="TFSA" value={formatShort(accounts.tfsaEOY)} />
            <KPIStat label="FHSA" value={formatShort(accounts.fhsaEOY)} />
            <KPIStat label="Non-Registered" value={formatShort(accounts.nonRegEOY)} />
            <KPIStat label="Savings" value={formatShort(accounts.savingsEOY)} />
          </div>
        </div>

        {/* Contribution Room */}
        <div>
          <SectionHeader title="Contribution Room" />
          <div className="grid grid-cols-4 gap-6">
            <KPIStat label="RRSP Unused Room" value={formatShort(yr.rrspUnusedRoom)} />
            <KPIStat label="TFSA Unused Room" value={formatShort(yr.tfsaUnusedRoom)} />
            <KPIStat label="FHSA Unused Room" value={formatShort(yr.fhsaUnusedRoom)} />
            <KPIStat label="Capital Loss C/F" value={formatShort(yr.capitalLossCF)} />
          </div>
        </div>

        {/* 2×2 Charts */}
        <div>
          <SectionHeader title={realMode ? "Charts (Real / Inflation-Adjusted)" : "Charts"} />
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title={realMode ? "Real Net Worth Over Time" : "Net Worth Over Time"}>
              <NetWorthChart years={years} realMode={realMode} />
            </ChartCard>
            <ChartCard title="Tax Waterfall">
              <TaxWaterfallChart years={years} realMode={realMode} />
            </ChartCard>
            <ChartCard title="Income Breakdown">
              <IncomeBreakdownChart years={years} rawYears={activeScenario.years} />
            </ChartCard>
            <ChartCard title={realMode ? "Real Cash Flow" : "Cash Flow (Annual + Cumulative)"}>
              <CumulativeCashFlowChart computed={activeComputed} realMode={realMode} />
            </ChartCard>
          </div>
        </div>

        {/* Lifetime summary row */}
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Lifetime Summary</div>
          <div className="grid grid-cols-6 gap-6">
            <KPIStat label="Lifetime Gross" value={formatShort(analytics.lifetimeGrossIncome)} />
            <KPIStat label="Lifetime Tax" value={formatShort(analytics.lifetimeTotalTax)} valueClass="text-red-600" />
            <KPIStat label="Lifetime CPP+EI" value={formatShort(analytics.lifetimeCPPEI)} />
            <KPIStat label="Lifetime After-Tax" value={formatShort(analytics.lifetimeAfterTaxIncome)} valueClass="text-emerald-600" />
            <KPIStat label="Avg Tax Rate" value={formatPct(analytics.lifetimeAvgTaxRate)} />
            <KPIStat label="Avg All-In Rate" value={formatPct(analytics.lifetimeAvgAllInRate)} />
          </div>
        </div>

        {/* YoY Table */}
        <div>
          <SectionHeader title="Year-over-Year Summary" />
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {getYoYCols(realMode).map(c => (
                      <th key={c.label} className="py-2 px-3 text-left text-[10px] font-semibold text-slate-500 whitespace-nowrap uppercase tracking-wide">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((yr, i) => (
                    <tr
                      key={yr.year}
                      className={`border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                      onClick={() => setSelectedYearIdx(i)}
                    >
                      {getYoYCols(realMode).map(c => {
                        const cls = typeof c.cls === 'function' ? c.cls(yr) : (c.cls ?? 'text-slate-600');
                        return (
                          <td key={c.label} className={`py-1.5 px-3 whitespace-nowrap ${cls}`}>
                            {c.fn(yr)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
