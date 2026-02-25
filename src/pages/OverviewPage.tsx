import React, { useState } from 'react';
import { useScenario } from '../store/ScenarioContext';
import { formatShort, formatPct } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { NetWorthChart } from '../components/RightPanel/ChartsView/NetWorthChart';
import { TaxWaterfallChart } from '../components/RightPanel/ChartsView/TaxWaterfallChart';
import { IncomeBreakdownChart } from '../components/RightPanel/ChartsView/IncomeBreakdownChart';
import { CumulativeCashFlowChart } from '../components/RightPanel/ChartsView/CumulativeCashFlowChart';
import { ChartRangeSelector, sliceByRange } from '../components/ChartRangeSelector';
import type { ChartRange } from '../components/ChartRangeSelector';
import type { ComputedYear } from '../types/computed';

type ViewMode = 'nominal' | 'real' | 'diff';

function KPI({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[11px] text-slate-500 truncate">{label}</span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${cls ?? 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function DiffKPI({ label, nominal, real }: { label: string; nominal: number; real: number }) {
  const diff = nominal - real;
  const erosion = nominal !== 0 ? diff / nominal : 0;
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[11px] text-slate-500 truncate">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] tabular-nums text-slate-400">{formatShort(nominal)}</span>
        <span className="text-[10px] text-slate-300">/</span>
        <span className="text-[10px] tabular-nums text-blue-500">{formatShort(real)}</span>
        {diff > 0 && <span className="text-[9px] tabular-nums text-orange-500">-{formatPct(erosion)}</span>}
      </div>
    </div>
  );
}

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</div>
        {badge}
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {children}
      </div>
    </div>
  );
}


function ChartCard({ title, range, onRangeChange, children }: {
  title: string;
  range: ChartRange;
  onRangeChange: (v: ChartRange) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <ChartRangeSelector value={range} onChange={onRangeChange} />
      </div>
      <div style={{ height: 220, padding: '12px 12px 8px' }}>
        {children}
      </div>
    </div>
  );
}

function getYoYCols(mode: ViewMode): { label: string; fn: (y: ComputedYear) => string; cls?: string | ((y: ComputedYear) => string) }[] {
  const real = mode === 'real';
  const diff = mode === 'diff';
  const d = (v: number, y: ComputedYear) => real ? v / y.inflationFactor : v;

  if (diff) {
    // Diff mode: show nominal | real | erosion %
    return [
      { label: 'Year', fn: y => String(y.year), cls: 'text-slate-700 font-medium' },
      { label: 'Gross (Nom)', fn: y => formatShort(y.waterfall.grossIncome) },
      { label: 'Gross (Real)', fn: y => formatShort(y.realGrossIncome), cls: 'text-blue-600' },
      { label: 'After-Tax (Nom)', fn: y => formatShort(y.waterfall.afterTaxIncome), cls: 'text-emerald-600' },
      { label: 'After-Tax (Real)', fn: y => formatShort(y.realAfterTaxIncome), cls: 'text-blue-600' },
      { label: 'NW (Nom)', fn: y => formatShort(y.accounts.netWorth), cls: 'font-medium' },
      { label: 'NW (Real)', fn: y => formatShort(y.realNetWorth), cls: 'text-blue-600 font-medium' },
      { label: 'Erosion', fn: y => {
        const factor = y.inflationFactor;
        return factor > 1 ? `-${formatPct(1 - 1/factor)}` : '0%';
      }, cls: 'text-orange-500' },
      { label: 'Inflate ×', fn: y => y.inflationFactor.toFixed(3), cls: 'text-slate-400' },
    ];
  }

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

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'nominal', label: 'Nominal' },
  { value: 'real', label: 'Real' },
  { value: 'diff', label: 'Diff' },
];

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem('cdn-tax-real-mode');
    if (v === 'diff') return 'diff';
    return v === '1' ? 'real' : 'nominal';
  } catch { return 'nominal'; }
}

