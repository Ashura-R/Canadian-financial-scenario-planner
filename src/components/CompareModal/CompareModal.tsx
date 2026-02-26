import React, { useState } from 'react';
import { useScenario } from '../../store/ScenarioContext';
import { DiffTable } from './DiffTable';
import { OverlayCharts } from './OverlayCharts';
import { formatCAD, formatPct } from '../../utils/formatters';
import type { ComputedScenario, ComputedYear } from '../../types/computed';
import type { Scenario } from '../../types/scenario';

type Tab = 'lifetime' | 'diff' | 'charts' | 'tax' | 'accounts';

interface Props {
  onClose: () => void;
}

function TaxCompareTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const maxYears = Math.max(...computed.map(c => c.years.length));
  const [yearIdx, setYearIdx] = useState(0);
  const allYears = computed[0]?.years.map(y => y.year) ?? [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-app-text3">Year:</span>
        <select
          className="text-xs border border-app-border rounded px-2 py-1 bg-app-surface text-app-text2"
          value={yearIdx}
          onChange={e => setYearIdx(Number(e.target.value))}
        >
          {allYears.map((y, i) => <option key={y} value={i}>{y}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="py-2 px-3 text-left text-[10px] text-app-text3 font-semibold w-48">Tax Metric</th>
              {scenarios.map(sc => (
                <th key={sc.id} className="py-2 px-3 text-right text-[10px] text-app-text2 font-semibold">{sc.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Gross Income', fn: (yr: ComputedYear) => formatCAD(yr.waterfall.grossIncome) },
              { label: 'Net Taxable Income', fn: (yr: ComputedYear) => formatCAD(yr.tax.netTaxableIncome) },
              { label: 'Federal Tax Before Credits', fn: (yr: ComputedYear) => formatCAD(yr.tax.federalTaxBeforeCredits) },
              { label: 'Federal Credits', fn: (yr: ComputedYear) => formatCAD(yr.tax.federalCredits) },
              { label: 'Federal Tax Payable', fn: (yr: ComputedYear) => formatCAD(yr.tax.federalTaxPayable) },
              { label: 'Provincial Tax Before Credits', fn: (yr: ComputedYear) => formatCAD(yr.tax.provincialTaxBeforeCredits) },
              { label: 'Provincial Credits', fn: (yr: ComputedYear) => formatCAD(yr.tax.provincialCredits) },
              { label: 'Provincial Tax Payable', fn: (yr: ComputedYear) => formatCAD(yr.tax.provincialTaxPayable) },
              { label: 'Total Income Tax', fn: (yr: ComputedYear) => formatCAD(yr.tax.totalIncomeTax) },
              { label: 'CPP Paid', fn: (yr: ComputedYear) => formatCAD(yr.cpp.totalCPPPaid) },
              { label: 'EI Paid', fn: (yr: ComputedYear) => formatCAD(yr.ei.totalEI) },
              { label: 'After-Tax Income', fn: (yr: ComputedYear) => formatCAD(yr.waterfall.afterTaxIncome) },
              { label: 'Net Cash Flow', fn: (yr: ComputedYear) => formatCAD(yr.waterfall.netCashFlow) },
              { label: 'Marginal Combined', fn: (yr: ComputedYear) => formatPct(yr.tax.marginalCombinedRate) },
              { label: 'Avg Tax Rate', fn: (yr: ComputedYear) => formatPct(yr.tax.avgIncomeTaxRate) },
              { label: 'Avg All-In Rate', fn: (yr: ComputedYear) => formatPct(yr.tax.avgAllInRate) },
            ].map(row => (
              <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                <td className="py-1.5 px-3 text-app-text2">{row.label}</td>
                {computed.map((c, i) => {
                  const yr = c.years[yearIdx];
                  return (
                    <td key={i} className="py-1.5 px-3 text-right text-app-text2">
                      {yr ? row.fn(yr) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountsCompareTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const [yearIdx, setYearIdx] = useState(0);
  const allYears = computed[0]?.years.map(y => y.year) ?? [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-app-text3">Year:</span>
        <select
          className="text-xs border border-app-border rounded px-2 py-1 bg-app-surface text-app-text2"
          value={yearIdx}
          onChange={e => setYearIdx(Number(e.target.value))}
        >
          {allYears.map((y, i) => <option key={y} value={i}>{y}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="py-2 px-3 text-left text-[10px] text-app-text3 font-semibold w-48">Account Metric</th>
              {scenarios.map(sc => (
                <th key={sc.id} className="py-2 px-3 text-right text-[10px] text-app-text2 font-semibold">{sc.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'RRSP EOY', fn: (yr: ComputedYear) => formatCAD(yr.accounts.rrspEOY) },
              { label: 'TFSA EOY', fn: (yr: ComputedYear) => formatCAD(yr.accounts.tfsaEOY) },
              { label: 'FHSA EOY', fn: (yr: ComputedYear) => formatCAD(yr.accounts.fhsaEOY) },
              { label: 'Non-Reg EOY', fn: (yr: ComputedYear) => formatCAD(yr.accounts.nonRegEOY) },
              { label: 'Savings EOY', fn: (yr: ComputedYear) => formatCAD(yr.accounts.savingsEOY) },
              { label: 'Net Worth', fn: (yr: ComputedYear) => formatCAD(yr.accounts.netWorth) },
              { label: 'Real Net Worth', fn: (yr: ComputedYear) => formatCAD(yr.realNetWorth) },
              { label: 'RRSP Return %', fn: (yr: ComputedYear) => formatPct(yr.accounts.rrspReturn) },
              { label: 'TFSA Return %', fn: (yr: ComputedYear) => formatPct(yr.accounts.tfsaReturn) },
              { label: 'RRSP Unused Room', fn: (yr: ComputedYear) => formatCAD(yr.rrspUnusedRoom) },
              { label: 'TFSA Unused Room', fn: (yr: ComputedYear) => formatCAD(yr.tfsaUnusedRoom) },
              { label: 'FHSA Lifetime Contrib', fn: (yr: ComputedYear) => formatCAD(yr.fhsaContribLifetime) },
              { label: 'FHSA Unused Room', fn: (yr: ComputedYear) => formatCAD(yr.fhsaUnusedRoom) },
              { label: 'Capital Loss C/F', fn: (yr: ComputedYear) => formatCAD(yr.capitalLossCF) },
            ].map(row => (
              <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                <td className="py-1.5 px-3 text-app-text2">{row.label}</td>
                {computed.map((c, i) => {
                  const yr = c.years[yearIdx];
                  return (
                    <td key={i} className="py-1.5 px-3 text-right text-app-text2">
                      {yr ? row.fn(yr) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LifetimeSummaryTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const metrics: { label: string; fn: (c: ComputedScenario) => string; cls?: string; best?: 'min' | 'max' }[] = [
    { label: 'Lifetime Gross Income', fn: c => formatCAD(c.analytics.lifetimeGrossIncome) },
    { label: 'Lifetime Total Tax', fn: c => formatCAD(c.analytics.lifetimeTotalTax), cls: 'text-red-600', best: 'min' },
    { label: 'Lifetime CPP + EI', fn: c => formatCAD(c.analytics.lifetimeCPPEI), cls: 'text-amber-600' },
    { label: 'Lifetime After-Tax Income', fn: c => formatCAD(c.analytics.lifetimeAfterTaxIncome), cls: 'text-emerald-600', best: 'max' },
    { label: 'Lifetime Avg Tax Rate', fn: c => formatPct(c.analytics.lifetimeAvgTaxRate), best: 'min' },
    { label: 'Lifetime Avg All-In Rate', fn: c => formatPct(c.analytics.lifetimeAvgAllInRate), best: 'min' },
    { label: 'Lifetime Net Cash Flow', fn: c => formatCAD(c.analytics.lifetimeCashFlow) },
    { label: 'Final Net Worth', fn: c => {
      const last = c.years[c.years.length - 1];
      return last ? formatCAD(last.accounts.netWorth) : '—';
    }, best: 'max' },
    { label: 'Final Real Net Worth', fn: c => {
      const last = c.years[c.years.length - 1];
      return last ? formatCAD(last.realNetWorth) : '—';
    }, best: 'max' },
  ];

  // Determine best scenario per metric
  function getBestIdx(metric: typeof metrics[number]): number | null {
    if (!metric.best) return null;
    const vals = computed.map(c => {
      const last = c.years[c.years.length - 1];
      if (metric.label.includes('Final Net Worth')) return last?.accounts.netWorth ?? 0;
      if (metric.label.includes('Final Real')) return last?.realNetWorth ?? 0;
      if (metric.label.includes('Total Tax')) return c.analytics.lifetimeTotalTax;
      if (metric.label.includes('After-Tax')) return c.analytics.lifetimeAfterTaxIncome;
      if (metric.label.includes('Avg Tax Rate')) return c.analytics.lifetimeAvgTaxRate;
      if (metric.label.includes('All-In')) return c.analytics.lifetimeAvgAllInRate;
      return 0;
    });
    const target = metric.best === 'min' ? Math.min(...vals) : Math.max(...vals);
    return vals.indexOf(target);
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="py-2.5 px-3 text-left text-[10px] text-app-text3 font-semibold w-52">Lifetime Metric</th>
              {scenarios.map(sc => (
                <th key={sc.id} className="py-2.5 px-3 text-right text-[10px] text-app-text2 font-semibold">{sc.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(row => {
              const bestIdx = getBestIdx(row);
              return (
                <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                  <td className="py-2 px-3 text-app-text2 font-medium">{row.label}</td>
                  {computed.map((c, i) => (
                    <td key={i} className={`py-2 px-3 text-right tabular-nums ${row.cls ?? 'text-app-text2'} ${i === bestIdx ? 'font-bold bg-app-accent-light' : ''}`}>
                      {row.fn(c)}
                      {i === bestIdx && <span className="ml-1 text-[8px] text-emerald-600 font-bold">BEST</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompareModal({ onClose }: Props) {
  const { state } = useScenario();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state.scenarios.slice(0, 2).map(s => s.id))
  );
  const [tab, setTab] = useState<Tab>('lifetime');

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedScenarios = state.scenarios.filter(s => selected.has(s.id));
  const selectedComputed = selectedScenarios.map(s => state.computed[s.id]).filter(Boolean);

  const TAB_LABELS: Record<Tab, string> = {
    lifetime: 'Lifetime Summary',
    diff: 'Metrics Diff',
    charts: 'Overlay Charts',
    tax: 'Tax Detail',
    accounts: 'Accounts',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/40 backdrop-blur-sm">
      <div className="w-full h-full flex">
        {/* Sidebar */}
        <div className="w-52 bg-app-surface border-r border-app-border flex flex-col shrink-0 shadow-lg">
          <div className="p-4 border-b border-app-border">
            <h2 className="text-sm font-bold text-app-text">Compare Scenarios</h2>
            <p className="text-xs text-app-text4 mt-0.5">Select 2+ to compare</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {state.scenarios.map(sc => (
              <label key={sc.id} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md hover:bg-app-surface2 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(sc.id)}
                  onChange={() => toggle(sc.id)}
                  className="accent-[var(--app-accent)] w-3.5 h-3.5"
                />
                <span className="text-sm text-app-text2">{sc.name}</span>
              </label>
            ))}
          </div>
          <div className="p-3 border-t border-app-border">
            <div className="text-xs text-app-text4 mb-2">{selectedScenarios.length} selected</div>
            <button
              onClick={onClose}
              className="w-full py-1.5 text-xs rounded border border-app-border bg-app-surface2 text-app-text2 hover:bg-app-surface2 hover:text-app-text transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col bg-app-surface2 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 px-5 py-3 bg-app-surface border-b border-app-border shrink-0">
            <div className="flex-1 text-sm font-semibold text-app-text">
              Comparing: {selectedScenarios.map(s => s.name).join(' vs ')}
            </div>
            <div className="flex gap-1">
              {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-xs rounded border transition-colors ${
                    tab === t
                      ? 'bg-app-accent border-app-accent text-white'
                      : 'bg-app-surface border-app-border text-app-text2 hover:bg-app-surface2 hover:text-app-text'
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-app-text4 hover:text-app-text2 text-xl leading-none transition-colors"
            >×</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedComputed.length < 2 ? (
              <div className="p-8 text-center text-app-text4 text-sm">
                Select at least 2 scenarios to compare.
              </div>
            ) : tab === 'lifetime' ? (
              <LifetimeSummaryTab scenarios={selectedScenarios} computed={selectedComputed} />
            ) : tab === 'diff' ? (
              <DiffTable scenarios={selectedScenarios} computed={selectedComputed} />
            ) : tab === 'charts' ? (
              <OverlayCharts scenarios={selectedScenarios} computed={selectedComputed} />
            ) : tab === 'tax' ? (
              <TaxCompareTab scenarios={selectedScenarios} computed={selectedComputed} />
            ) : (
              <AccountsCompareTab scenarios={selectedScenarios} computed={selectedComputed} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
