import React from 'react';
import { useWhatIf, useScenario } from '../../store/ScenarioContext';
import { formatShort } from '../../utils/formatters';

function SliderControl({ label, value, onChange, min, max, step, unit = '%', formatVal }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatVal?: (v: number) => string;
}) {
  const display = formatVal ? formatVal(value) : `${value > 0 ? '+' : ''}${value.toFixed(1)}${unit}`;
  const isNeutral = value === 0 || value === 1;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-app-text3 font-medium">{label}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${isNeutral ? 'text-app-text4' : 'text-app-accent'}`}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-[var(--app-accent)]"
      />
      <div className="flex justify-between text-[8px] text-app-text4 mt-0.5">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[9px] font-semibold uppercase tracking-widest text-app-text4 mt-3 mb-1.5 border-t border-app-border pt-2">
      {label}
    </div>
  );
}

export function WhatIfPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { adjustments, computed, isActive, setAdjustments, reset } = useWhatIf();
  const { activeComputed } = useScenario();

  if (!open) return null;

  const baseNW = activeComputed?.years[activeComputed.years.length - 1]?.accounts.netWorth ?? 0;
  const baseTax = activeComputed?.analytics.lifetimeTotalTax ?? 0;
  const baseAfterTax = activeComputed?.analytics.lifetimeAfterTaxIncome ?? 0;

  const wiNW = computed?.years[computed.years.length - 1]?.accounts.netWorth ?? baseNW;
  const wiTax = computed?.analytics.lifetimeTotalTax ?? baseTax;
  const wiAfterTax = computed?.analytics.lifetimeAfterTaxIncome ?? baseAfterTax;

  const diffNW = wiNW - baseNW;
  const diffTax = wiTax - baseTax;
  const diffAfterTax = wiAfterTax - baseAfterTax;

  return (
    <div className="w-[280px] shrink-0 bg-app-surface border-l border-app-border overflow-y-auto h-full">
      {/* Gradient accent bar */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-app-text2">What-If</span>
          {isActive && (
            <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <button
              onClick={reset}
              className="text-[10px] text-app-text4 hover:text-app-text2 transition-colors px-2 py-0.5 rounded bg-app-surface2"
            >
              Reset
            </button>
          )}
          <button
            onClick={onToggle}
            className="text-app-text4 hover:text-app-text2 transition-colors p-0.5"
            title="Close panel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-2">
        {/* Macro */}
        <SectionLabel label="Market & Macro" />
        <SliderControl
          label="Inflation"
          value={adjustments.inflationAdj * 100}
          onChange={v => setAdjustments({ inflationAdj: v / 100 })}
          min={-3} max={3} step={0.5}
        />
        <SliderControl
          label="Equity Return"
          value={adjustments.equityReturnAdj * 100}
          onChange={v => setAdjustments({ equityReturnAdj: v / 100 })}
          min={-5} max={5} step={0.5}
        />
        <SliderControl
          label="Fixed Income"
          value={adjustments.fixedIncomeReturnAdj * 100}
          onChange={v => setAdjustments({ fixedIncomeReturnAdj: v / 100 })}
          min={-3} max={3} step={0.5}
        />
        <SliderControl
          label="Cash Return"
          value={adjustments.cashReturnAdj * 100}
          onChange={v => setAdjustments({ cashReturnAdj: v / 100 })}
          min={-2} max={2} step={0.25}
        />
        <SliderControl
          label="Savings Return"
          value={adjustments.savingsReturnAdj * 100}
          onChange={v => setAdjustments({ savingsReturnAdj: v / 100 })}
          min={-2} max={2} step={0.25}
        />

        {/* Income */}
        <SectionLabel label="Income" />
        <SliderControl
          label="Income Scale"
          value={adjustments.incomeScaleFactor}
          onChange={v => setAdjustments({ incomeScaleFactor: v })}
          min={0.5} max={2.0} step={0.05}
          unit="x"
          formatVal={v => `${v.toFixed(2)}x`}
        />

        {/* Expenses / Contributions */}
        <SectionLabel label="Contributions" />
        <SliderControl
          label="Contribution Scale"
          value={adjustments.expenseScaleFactor}
          onChange={v => setAdjustments({ expenseScaleFactor: v })}
          min={0.5} max={2.0} step={0.05}
          unit="x"
          formatVal={v => `${v.toFixed(2)}x`}
        />

        {/* Strategy */}
        <SectionLabel label="Strategy" />
        <div className="flex gap-1 mb-3">
          {(['unchanged', 'maxRRSP', 'maxTFSA'] as const).map(s => (
            <button
              key={s}
              onClick={() => setAdjustments({ contributionStrategy: s })}
              className={`flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all ${
                adjustments.contributionStrategy === s
                  ? 'bg-app-accent text-white'
                  : 'bg-app-surface2 text-app-text3 hover:text-app-text2'
              }`}
            >
              {s === 'unchanged' ? 'As-Is' : s === 'maxRRSP' ? 'Max RRSP' : 'Max TFSA'}
            </button>
          ))}
        </div>

        {/* Tax Brackets */}
        <SectionLabel label="Tax Brackets" />
        <SliderControl
          label="Federal Bracket Shift"
          value={adjustments.federalBracketShift * 100}
          onChange={v => setAdjustments({ federalBracketShift: v / 100 })}
          min={-20} max={20} step={1}
        />
        <SliderControl
          label="Provincial Bracket Shift"
          value={adjustments.provBracketShift * 100}
          onChange={v => setAdjustments({ provBracketShift: v / 100 })}
          min={-20} max={20} step={1}
        />

        {/* Impact Summary */}
        {isActive && (
          <>
            <SectionLabel label="Impact Summary" />
            <div className="space-y-2">
              {[
                { label: 'Final Net Worth', val: wiNW, diff: diffNW, positive: diffNW >= 0 },
                { label: 'Lifetime Tax', val: wiTax, diff: diffTax, positive: diffTax <= 0 },
                { label: 'Lifetime After-Tax', val: wiAfterTax, diff: diffAfterTax, positive: diffAfterTax >= 0 },
              ].map(r => (
                <div key={r.label} className="bg-app-surface2 rounded-lg px-3 py-2">
                  <div className="text-[9px] text-app-text4 uppercase tracking-wider">{r.label}</div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-sm font-bold tabular-nums text-app-text">{formatShort(r.val)}</span>
                    <span className={`text-[11px] font-semibold tabular-nums ${r.positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {r.diff >= 0 ? '+' : ''}{formatShort(r.diff)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!isActive && (
          <div className="text-[10px] text-app-text4 text-center py-4 mt-2">
            Adjust sliders to see how changes affect your outcomes across all pages.
          </div>
        )}
      </div>
    </div>
  );
}