export function OverviewPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { activeComputed, activeScenario } = useScenario();
  const [viewMode, setViewModeRaw] = useState<ViewMode>(loadViewMode);
  function setViewMode(v: ViewMode) {
    setViewModeRaw(v);
    try { localStorage.setItem('cdn-tax-real-mode', v === 'real' ? '1' : v === 'diff' ? 'diff' : '0'); } catch {}
  }
  const realMode = viewMode === 'real';
  const diffMode = viewMode === 'diff';
  const [chartRange, setChartRange] = useState<ChartRange>('all');

  if (!activeComputed || !activeScenario) {
    return <div className="p-8 text-slate-400 text-sm">No scenario data.</div>;
  }

  const years = activeComputed.years;
  const [selectedYearIdx, setSelectedYearIdx] = usePersistedYear(years.length - 1);
  const yr = years[selectedYearIdx] ?? years[years.length - 1];
  const analytics = activeComputed.analytics;

  if (!yr) return null;

  const deflate = (v: number, y: ComputedYear) => realMode ? v / y.inflationFactor : v;
  const { tax, cpp, ei, waterfall, accounts } = yr;
  const grossIncome = realMode ? yr.realGrossIncome : waterfall.grossIncome;
  const afterTaxIncome = realMode ? yr.realAfterTaxIncome : waterfall.afterTaxIncome;
  const netWorth = realMode ? yr.realNetWorth : accounts.netWorth;
  const netCashFlow = realMode ? yr.realNetCashFlow : waterfall.netCashFlow;
  const warnings = years.flatMap(y => y.warnings.filter(w => w.severity === 'error'));

  const chartYears = sliceByRange(years, chartRange);
  const chartRawYears = sliceByRange(activeScenario.years, chartRange);
  const chartComputed = {
    ...activeComputed,
    years: chartYears,
    analytics: {
      ...activeComputed.analytics,
      annualCashFlow: sliceByRange(analytics.annualCashFlow, chartRange),
      cumulativeCashFlow: sliceByRange(analytics.cumulativeCashFlow, chartRange),
      cumulativeRealCashFlow: sliceByRange(analytics.cumulativeRealCashFlow, chartRange),
    },
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">

        {/* Warnings banner */}
        {warnings.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-red-700">Validation Issues ({warnings.length})</div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('scheduling')}
                  className="text-[11px] text-red-600 hover:text-red-800 underline underline-offset-2 transition-colors"
                >
                  View all in Scheduling
                </button>
              )}
            </div>
            <ul className="text-xs text-red-600 space-y-0.5">
              {warnings.slice(0, 5).map((w, i) => <li key={i}>- {w.message}</li>)}
              {warnings.length > 5 && <li className="text-slate-500">...and {warnings.length - 5} more</li>}
            </ul>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex border border-slate-200 rounded overflow-hidden">
            {VIEW_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setViewMode(m.value)}
                className={`px-3 py-1 text-xs transition-colors ${viewMode === m.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >{m.label}</button>
            ))}
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

        {/* 3-column cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Card 1: Current Year Snapshot */}
          <Card title="Current Year Snapshot" badge={
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{yr.year}</span>
          }>
            {diffMode ? (
              <>
                <DiffKPI label="Gross Income" nominal={waterfall.grossIncome} real={yr.realGrossIncome} />
                <DiffKPI label="Net Taxable" nominal={tax.netTaxableIncome} real={tax.netTaxableIncome / yr.inflationFactor} />
                <DiffKPI label="Federal Tax" nominal={tax.federalTaxPayable} real={tax.federalTaxPayable / yr.inflationFactor} />
                <DiffKPI label="Provincial Tax" nominal={tax.provincialTaxPayable} real={tax.provincialTaxPayable / yr.inflationFactor} />
                <DiffKPI label="CPP + EI" nominal={cpp.totalCPPPaid + ei.totalEI} real={(cpp.totalCPPPaid + ei.totalEI) / yr.inflationFactor} />
                <DiffKPI label="After-Tax" nominal={waterfall.afterTaxIncome} real={yr.realAfterTaxIncome} />
                <div className="border-t border-slate-100 pt-1.5 mt-0.5" />
                <DiffKPI label="Net Cash Flow" nominal={waterfall.netCashFlow} real={yr.realNetCashFlow} />
                <KPI label="Inflation Factor" value={`${yr.inflationFactor.toFixed(3)}×`} cls="text-orange-500" />
              </>
            ) : (
              <>
                <KPI label={realMode ? 'Real Gross Income' : 'Gross Income'} value={formatShort(grossIncome)} />
                <KPI label="Net Taxable Income" value={formatShort(deflate(tax.netTaxableIncome, yr))} />
                <KPI label="Federal Tax" value={formatShort(deflate(tax.federalTaxPayable, yr))} cls="text-red-600" />
                <KPI label="Provincial Tax" value={formatShort(deflate(tax.provincialTaxPayable, yr))} cls="text-red-600" />
                <KPI label="CPP + EI" value={formatShort(deflate(cpp.totalCPPPaid + ei.totalEI, yr))} />
                <KPI label={realMode ? 'Real After-Tax' : 'After-Tax Income'} value={formatShort(afterTaxIncome)} cls="text-emerald-600" />
                <div className="border-t border-slate-100 pt-1.5 mt-0.5" />
                <KPI label={realMode ? 'Real Net Cash Flow' : 'Net Cash Flow'} value={formatShort(netCashFlow)} cls={netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                <KPI label="Marginal Rate" value={formatPct(tax.marginalCombinedRate)} />
                <KPI label="Avg All-In Rate" value={formatPct(tax.avgAllInRate)} />
              </>
            )}
          </Card>

          {/* Card 2: Account Balances (EOY) */}
          <Card title="Account Balances (EOY)" badge={
            <span className="text-[10px] font-medium text-slate-500">{formatShort(accounts.netWorth)} NW</span>
          }>
            {diffMode ? (
              <>
                <KPI label="RRSP" value={formatShort(accounts.rrspEOY)} />
                <KPI label="TFSA" value={formatShort(accounts.tfsaEOY)} />
                <KPI label="FHSA" value={formatShort(accounts.fhsaEOY)} />
                <KPI label="Non-Registered" value={formatShort(accounts.nonRegEOY)} />
                <KPI label="Savings" value={formatShort(accounts.savingsEOY)} />
                <div className="border-t border-slate-100 pt-1.5 mt-0.5" />
                <DiffKPI label="Net Worth" nominal={accounts.netWorth} real={yr.realNetWorth} />
              </>
            ) : (
              <>
                <KPI label="RRSP" value={formatShort(accounts.rrspEOY)} />
                <KPI label="TFSA" value={formatShort(accounts.tfsaEOY)} />
                <KPI label="FHSA" value={formatShort(accounts.fhsaEOY)} />
                <KPI label="Non-Registered" value={formatShort(accounts.nonRegEOY)} />
                <KPI label="Savings" value={formatShort(accounts.savingsEOY)} />
                <div className="border-t border-slate-100 pt-1.5 mt-0.5" />
                <KPI label={realMode ? 'Real Net Worth' : 'Net Worth'} value={formatShort(netWorth)} cls="font-bold" />
              </>
            )}
          </Card>

          {/* Card 3: Contribution Room */}
          <Card title="Contribution Room">
            <KPI label="RRSP Unused Room" value={formatShort(yr.rrspUnusedRoom)} />
            <KPI label="TFSA Unused Room" value={formatShort(yr.tfsaUnusedRoom)} />
            <KPI label="FHSA Unused Room" value={formatShort(yr.fhsaUnusedRoom)} />
            <KPI label="Capital Loss C/F" value={formatShort(yr.capitalLossCF)} />
            <div className="border-t border-slate-100 pt-1.5 mt-0.5" />
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Lifetime</div>
            <KPI label="Lifetime Tax" value={formatShort(analytics.lifetimeTotalTax)} cls="text-red-600" />
            <KPI label="Lifetime After-Tax" value={formatShort(analytics.lifetimeAfterTaxIncome)} cls="text-emerald-600" />
            <KPI label="Avg Tax Rate" value={formatPct(analytics.lifetimeAvgTaxRate)} />
          </Card>
        </div>

        {/* 2x2 Charts with time range controls */}
        <div className="grid grid-cols-2 gap-4">
          <ChartCard
            title={realMode ? 'Real Net Worth Over Time' : 'Net Worth Over Time'}
            range={chartRange}
            onRangeChange={setChartRange}
          >
            <NetWorthChart years={chartYears} realMode={realMode} />
          </ChartCard>
          <ChartCard
            title="Tax Waterfall"
            range={chartRange}
            onRangeChange={setChartRange}
          >
            <TaxWaterfallChart years={chartYears} realMode={realMode} />
          </ChartCard>
          <ChartCard
            title="Income Breakdown"
            range={chartRange}
            onRangeChange={setChartRange}
          >
            <IncomeBreakdownChart years={chartYears} rawYears={chartRawYears} />
          </ChartCard>
          <ChartCard
            title={realMode ? 'Real Cash Flow' : 'Cash Flow (Annual + Cumulative)'}
            range={chartRange}
            onRangeChange={setChartRange}
          >
            <CumulativeCashFlowChart computed={chartComputed} realMode={realMode} />
          </ChartCard>
        </div>

        {/* YoY Table */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
            Year-over-Year Summary {diffMode && <span className="text-orange-500 normal-case font-normal">— Nominal vs Real (inflation erosion)</span>}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {getYoYCols(viewMode).map(c => (
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
                      {getYoYCols(viewMode).map(c => {
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
