import React, { useState } from 'react';
import { useWhatIf, useScenario } from '../../store/ScenarioContext';
import { DEFAULT_WHATIF } from '../../engine/whatIfEngine';
import { WHATIF_PRESETS } from '../../engine/whatIfPresets';
import { formatShort } from '../../utils/formatters';

/* ── Inline sub-components ────────────────────────────────── */

function SliderControl({ label, value, onChange, min, max, step, unit = '%', formatVal }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
  formatVal?: (v: number) => string;
}) {
  const display = formatVal ? formatVal(value) : `${value > 0 ? '+' : ''}${value.toFixed(1)}${unit}`;
  const isNeutral = value === 0 || value === 1;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-app-text3 font-medium">{label}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${isNeutral ? 'text-app-text4' : 'text-app-accent'}`}>
          {display}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-[var(--app-accent)]" />
      <div className="flex justify-between text-[8px] text-app-text4 mt-0.5">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1, prefix, suffix, placeholder, nullLabel }: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; placeholder?: string;
  nullLabel?: string;
}) {
  const isNull = value === null;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-app-text3 font-medium">{label}</span>
        {nullLabel && (
          <button onClick={() => onChange(isNull ? (min ?? 0) : null)}
            className={`text-[9px] px-1.5 py-0.5 rounded ${isNull ? 'bg-app-surface2 text-app-text4' : 'bg-app-accent/20 text-app-accent'}`}>
            {isNull ? nullLabel : 'Custom'}
          </button>
        )}
      </div>
      {!isNull && (
        <div className="flex items-center gap-1">
          {prefix && <span className="text-[10px] text-app-text4">{prefix}</span>}
          <input type="number" value={value ?? ''} min={min} max={max} step={step}
            placeholder={placeholder}
            onChange={e => {
              const raw = e.target.value;
              if (raw === '') { onChange(min ?? 0); return; }
              let v = Number(raw);
              if (min !== undefined) v = Math.max(min, v);
              if (max !== undefined) v = Math.min(max, v);
              onChange(v);
            }}
            className="flex-1 bg-app-surface2 border border-app-border rounded px-2 py-1 text-[11px] text-app-text tabular-nums focus:outline-none focus:border-app-accent" />
          {suffix && <span className="text-[10px] text-app-text4">{suffix}</span>}
        </div>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mb-2">
      <span className="text-[10px] text-app-text3 font-medium block mb-1">{label}</span>
      <div className="flex gap-0.5">
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`flex-1 text-[9px] py-1.5 rounded-lg font-medium transition-all ${
              value === o.value
                ? 'bg-app-accent text-white'
                : 'bg-app-surface2 text-app-text3 hover:text-app-text2'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxControl({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 mb-2 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="accent-[var(--app-accent)] w-3.5 h-3.5" />
      <span className="text-[10px] text-app-text3 group-hover:text-app-text2">{label}</span>
    </label>
  );
}

const SECTION_STATE_KEY = 'cdn-tax-whatif-sections';

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SECTION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSectionState(key: string, open: boolean) {
  try {
    const state = loadSectionState();
    state[key] = open;
    localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

function CollapsibleSection({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const storageKey = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const [open, setOpen] = useState(() => {
    const saved = loadSectionState();
    return saved[storageKey] !== undefined ? saved[storageKey] : defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    saveSectionState(storageKey, next);
  };

  return (
    <div className="border-t border-app-border">
      <button onClick={toggle}
        className="flex items-center justify-between w-full py-2 text-left group">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-app-text4 group-hover:text-app-text2">
          {title}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-app-text4 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function DeltaMetric({ label, baseVal, wiVal, higherIsBetter }: {
  label: string; baseVal: number; wiVal: number; higherIsBetter: boolean;
}) {
  const diff = wiVal - baseVal;
  const positive = higherIsBetter ? diff >= 0 : diff <= 0;
  return (
    <div className="bg-app-surface2 rounded-lg px-2.5 py-1.5">
      <div className="text-[8px] text-app-text4 uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline justify-between mt-0.5">
        <span className="text-[11px] font-bold tabular-nums text-app-text">{formatShort(wiVal)}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {diff >= 0 ? '+' : ''}{formatShort(diff)}
        </span>
      </div>
    </div>
  );
}

/* ── Main panel ───────────────────────────────────────────── */

export function WhatIfPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { adjustments, computed, isActive, setAdjustments, reset } = useWhatIf();
  const { activeComputed } = useScenario();

  if (!open) return null;

  const set = setAdjustments;

  // --- Impact metrics ---
  const lastBase = activeComputed?.years[activeComputed.years.length - 1];
  const lastWi = computed?.years[computed.years.length - 1];
  const baseNW = lastBase?.accounts.netWorth ?? 0;
  const baseTax = activeComputed?.analytics.lifetimeTotalTax ?? 0;
  const baseAfterTax = activeComputed?.analytics.lifetimeAfterTaxIncome ?? 0;
  const baseAvgRate = lastBase?.tax.avgAllInRate ?? 0;

  const wiNW = lastWi?.accounts.netWorth ?? baseNW;
  const wiTax = computed?.analytics.lifetimeTotalTax ?? baseTax;
  const wiAfterTax = computed?.analytics.lifetimeAfterTaxIncome ?? baseAfterTax;
  const wiAvgRate = lastWi?.tax.avgAllInRate ?? baseAvgRate;

  // Net worth peak year
  const basePeakYear = activeComputed
    ? activeComputed.years.reduce((best, y) => y.accounts.netWorth > best.nw ? { nw: y.accounts.netWorth, yr: y.year } : best, { nw: -Infinity, yr: 0 }).yr
    : 0;
  const wiPeakYear = computed
    ? computed.years.reduce((best, y) => y.accounts.netWorth > best.nw ? { nw: y.accounts.netWorth, yr: y.year } : best, { nw: -Infinity, yr: 0 }).yr
    : basePeakYear;

  return (
    <div className="w-[320px] shrink-0 bg-app-surface border-l border-app-border flex flex-col h-full">
      {/* Gradient accent bar */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
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
            <button onClick={reset}
              className="text-[10px] text-app-text4 hover:text-app-text2 transition-colors px-2 py-0.5 rounded bg-app-surface2">
              Reset
            </button>
          )}
          <button onClick={onToggle}
            className="text-app-text4 hover:text-app-text2 transition-colors p-0.5" title="Close panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Presets strip */}
      <div className="px-3 py-2 border-b border-app-border">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {WHATIF_PRESETS.map(p => (
            <button key={p.id}
              onClick={() => { reset(); setTimeout(() => set(p.adjustments), 0); }}
              title={p.description}
              className="shrink-0 text-[9px] px-2.5 py-1 rounded-full font-medium bg-app-surface2 text-app-text3 hover:bg-app-accent/20 hover:text-app-accent transition-all whitespace-nowrap">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-3">

        {/* 1. Market & Macro */}
        <CollapsibleSection title="Market & Macro" defaultOpen>
          <SliderControl label="Inflation" value={adjustments.inflationAdj * 100}
            onChange={v => set({ inflationAdj: v / 100 })} min={-3} max={3} step={0.5} />
          <SliderControl label="Equity Return" value={adjustments.equityReturnAdj * 100}
            onChange={v => set({ equityReturnAdj: v / 100 })} min={-15} max={10} step={0.5} />
          <SliderControl label="Fixed Income" value={adjustments.fixedIncomeReturnAdj * 100}
            onChange={v => set({ fixedIncomeReturnAdj: v / 100 })} min={-3} max={3} step={0.5} />
          <SliderControl label="Cash Return" value={adjustments.cashReturnAdj * 100}
            onChange={v => set({ cashReturnAdj: v / 100 })} min={-2} max={2} step={0.25} />
          <SliderControl label="Savings Return" value={adjustments.savingsReturnAdj * 100}
            onChange={v => set({ savingsReturnAdj: v / 100 })} min={-2} max={2} step={0.25} />
          <NumberInput label="Bear Market Year" value={adjustments.bearMarketYear}
            onChange={v => set({ bearMarketYear: v })} min={2020} max={2080} nullLabel="None" />
          {adjustments.bearMarketYear !== null && (
            <SliderControl label="Recovery Rate" value={adjustments.recoveryRate * 100}
              onChange={v => set({ recoveryRate: v / 100 })} min={0} max={40} step={1} />
          )}
        </CollapsibleSection>

        {/* 2. Income */}
        <CollapsibleSection title="Income" defaultOpen>
          <SliderControl label="Employment" value={adjustments.employmentIncomeScale}
            onChange={v => set({ employmentIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Self-Employment" value={adjustments.selfEmploymentIncomeScale}
            onChange={v => set({ selfEmploymentIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Dividends" value={adjustments.dividendIncomeScale}
            onChange={v => set({ dividendIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Interest" value={adjustments.interestIncomeScale}
            onChange={v => set({ interestIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Capital Gains" value={adjustments.capitalGainsScale}
            onChange={v => set({ capitalGainsScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Rental" value={adjustments.rentalIncomeScale}
            onChange={v => set({ rentalIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <SliderControl label="Pension" value={adjustments.pensionIncomeScale}
            onChange={v => set({ pensionIncomeScale: v })} min={0} max={3} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <NumberInput label="Retirement Start Year" value={adjustments.retirementStartYear}
            onChange={v => set({ retirementStartYear: v })} min={2020} max={2080} nullLabel="None" />
        </CollapsibleSection>

        {/* 3. Living Expenses */}
        <CollapsibleSection title="Living Expenses">
          <SliderControl label="Expense Scale" value={adjustments.livingExpenseScale}
            onChange={v => set({ livingExpenseScale: v })} min={0.5} max={2} step={0.05} unit="x"
            formatVal={v => `${v.toFixed(2)}x`} />
          <NumberInput label="Housing Delta" value={adjustments.housingExpenseAdj}
            onChange={v => set({ housingExpenseAdj: v ?? 0 })} min={-50000} max={50000} step={500}
            prefix="$" suffix="/yr" />
        </CollapsibleSection>

        {/* 4. Contributions & Withdrawals */}
        <CollapsibleSection title="Contributions & Withdrawals">
          <SliderControl label="RRSP Contribution" value={adjustments.rrspContribScale}
            onChange={v => set({ rrspContribScale: v })} min={0} max={3} step={0.1} unit="x"
            formatVal={v => `${v.toFixed(1)}x`} />
          <SliderControl label="TFSA Contribution" value={adjustments.tfsaContribScale}
            onChange={v => set({ tfsaContribScale: v })} min={0} max={3} step={0.1} unit="x"
            formatVal={v => `${v.toFixed(1)}x`} />
          <SliderControl label="Non-Reg Contribution" value={adjustments.nonRegContribScale}
            onChange={v => set({ nonRegContribScale: v })} min={0} max={3} step={0.1} unit="x"
            formatVal={v => `${v.toFixed(1)}x`} />
          <SliderControl label="Savings Deposit" value={adjustments.savingsDepositScale}
            onChange={v => set({ savingsDepositScale: v })} min={0} max={3} step={0.1} unit="x"
            formatVal={v => `${v.toFixed(1)}x`} />
          <NumberInput label="RRSP Withdrawal Delta" value={adjustments.rrspWithdrawalAdj}
            onChange={v => set({ rrspWithdrawalAdj: v ?? 0 })} min={-50000} max={100000} step={1000}
            prefix="$" suffix="/yr" />
          <NumberInput label="TFSA Withdrawal Delta" value={adjustments.tfsaWithdrawalAdj}
            onChange={v => set({ tfsaWithdrawalAdj: v ?? 0 })} min={-50000} max={100000} step={1000}
            prefix="$" suffix="/yr" />
          <ToggleGroup label="Strategy" value={adjustments.contributionStrategy}
            onChange={v => set({ contributionStrategy: v })}
            options={[
              { value: 'unchanged', label: 'As-Is' },
              { value: 'maxRRSP', label: 'Max RRSP' },
              { value: 'maxTFSA', label: 'Max TFSA' },
              { value: 'maxFHSA', label: 'Max FHSA' },
            ]} />
          <CheckboxControl label="Optimize RRSP deduction (claim full)"
            checked={adjustments.rrspDeductionOptimize}
            onChange={v => set({ rrspDeductionOptimize: v })} />
        </CollapsibleSection>

        {/* 5. Asset Allocation */}
        <CollapsibleSection title="Asset Allocation">
          <NumberInput label="All Accounts Equity %" value={adjustments.allAccountsEquityPct !== null ? Math.round(adjustments.allAccountsEquityPct * 100) : null}
            onChange={v => set({ allAccountsEquityPct: v !== null ? v / 100 : null })}
            min={0} max={100} step={5} suffix="%" nullLabel="Scenario" />
          {adjustments.allAccountsEquityPct !== null && (
            <div className="text-[9px] text-app-text4 mb-1">
              Fixed Income: {Math.round((1 - adjustments.allAccountsEquityPct) * 100)}% | Cash: 0%
            </div>
          )}
        </CollapsibleSection>

        {/* 6. Retirement & CPP/OAS */}
        <CollapsibleSection title="Retirement & CPP/OAS">
          <NumberInput label="CPP Start Age" value={adjustments.cppStartAgeOverride}
            onChange={v => set({ cppStartAgeOverride: v })} min={60} max={70} nullLabel="Scenario" />
          <NumberInput label="OAS Start Age" value={adjustments.oasStartAgeOverride}
            onChange={v => set({ oasStartAgeOverride: v })} min={65} max={70} nullLabel="Scenario" />
          <NumberInput label="CPP Monthly Amount" value={adjustments.cppMonthlyAmountOverride}
            onChange={v => set({ cppMonthlyAmountOverride: v })} min={0} max={2500} step={50}
            prefix="$" suffix="/mo" nullLabel="Scenario" />
          <NumberInput label="OAS Monthly Amount" value={adjustments.oasMonthlyAmountOverride}
            onChange={v => set({ oasMonthlyAmountOverride: v })} min={0} max={1500} step={50}
            prefix="$" suffix="/mo" nullLabel="Scenario" />
          <NumberInput label="RRIF Conversion Age" value={adjustments.rrifConversionAgeOverride}
            onChange={v => set({ rrifConversionAgeOverride: v })} min={65} max={71} nullLabel="Scenario" />
        </CollapsibleSection>

        {/* 7. Tax Policy */}
        <CollapsibleSection title="Tax Policy" defaultOpen>
          <SliderControl label="Federal Bracket Shift" value={adjustments.federalBracketShift * 100}
            onChange={v => set({ federalBracketShift: v / 100 })} min={-20} max={20} step={1} />
          <SliderControl label="Provincial Bracket Shift" value={adjustments.provBracketShift * 100}
            onChange={v => set({ provBracketShift: v / 100 })} min={-20} max={20} step={1} />
          <ToggleGroup label="CG Inclusion Rate" value={
            adjustments.capitalGainsInclusionRateOverride === null ? 'scenario'
            : adjustments.capitalGainsInclusionRateOverride === 0.5 ? '50'
            : '66.7'
          } onChange={v => set({
            capitalGainsInclusionRateOverride: v === 'scenario' ? null : v === '50' ? 0.5 : 0.6667,
          })} options={[
            { value: 'scenario', label: 'Scenario' },
            { value: '50', label: '50%' },
            { value: '66.7', label: '66.7%' },
          ]} />
          <CheckboxControl label="Disable tiered CG system"
            checked={adjustments.disableCGTiered}
            onChange={v => set({ disableCGTiered: v })} />
          <NumberInput label="OAS Clawback Threshold Delta" value={adjustments.oasClawbackThresholdAdj}
            onChange={v => set({ oasClawbackThresholdAdj: v ?? 0 })} min={-50000} max={50000} step={1000}
            prefix="$" />
          <NumberInput label="Federal BPA Override" value={adjustments.federalBPAOverride}
            onChange={v => set({ federalBPAOverride: v })} min={0} max={30000} step={100}
            prefix="$" nullLabel="Scenario" />
        </CollapsibleSection>

        {/* 8. Deductions & Credits */}
        <CollapsibleSection title="Deductions & Credits">
          <NumberInput label="Charitable Donations Delta" value={adjustments.charitableDonationsAdj}
            onChange={v => set({ charitableDonationsAdj: v ?? 0 })} min={-50000} max={100000} step={500}
            prefix="$" suffix="/yr" />
          <NumberInput label="Medical Expenses Delta" value={adjustments.medicalExpensesAdj}
            onChange={v => set({ medicalExpensesAdj: v ?? 0 })} min={-50000} max={100000} step={500}
            prefix="$" suffix="/yr" />
        </CollapsibleSection>

        {/* Inactive hint */}
        {!isActive && (
          <div className="text-[10px] text-app-text4 text-center py-4 mt-2">
            Adjust controls or pick a preset to see how changes affect your outcomes.
          </div>
        )}
      </div>

      {/* Sticky impact summary */}
      {isActive && (
        <div className="border-t border-app-border px-3 py-2 bg-app-surface space-y-1.5 shrink-0">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-app-text4 mb-1">Impact Summary</div>
          <DeltaMetric label="Final Net Worth" baseVal={baseNW} wiVal={wiNW} higherIsBetter />
          <DeltaMetric label="Lifetime Tax" baseVal={baseTax} wiVal={wiTax} higherIsBetter={false} />
          <DeltaMetric label="Lifetime After-Tax" baseVal={baseAfterTax} wiVal={wiAfterTax} higherIsBetter />
          <div className="flex gap-1.5">
            <div className="flex-1 bg-app-surface2 rounded-lg px-2 py-1.5">
              <div className="text-[8px] text-app-text4 uppercase tracking-wider">Avg All-In Rate</div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-[11px] font-bold tabular-nums text-app-text">{(wiAvgRate * 100).toFixed(1)}%</span>
                <span className={`text-[10px] font-semibold tabular-nums ${wiAvgRate <= baseAvgRate ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {((wiAvgRate - baseAvgRate) * 100) >= 0 ? '+' : ''}{((wiAvgRate - baseAvgRate) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex-1 bg-app-surface2 rounded-lg px-2 py-1.5">
              <div className="text-[8px] text-app-text4 uppercase tracking-wider">NW Peak Year</div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-[11px] font-bold tabular-nums text-app-text">{wiPeakYear || '—'}</span>
                {wiPeakYear !== basePeakYear && basePeakYear > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-app-text4">
                    was {basePeakYear}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
