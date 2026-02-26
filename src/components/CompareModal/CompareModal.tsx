import React, { useState } from 'react';
import { useScenario } from '../../store/ScenarioContext';
import { DiffTable } from './DiffTable';
import { OverlayCharts } from './OverlayCharts';
import { formatCAD, formatPct, formatShort } from '../../utils/formatters';
import type { ComputedScenario, ComputedYear } from '../../types/computed';
import type { Scenario } from '../../types/scenario';

const SCENARIO_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

type Tab = 'lifetime' | 'diff' | 'charts' | 'tax' | 'accounts';

interface Props {
  onClose: () => void;
}

function YearScrubber({ yearIdx, allYears, onChange }: {
  yearIdx: number;
  allYears: number[];
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs text-app-text3 shrink-0">Year:</span>
      <input
        type="range"
        min={0}
        max={allYears.length - 1}
        value={yearIdx}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--app-accent)] h-1.5"
      />
      <span className="text-xs font-semibold text-app-text tabular-nums w-10 text-center">{allYears[yearIdx] ?? ''}</span>
      <select
        className="text-xs border border-app-border rounded px-2 py-1 bg-app-surface text-app-text2"
        value={yearIdx}
        onChange={e => onChange(Number(e.target.value))}
      >
        {allYears.map((y, i) => <option key={y} value={i}>{y}</option>)}
      </select>
    </div>
  );
}

function getBestWorstIdx(values: number[], higherIsBetter: boolean): { best: number; worst: number } {
  let bestIdx = 0, worstIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherIsBetter ? values[i] > values[bestIdx] : values[i] < values[bestIdx]) bestIdx = i;
    if (higherIsBetter ? values[i] < values[worstIdx] : values[i] > values[worstIdx]) worstIdx = i;
  }
  return { best: bestIdx, worst: worstIdx };
}

function TaxCompareTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const [yearIdx, setYearIdx] = useState(0);
  const allYears = computed[0]?.years.map(y => y.year) ?? [];

  const rows: { label: string; fn: (yr: ComputedYear) => number; format: 'cad' | 'pct'; higherIsBetter: boolean }[] = [
    { label: 'Gross Income', fn: yr => yr.waterfall.grossIncome, format: 'cad', higherIsBetter: true },
    { label: 'Net Taxable Income', fn: yr => yr.tax.netTaxableIncome, format: 'cad', higherIsBetter: false },
    { label: 'Federal Tax Before Credits', fn: yr => yr.tax.federalTaxBeforeCredits, format: 'cad', higherIsBetter: false },
    { label: 'Federal Credits', fn: yr => yr.tax.federalCredits, format: 'cad', higherIsBetter: true },
    { label: 'Federal Tax Payable', fn: yr => yr.tax.federalTaxPayable, format: 'cad', higherIsBetter: false },
    { label: 'Provincial Tax Before Credits', fn: yr => yr.tax.provincialTaxBeforeCredits, format: 'cad', higherIsBetter: false },
    { label: 'Provincial Credits', fn: yr => yr.tax.provincialCredits, format: 'cad', higherIsBetter: true },
    { label: 'Provincial Tax Payable', fn: yr => yr.tax.provincialTaxPayable, format: 'cad', higherIsBetter: false },
    { label: 'Total Income Tax', fn: yr => yr.tax.totalIncomeTax, format: 'cad', higherIsBetter: false },
    { label: 'CPP Paid', fn: yr => yr.cpp.totalCPPPaid, format: 'cad', higherIsBetter: false },
    { label: 'EI Paid', fn: yr => yr.ei.totalEI, format: 'cad', higherIsBetter: false },
    { label: 'After-Tax Income', fn: yr => yr.waterfall.afterTaxIncome, format: 'cad', higherIsBetter: true },
    { label: 'Net Cash Flow', fn: yr => yr.waterfall.netCashFlow, format: 'cad', higherIsBetter: true },
    { label: 'Marginal Combined', fn: yr => yr.tax.marginalCombinedRate, format: 'pct', higherIsBetter: false },
    { label: 'Avg Tax Rate', fn: yr => yr.tax.avgIncomeTaxRate, format: 'pct', higherIsBetter: false },
    { label: 'Avg All-In Rate', fn: yr => yr.tax.avgAllInRate, format: 'pct', higherIsBetter: false },
  ];

  return (
    <div className="p-4">
      <YearScrubber yearIdx={yearIdx} allYears={allYears} onChange={setYearIdx} />

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="py-2 px-3 text-left text-[10px] text-app-text3 font-semibold w-48">Tax Metric</th>
              {scenarios.map((sc, i) => (
                <th key={sc.id} className="py-2 px-3 text-right text-[10px] text-app-text2 font-semibold">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                  {sc.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const values = computed.map(c => {
                const yr = c.years[yearIdx];
                return yr ? row.fn(yr) : 0;
              });
              const { best, worst } = getBestWorstIdx(values, row.higherIsBetter);
              const showWinner = computed.length >= 2 && values[best] !== values[worst];
              return (
                <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                  <td className="py-1.5 px-3 text-app-text2">{row.label}</td>
                  {computed.map((c, i) => {
                    const yr = c.years[yearIdx];
                    const isBest = showWinner && i === best;
                    const isWorst = showWinner && i === worst;
                    return (
                      <td key={i} className={`py-1.5 px-3 text-right text-app-text2 tabular-nums ${isBest ? 'bg-emerald-50 font-semibold text-emerald-700' : isWorst ? 'bg-red-50/50 text-red-600' : ''}`}>
                        {yr ? (row.format === 'pct' ? formatPct(row.fn(yr)) : formatCAD(row.fn(yr))) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Delta row */}
            {computed.length >= 2 && (
              <tr className="border-t-2 border-app-border bg-app-surface2">
                <td className="py-2 px-3 text-app-text3 font-semibold text-[10px] uppercase">Delta (max−min)</td>
                {computed.map((_, i) => {
                  if (i > 0) return <td key={i} />;
                  return (
                    <td key={i} colSpan={computed.length} className="py-2 px-3 text-right text-[10px] text-app-text4">
                      {rows.filter(r => r.format === 'cad').slice(0, 3).map(r => {
                        const vals = computed.map(c => { const yr = c.years[yearIdx]; return yr ? r.fn(yr) : 0; });
                        const delta = Math.max(...vals) - Math.min(...vals);
                        return `${r.label}: ${formatShort(delta)}`;
                      }).join(' · ')}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountsCompareTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const [yearIdx, setYearIdx] = useState(0);
  const allYears = computed[0]?.years.map(y => y.year) ?? [];

  const rows: { label: string; fn: (yr: ComputedYear) => number; format: 'cad' | 'pct'; higherIsBetter: boolean }[] = [
    { label: 'RRSP EOY', fn: yr => yr.accounts.rrspEOY, format: 'cad', higherIsBetter: true },
    { label: 'TFSA EOY', fn: yr => yr.accounts.tfsaEOY, format: 'cad', higherIsBetter: true },
    { label: 'FHSA EOY', fn: yr => yr.accounts.fhsaEOY, format: 'cad', higherIsBetter: true },
    { label: 'Non-Reg EOY', fn: yr => yr.accounts.nonRegEOY, format: 'cad', higherIsBetter: true },
    { label: 'Savings EOY', fn: yr => yr.accounts.savingsEOY, format: 'cad', higherIsBetter: true },
    { label: 'Net Worth', fn: yr => yr.accounts.netWorth, format: 'cad', higherIsBetter: true },
    { label: 'Real Net Worth', fn: yr => yr.realNetWorth, format: 'cad', higherIsBetter: true },
    { label: 'RRSP Return %', fn: yr => yr.accounts.rrspReturn, format: 'pct', higherIsBetter: true },
    { label: 'TFSA Return %', fn: yr => yr.accounts.tfsaReturn, format: 'pct', higherIsBetter: true },
    { label: 'RRSP Unused Room', fn: yr => yr.rrspUnusedRoom, format: 'cad', higherIsBetter: true },
    { label: 'TFSA Unused Room', fn: yr => yr.tfsaUnusedRoom, format: 'cad', higherIsBetter: true },
    { label: 'FHSA Lifetime Contrib', fn: yr => yr.fhsaContribLifetime, format: 'cad', higherIsBetter: true },
    { label: 'FHSA Unused Room', fn: yr => yr.fhsaUnusedRoom, format: 'cad', higherIsBetter: true },
    { label: 'Capital Loss C/F', fn: yr => yr.capitalLossCF, format: 'cad', higherIsBetter: false },
  ];

  return (
    <div className="p-4">
      <YearScrubber yearIdx={yearIdx} allYears={allYears} onChange={setYearIdx} />

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="py-2 px-3 text-left text-[10px] text-app-text3 font-semibold w-48">Account Metric</th>
              {scenarios.map((sc, i) => (
                <th key={sc.id} className="py-2 px-3 text-right text-[10px] text-app-text2 font-semibold">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                  {sc.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const values = computed.map(c => {
                const yr = c.years[yearIdx];
                return yr ? row.fn(yr) : 0;
              });
              const { best, worst } = getBestWorstIdx(values, row.higherIsBetter);
              const showWinner = computed.length >= 2 && values[best] !== values[worst];
              return (
                <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                  <td className="py-1.5 px-3 text-app-text2">{row.label}</td>
                  {computed.map((c, i) => {
                    const yr = c.years[yearIdx];
                    const isBest = showWinner && i === best;
                    const isWorst = showWinner && i === worst;
                    return (
                      <td key={i} className={`py-1.5 px-3 text-right text-app-text2 tabular-nums ${isBest ? 'bg-emerald-50 font-semibold text-emerald-700' : isWorst ? 'bg-red-50/50 text-red-600' : ''}`}>
                        {yr ? (row.format === 'pct' ? formatPct(row.fn(yr)) : formatCAD(row.fn(yr))) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LifetimeSummaryTab({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  interface MetricDef {
    label: string;
    rawFn: (c: ComputedScenario) => number;
    fmtFn: (c: ComputedScenario) => string;
    cls?: string;
    best?: 'min' | 'max';
  }

  const metrics: MetricDef[] = [
    { label: 'Lifetime Gross Income', rawFn: c => c.analytics.lifetimeGrossIncome, fmtFn: c => formatCAD(c.analytics.lifetimeGrossIncome) },
    { label: 'Lifetime Total Tax', rawFn: c => c.analytics.lifetimeTotalTax, fmtFn: c => formatCAD(c.analytics.lifetimeTotalTax), cls: 'text-red-600', best: 'min' },
    { label: 'Lifetime CPP + EI', rawFn: c => c.analytics.lifetimeCPPEI, fmtFn: c => formatCAD(c.analytics.lifetimeCPPEI), cls: 'text-amber-600' },
    { label: 'Lifetime After-Tax Income', rawFn: c => c.analytics.lifetimeAfterTaxIncome, fmtFn: c => formatCAD(c.analytics.lifetimeAfterTaxIncome), cls: 'text-emerald-600', best: 'max' },
    { label: 'Lifetime Avg Tax Rate', rawFn: c => c.analytics.lifetimeAvgTaxRate, fmtFn: c => formatPct(c.analytics.lifetimeAvgTaxRate), best: 'min' },
    { label: 'Lifetime Avg All-In Rate', rawFn: c => c.analytics.lifetimeAvgAllInRate, fmtFn: c => formatPct(c.analytics.lifetimeAvgAllInRate), best: 'min' },
    { label: 'Lifetime Net Cash Flow', rawFn: c => c.analytics.lifetimeCashFlow, fmtFn: c => formatCAD(c.analytics.lifetimeCashFlow) },
    { label: 'Final Net Worth', rawFn: c => c.years[c.years.length - 1]?.accounts.netWorth ?? 0, fmtFn: c => {
      const last = c.years[c.years.length - 1];
      return last ? formatCAD(last.accounts.netWorth) : '—';
    }, best: 'max' },
    { label: 'Final Real Net Worth', rawFn: c => c.years[c.years.length - 1]?.realNetWorth ?? 0, fmtFn: c => {
      const last = c.years[c.years.length - 1];
      return last ? formatCAD(last.realNetWorth) : '—';
    }, best: 'max' },
  ];

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {metrics.map(row => {
          const values = computed.map(c => row.rawFn(c));
          let bestIdx: number | null = null;
          let worstIdx: number | null = null;
          if (row.best && computed.length >= 2) {
            const target = row.best === 'min' ? Math.min(...values) : Math.max(...values);
            const worst = row.best === 'min' ? Math.max(...values) : Math.min(...values);
            bestIdx = values.indexOf(target);
            worstIdx = values.indexOf(worst);
            if (bestIdx === worstIdx) { bestIdx = null; worstIdx = null; }
          }

          const maxVal = Math.max(...values.map(Math.abs), 1);

          return (
            <div key={row.label} className="bg-app-surface border border-app-border rounded-lg p-3.5 hover:shadow-sm transition-shadow">
              <div className="text-[10px] text-app-text4 uppercase tracking-wider font-medium mb-2.5">{row.label}</div>
              <div className="space-y-1.5">
                {computed.map((c, i) => {
                  const isBest = i === bestIdx;
                  const isWorst = i === worstIdx;
                  const barPct = Math.abs(values[i]) / maxVal * 100;
                  return (
                    <div key={i} className={`flex items-center gap-2 rounded-md px-2 py-1 ${isBest ? 'border-l-2 border-emerald-500 bg-emerald-50/50' : isWorst ? 'border-l-2 border-red-300 bg-red-50/30' : ''}`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                      <span className="text-xs text-app-text3 truncate w-24 shrink-0">{scenarios[i]?.name}</span>
                      {computed.length >= 3 && (
                        <div className="flex-1 h-3 bg-app-surface2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barPct}%`, backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length], opacity: 0.6 }}
                          />
                        </div>
                      )}
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${row.cls ?? 'text-app-text'} ${isBest ? 'font-bold' : ''}`}>
                        {row.fmtFn(c)}
                      </span>
                      {isBest && (
                        <span className="text-[8px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">BEST</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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

  const allSelected = state.scenarios.every(s => selected.has(s.id));
  function toggleAll() {
    if (allSelected) {
      setSelected(new Set(state.scenarios.slice(0, 2).map(s => s.id)));
    } else {
      setSelected(new Set(state.scenarios.map(s => s.id)));
    }
  }

  // Pair scenarios with their computed data, then filter together to avoid index mismatch
  const paired = state.scenarios
    .filter(s => selected.has(s.id))
    .map(s => ({ scenario: s, computed: state.computed[s.id] }))
    .filter((p): p is { scenario: Scenario; computed: ComputedScenario } => !!p.computed);
  const selectedScenarios = paired.map(p => p.scenario);
  const selectedComputed = paired.map(p => p.computed);

  const TAB_LABELS: Record<Tab, string> = {
    lifetime: 'Lifetime Summary',
    diff: 'Metrics Diff',
    charts: 'Overlay Charts',
    tax: 'Tax Detail',
    accounts: 'Accounts',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/40 backdrop-blur-sm">
      {/* Top accent line */}
      <div className="w-full h-full flex">
        {/* Sidebar */}
        <div className="w-56 bg-app-surface border-r border-app-border flex flex-col shrink-0 shadow-lg">
          <div className="p-4 border-b border-app-border">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-app-text">Compare</h2>
              <span className="text-[10px] font-semibold bg-app-accent text-white rounded-full px-2 py-0.5">{selectedScenarios.length}</span>
            </div>
            <p className="text-xs text-app-text4 mt-0.5">Select 2+ to compare</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {state.scenarios.map((sc, i) => {
              const isChecked = selected.has(sc.id);
              return (
                <label
                  key={sc.id}
                  className={`flex items-center gap-2.5 cursor-pointer p-2 rounded-md transition-colors ${
                    isChecked ? 'bg-app-accent-light/50 border-l-2 border-app-accent' : 'hover:bg-app-surface2 border-l-2 border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(sc.id)}
                    className="accent-[var(--app-accent)] w-3.5 h-3.5"
                  />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                  <span className={`text-sm ${isChecked ? 'text-app-text font-medium' : 'text-app-text2'}`}>{sc.name}</span>
                </label>
              );
            })}
          </div>
          <div className="p-3 border-t border-app-border space-y-2">
            <button
              onClick={toggleAll}
              className="text-[10px] text-app-accent hover:text-app-accent/80 font-medium transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
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
          {/* Top accent bar */}
          <div className="h-0.5 bg-gradient-to-r from-app-accent via-app-accent/60 to-transparent shrink-0" />
          {/* Header */}
          <div className="flex items-center gap-4 px-5 py-2.5 bg-app-surface border-b border-app-border shrink-0 shadow-sm">
            <div className="flex-1 text-sm font-semibold text-app-text">
              Comparing: {selectedScenarios.map(s => s.name).join(' vs ')}
            </div>
            <div className="flex gap-0">
              {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === t
                      ? 'border-app-accent text-app-accent'
                      : 'border-transparent text-app-text3 hover:text-app-text2 hover:border-app-border'
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-app-text4 hover:text-app-text2 text-xl leading-none transition-colors ml-2"
            >&times;</button>
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
