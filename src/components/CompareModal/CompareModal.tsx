import React, { useState, useMemo } from 'react';
import { useScenario } from '../../store/ScenarioContext';
import { DiffTable } from './DiffTable';
import { OverlayCharts, SCENARIO_COLORS } from './OverlayCharts';
import { formatCAD, formatPct } from '../../utils/formatters';
import type { ComputedScenario, ComputedYear } from '../../types/computed';
import type { Scenario } from '../../types/scenario';

interface Props {
  onClose: () => void;
}

/* ── Shared helpers ─────────────────────────────────────── */

function getBestWorstIdx(values: number[], higherIsBetter: boolean): { best: number; worst: number } {
  let bestIdx = 0, worstIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherIsBetter ? values[i] > values[bestIdx] : values[i] < values[bestIdx]) bestIdx = i;
    if (higherIsBetter ? values[i] < values[worstIdx] : values[i] > values[worstIdx]) worstIdx = i;
  }
  return { best: bestIdx, worst: worstIdx };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-3">
      <div className="h-px flex-1 bg-app-border" />
      <div className="text-center shrink-0">
        <div className="text-[11px] font-semibold text-app-text uppercase tracking-wider">{title}</div>
        {subtitle && <div className="text-[10px] text-app-text4 mt-0.5">{subtitle}</div>}
      </div>
      <div className="h-px flex-1 bg-app-border" />
    </div>
  );
}

/* ── Transposed table (scenarios = rows, metrics = columns) ── */

interface MetricCol {
  label: string;
  values: number[];
  format: 'cad' | 'pct';
  higherIsBetter: boolean;
}

function TransposedTable({ scenarios, computed, metrics, title }: {
  scenarios: Scenario[];
  computed: ComputedScenario[];
  metrics: MetricCol[];
  title: string;
}) {
  const is2 = computed.length === 2;

  return (
    <div className="bg-app-surface border border-app-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-app-border bg-app-surface2/50">
        <span className="text-[10px] font-semibold text-app-text2 uppercase tracking-wide">{title}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-app-surface2 border-b border-app-border">
              <th className="sticky left-0 z-10 bg-app-surface2 py-2 px-3 text-left text-[10px] text-app-text3 font-semibold whitespace-nowrap w-0">Scenario</th>
              {metrics.map(m => (
                <th key={m.label} className="py-2 px-3 text-right text-[10px] text-app-text3 font-medium whitespace-nowrap">{m.label}</th>
              ))}
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
                  {metrics.map(m => {
                    const { best, worst } = getBestWorstIdx(m.values, m.higherIsBetter);
                    const showWinner = computed.length >= 2 && m.values[best] !== m.values[worst];
                    const isBest = showWinner && sIdx === best;
                    const isWorst = showWinner && sIdx === worst;
                    return (
                      <td key={m.label} className={`py-1.5 px-3 text-right tabular-nums text-xs ${isBest ? 'bg-emerald-50/60 text-emerald-700 font-semibold' : isWorst ? 'text-app-text3' : 'text-app-text2'}`}>
                        {m.format === 'pct' ? formatPct(m.values[sIdx]) : formatCAD(m.values[sIdx])}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Diff (2) or Spread (3+) */}
            <tr className="border-t-2 border-app-border bg-app-surface2">
              <td className="sticky left-0 z-10 bg-app-surface2 py-1.5 px-3 whitespace-nowrap border-r border-app-border">
                <span className="text-[10px] font-semibold text-app-text3 uppercase">{is2 ? 'Diff' : 'Spread'}</span>
                {!is2 && <span className="text-[9px] text-app-text4 ml-1">(max−min)</span>}
              </td>
              {metrics.map(m => {
                if (is2) {
                  const diff = m.values[1] - m.values[0];
                  const isGood = m.higherIsBetter ? diff > 0 : diff < 0;
                  return (
                    <td key={m.label} className="py-1.5 px-3 text-right text-xs">
                      <span className={`font-medium ${isGood ? 'text-emerald-600' : diff === 0 ? 'text-app-text4' : 'text-app-text3'}`}>
                        {diff >= 0 ? '+' : ''}{m.format === 'pct' ? formatPct(diff) : formatCAD(diff)}
                      </span>
                    </td>
                  );
                }
                const spread = Math.max(...m.values) - Math.min(...m.values);
                return (
                  <td key={m.label} className="py-1.5 px-3 text-right text-xs">
                    <span className={`font-medium ${spread === 0 ? 'text-app-text4' : 'text-app-text3'}`}>
                      {m.format === 'pct' ? formatPct(spread) : formatCAD(spread)}
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

/* ── Net Benefit insight bar ──────────────────────────────── */

function NetBenefitBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs">
      <span className="font-semibold text-app-text">Net Benefit: </span>
      {children}
    </div>
  );
}

/* ── Section: Lifetime Summary ────────────────────────────── */

function LifetimeSection({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const metricDefs: { label: string; fn: (c: ComputedScenario) => number; format: 'cad' | 'pct'; higherIsBetter: boolean }[] = [
    { label: 'Gross Income', fn: c => c.analytics.lifetimeGrossIncome, format: 'cad', higherIsBetter: true },
    { label: 'Total Tax', fn: c => c.analytics.lifetimeTotalTax, format: 'cad', higherIsBetter: false },
    { label: 'CPP + EI', fn: c => c.analytics.lifetimeCPPEI, format: 'cad', higherIsBetter: false },
    { label: 'After-Tax', fn: c => c.analytics.lifetimeAfterTaxIncome, format: 'cad', higherIsBetter: true },
    { label: 'Avg Tax %', fn: c => c.analytics.lifetimeAvgTaxRate, format: 'pct', higherIsBetter: false },
    { label: 'All-In %', fn: c => c.analytics.lifetimeAvgAllInRate, format: 'pct', higherIsBetter: false },
    { label: 'Net Cash Flow', fn: c => c.analytics.lifetimeCashFlow, format: 'cad', higherIsBetter: true },
    { label: 'Final NW', fn: c => c.years[c.years.length - 1]?.accounts.netWorth ?? 0, format: 'cad', higherIsBetter: true },
    { label: 'Real Final NW', fn: c => c.years[c.years.length - 1]?.realNetWorth ?? 0, format: 'cad', higherIsBetter: true },
  ];

  const metrics = metricDefs.map(d => ({
    label: d.label,
    values: computed.map(c => d.fn(c)),
    format: d.format,
    higherIsBetter: d.higherIsBetter,
  }));

  const netBenefit = useMemo(() => {
    if (computed.length < 2) return null;
    const afterTax = computed.map(c => c.analytics.lifetimeAfterTaxIncome);
    const nw = computed.map(c => c.years[c.years.length - 1]?.accounts.netWorth ?? 0);
    const atBest = afterTax.indexOf(Math.max(...afterTax));
    const nwBest = nw.indexOf(Math.max(...nw));
    const atDiff = afterTax[atBest] - Math.min(...afterTax);
    const nwDiff = nw[nwBest] - Math.min(...nw);
    if (atDiff === 0 && nwDiff === 0) return null;
    const bestIdx = atBest === nwBest ? atBest : atBest;
    return { bestIdx, atDiff, nwDiff: atBest === nwBest ? nwDiff : 0, name: scenarios[bestIdx]?.name ?? '' };
  }, [computed, scenarios]);

  return (
    <div className="space-y-3">
      <TransposedTable scenarios={scenarios} computed={computed} metrics={metrics} title="Lifetime Summary" />
      {netBenefit && (
        <NetBenefitBar>
          <span className="text-emerald-700 font-semibold">{netBenefit.name}</span>
          <span className="text-app-text2"> has </span>
          <span className="text-emerald-600 font-semibold">+{formatCAD(netBenefit.atDiff)}</span>
          <span className="text-app-text2"> more lifetime after-tax income</span>
          {netBenefit.nwDiff > 0 && (
            <>
              <span className="text-app-text2"> and </span>
              <span className="text-emerald-600 font-semibold">+{formatCAD(netBenefit.nwDiff)}</span>
              <span className="text-app-text2"> more final net worth</span>
            </>
          )}
        </NetBenefitBar>
      )}
    </div>
  );
}

/* ── Section: Year-by-Year Detail ─────────────────────────── */

function YearDetailSection({ scenarios, computed }: { scenarios: Scenario[]; computed: ComputedScenario[] }) {
  const [yearIdx, setYearIdx] = useState(0);
  const allYears = computed[0]?.years.map(y => y.year) ?? [];

  const taxDefs: { label: string; fn: (yr: ComputedYear) => number; format: 'cad' | 'pct'; higherIsBetter: boolean }[] = [
    { label: 'Gross Income', fn: yr => yr.waterfall.grossIncome, format: 'cad', higherIsBetter: true },
    { label: 'Net Taxable', fn: yr => yr.tax.netTaxableIncome, format: 'cad', higherIsBetter: false },
    { label: 'Fed Tax', fn: yr => yr.tax.federalTaxPayable, format: 'cad', higherIsBetter: false },
    { label: 'Prov Tax', fn: yr => yr.tax.provincialTaxPayable, format: 'cad', higherIsBetter: false },
    { label: 'Total Tax', fn: yr => yr.tax.totalIncomeTax, format: 'cad', higherIsBetter: false },
    { label: 'CPP', fn: yr => yr.cpp.totalCPPPaid, format: 'cad', higherIsBetter: false },
    { label: 'EI', fn: yr => yr.ei.totalEI, format: 'cad', higherIsBetter: false },
    { label: 'After-Tax', fn: yr => yr.waterfall.afterTaxIncome, format: 'cad', higherIsBetter: true },
    { label: 'Net CF', fn: yr => yr.waterfall.netCashFlow, format: 'cad', higherIsBetter: true },
    { label: 'Marginal %', fn: yr => yr.tax.marginalCombinedRate, format: 'pct', higherIsBetter: false },
    { label: 'Avg Tax %', fn: yr => yr.tax.avgIncomeTaxRate, format: 'pct', higherIsBetter: false },
    { label: 'All-In %', fn: yr => yr.tax.avgAllInRate, format: 'pct', higherIsBetter: false },
  ];

  const acctDefs: { label: string; fn: (yr: ComputedYear) => number; format: 'cad' | 'pct'; higherIsBetter: boolean }[] = [
    { label: 'RRSP', fn: yr => yr.accounts.rrspEOY, format: 'cad', higherIsBetter: true },
    { label: 'TFSA', fn: yr => yr.accounts.tfsaEOY, format: 'cad', higherIsBetter: true },
    { label: 'FHSA', fn: yr => yr.accounts.fhsaEOY, format: 'cad', higherIsBetter: true },
    { label: 'Non-Reg', fn: yr => yr.accounts.nonRegEOY, format: 'cad', higherIsBetter: true },
    { label: 'Savings', fn: yr => yr.accounts.savingsEOY, format: 'cad', higherIsBetter: true },
    { label: 'Net Worth', fn: yr => yr.accounts.netWorth, format: 'cad', higherIsBetter: true },
    { label: 'Real NW', fn: yr => yr.realNetWorth, format: 'cad', higherIsBetter: true },
    { label: 'RRSP Room', fn: yr => yr.rrspUnusedRoom, format: 'cad', higherIsBetter: true },
    { label: 'TFSA Room', fn: yr => yr.tfsaUnusedRoom, format: 'cad', higherIsBetter: true },
  ];

  const toMetrics = (defs: typeof taxDefs) => defs.map(d => ({
    label: d.label,
    values: computed.map(c => { const yr = c.years[yearIdx]; return yr ? d.fn(yr) : 0; }),
    format: d.format,
    higherIsBetter: d.higherIsBetter,
  }));

  const taxMetrics = toMetrics(taxDefs);
  const acctMetrics = toMetrics(acctDefs);

  return (
    <div className="space-y-3">
      {/* Year scrubber */}
      <div className="bg-app-surface border border-app-border rounded-lg px-3 py-2 flex items-center gap-3">
        <span className="text-xs text-app-text3 shrink-0 font-medium">Year:</span>
        <input
          type="range"
          min={0}
          max={allYears.length - 1}
          value={yearIdx}
          onChange={e => setYearIdx(Number(e.target.value))}
          className="flex-1 accent-[var(--app-accent)] h-1.5"
        />
        <span className="text-sm font-bold text-app-text tabular-nums w-12 text-center">{allYears[yearIdx] ?? ''}</span>
        <select
          className="text-xs border border-app-border rounded px-2 py-1 bg-app-surface text-app-text2"
          value={yearIdx}
          onChange={e => setYearIdx(Number(e.target.value))}
        >
          {allYears.map((y, i) => <option key={y} value={i}>{y}</option>)}
        </select>
      </div>

      {/* Tax + Accounts side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <TransposedTable scenarios={scenarios} computed={computed} metrics={taxMetrics} title="Tax Detail" />
        <TransposedTable scenarios={scenarios} computed={computed} metrics={acctMetrics} title="Accounts" />
      </div>
    </div>
  );
}

/* ── CSV Export ────────────────────────────────────────────── */

function exportCompareCSV(scenarios: Scenario[], computed: ComputedScenario[]) {
  if (computed.length === 0) return;
  const allYears = computed[0].years.map(y => y.year);
  const header = ['Year', ...scenarios.flatMap(sc => [
    `${sc.name} Net Worth`, `${sc.name} After-Tax`, `${sc.name} Total Tax`, `${sc.name} Net Cash Flow`,
  ])];
  const rows = allYears.map((year, yIdx) => {
    const vals = computed.flatMap(c => {
      const yr = c.years[yIdx];
      return yr ? [yr.accounts.netWorth, yr.waterfall.afterTaxIncome, yr.tax.totalIncomeTax, yr.waterfall.netCashFlow] : [0, 0, 0, 0];
    });
    return [year, ...vals.map(v => Math.round(v))];
  });
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compare_${scenarios.map(s => s.name).join('_vs_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Modal ───────────────────────────────────────────── */

export function CompareModal({ onClose }: Props) {
  const { state } = useScenario();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state.scenarios.slice(0, 2).map(s => s.id))
  );

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

  const paired = state.scenarios
    .filter(s => selected.has(s.id))
    .map(s => ({ scenario: s, computed: state.computed[s.id] }))
    .filter((p): p is { scenario: Scenario; computed: ComputedScenario } => !!p.computed);
  const selectedScenarios = paired.map(p => p.scenario);
  const selectedComputed = paired.map(p => p.computed);
  const ready = selectedComputed.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/40 backdrop-blur-sm">
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
            {ready && (
              <button
                onClick={() => exportCompareCSV(selectedScenarios, selectedComputed)}
                className="px-2.5 py-1 text-[10px] rounded border border-app-border bg-app-surface text-app-text3 hover:text-app-text hover:border-app-border2 transition-colors"
              >
                Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="text-app-text4 hover:text-app-text2 text-xl leading-none transition-colors ml-2"
            >&times;</button>
          </div>

          {/* Unified scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            {!ready ? (
              <div className="p-8 text-center text-app-text4 text-sm">
                Select at least 2 scenarios to compare.
              </div>
            ) : (
              <>
                {/* 1. Lifetime Summary */}
                <SectionHeader title="Lifetime Summary" subtitle="Totals across all projection years" />
                <LifetimeSection scenarios={selectedScenarios} computed={selectedComputed} />

                {/* 2. Year-by-Year Detail */}
                <SectionHeader title="Year-by-Year Detail" subtitle="Scrub through individual years" />
                <YearDetailSection scenarios={selectedScenarios} computed={selectedComputed} />

                {/* 3. Detailed Lifetime Metrics */}
                <SectionHeader title="Detailed Metrics" subtitle="Full breakdown by category" />
                <DiffTable scenarios={selectedScenarios} computed={selectedComputed} />

                {/* 4. Overlay Charts */}
                <SectionHeader title="Charts" subtitle="Visual trends over time" />
                <OverlayCharts scenarios={selectedScenarios} computed={selectedComputed} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
