import React, { useState, createContext, useContext } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import { PROVINCIAL_BRACKETS, PROVINCIAL_BPA, PROVINCIAL_DIV_CREDITS, DEFAULT_ASSUMPTIONS, makeDefaultYear } from '../store/defaults';
import { formatCAD } from '../utils/formatters';
import type { Province, TaxBracket, Assumptions, FHSADisposition, OpeningCarryForwards, ACBConfig, Liability, LiabilityType, AssumptionOverrides } from '../types/scenario';
import { resolveAssumptions } from '../engine/assumptionResolver';

const PROVINCES: { code: Province; label: string }[] = [
  { code: 'AB', label: 'Alberta' }, { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' }, { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland & Labrador' }, { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' }, { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' }, { code: 'PE', label: 'PEI' },
  { code: 'QC', label: 'Quebec' }, { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
];

type SettingsTab = 'general' | 'tax' | 'accounts' | 'retirement';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'tax', label: 'Tax & Deductions' },
  { id: 'accounts', label: 'Accounts & Balances' },
  { id: 'retirement', label: 'Retirement' },
];

const SETTINGS_TAB_KEY = 'cdn-tax-settings-tab';
function loadTab(): SettingsTab {
  try {
    const v = localStorage.getItem(SETTINGS_TAB_KEY) as SettingsTab | null;
    return v && TABS.some(t => t.id === v) ? v : 'general';
  } catch { return 'general'; }
}

// Context so nested inputs know if their section is locked
const LockedCtx = createContext(false);

type LockKey = 'cpp' | 'ei' | 'dividends' | 'fedBrackets' | 'provBrackets' | 'limits';

const inputCls = "w-full text-right text-sm bg-app-surface border border-app-border rounded px-2 py-1 text-app-text outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent-light transition-colors disabled:bg-app-surface2 disabled:cursor-not-allowed";
const selectCls = "w-full text-sm bg-app-surface border border-app-border rounded px-2 py-1 text-app-text outline-none focus:border-app-accent transition-colors";

/* ─── Shared sub-components ─── */

function Section({ title, children, lockKey, locked, showConfirm, onRequestUnlock, onConfirmUnlock, onCancelUnlock, onLock, onReset }: {
  title: string; children: React.ReactNode;
  lockKey?: LockKey; locked?: boolean; showConfirm?: boolean;
  onRequestUnlock?: () => void; onConfirmUnlock?: () => void; onCancelUnlock?: () => void;
  onLock?: () => void; onReset?: () => void;
}) {
  const isLockable = lockKey !== undefined;
  return (
    <LockedCtx.Provider value={locked ?? false}>
      <div className="mb-6 last:mb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text3">{title}</h3>
          {isLockable && (
            <div className="flex items-center gap-2">
              {!locked && onReset && (
                <button onClick={onReset} className="text-[10px] text-app-text4 hover:text-amber-600 transition-colors">
                  Reset defaults
                </button>
              )}
              <button
                onClick={locked ? onRequestUnlock : onLock}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  locked
                    ? 'border-app-border text-app-text4 hover:text-app-text2 hover:border-app-border2 bg-app-surface2'
                    : 'border-amber-200 text-amber-600 hover:bg-amber-50 bg-amber-50/50'
                }`}
              >
                {locked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
          )}
        </div>
        {showConfirm && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-between gap-3">
            <span className="text-[11px] text-amber-700">These are CRA regulatory defaults — override with caution.</span>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={onCancelUnlock} className="text-[11px] px-2 py-0.5 rounded border border-app-border text-app-text2 hover:bg-app-surface2 transition-colors">Cancel</button>
              <button onClick={onConfirmUnlock} className="text-[11px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors">Unlock</button>
            </div>
          </div>
        )}
        <div className={`transition-opacity ${locked ? 'opacity-60' : ''}`}>
          {children}
        </div>
      </div>
    </LockedCtx.Provider>
  );
}

function Divider() {
  return <div className="border-t border-app-border my-6" />;
}

function FormRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-app-border last:border-0">
      <div className="flex flex-col mr-4 shrink-0">
        <label className="text-sm text-app-text2">{label}</label>
        {hint && <span className="text-[10px] text-app-text4">{hint}</span>}
      </div>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  );
}

function SubHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-app-text4 pt-3 pb-1 first:pt-0">
      {title}
    </div>
  );
}

function NumInput({ value, onChange, pct = false, step }: {
  value: number; onChange: (v: number) => void; pct?: boolean; step?: number;
}) {
  const locked = useContext(LockedCtx);
  return (
    <input
      type="number"
      disabled={locked}
      step={step ?? (pct ? 0.01 : 1)}
      className={inputCls}
      value={pct ? (value * 100).toFixed(2) : String(value)}
      onChange={e => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onChange(pct ? n / 100 : n);
      }}
    />
  );
}

function BracketTable({ brackets, onChange }: {
  brackets: TaxBracket[];
  onChange: (b: TaxBracket[]) => void;
}) {
  const locked = useContext(LockedCtx);
  function updateB(i: number, field: keyof TaxBracket, raw: string) {
    const updated = brackets.map((b, idx) => {
      if (idx !== i) return b;
      if (field === 'rate') return { ...b, rate: parseFloat(raw) / 100 || 0 };
      if (field === 'max') return { ...b, max: raw === '' || raw === 'null' ? null : parseFloat(raw) || 0 };
      if (field === 'min') return { ...b, min: parseFloat(raw) || 0 };
      return b;
    });
    onChange(updated);
  }
  const cellCls = "border border-app-border text-[11px] text-right px-1.5 py-1 bg-app-surface text-app-text2 outline-none focus:border-app-accent w-full rounded disabled:bg-app-surface2 disabled:cursor-not-allowed";
  return (
    <table className="w-full text-xs mt-1">
      <thead>
        <tr>
          <th className="text-left pb-1 text-[10px] font-medium text-app-text4 pr-1">Min</th>
          <th className="text-left pb-1 text-[10px] font-medium text-app-text4 pr-1">Max</th>
          <th className="text-left pb-1 text-[10px] font-medium text-app-text4">Rate %</th>
        </tr>
      </thead>
      <tbody>
        {brackets.map((b, i) => (
          <tr key={i}>
            <td className="pr-1 py-0.5"><input disabled={locked} className={cellCls} type="number" value={b.min} onChange={e => updateB(i, 'min', e.target.value)} /></td>
            <td className="pr-1 py-0.5"><input disabled={locked} className={cellCls} type="number" value={b.max ?? ''} placeholder="∞" onChange={e => updateB(i, 'max', e.target.value)} /></td>
            <td className="py-0.5"><input disabled={locked} className={cellCls} type="number" step="0.01" value={(b.rate * 100).toFixed(4)} onChange={e => updateB(i, 'rate', e.target.value)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BalanceRow({ label, color, value, onChange }: { label: string; color: string; value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  function start() { setEditing(true); setRaw(String(value)); }
  function commit() {
    const n = parseFloat(raw.replace(/[$,\s]/g, ''));
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-app-border last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-app-text2">{label}</span>
      </div>
      {editing ? (
        <input
          autoFocus
          className="w-36 text-right text-sm bg-app-surface border border-app-accent rounded px-2 py-1 text-app-text outline-none"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <span
          className="text-sm text-app-text font-medium cursor-pointer hover:text-app-accent transition-colors"
          onClick={start}
          title="Click to edit"
        >
          {formatCAD(value)}
        </span>
      )}
    </div>
  );
}

/* ─── Override Parameter Options ─── */

type OverrideParamGroup = { label: string; params: { key: keyof AssumptionOverrides; label: string; isPct?: boolean }[] };

const OVERRIDE_PARAM_GROUPS: OverrideParamGroup[] = [
  {
    label: 'Tax',
    params: [
      { key: 'federalBPA', label: 'Federal BPA' },
      { key: 'provincialBPA', label: 'Provincial BPA' },
      { key: 'capitalGainsInclusionRate', label: 'CG Inclusion Rate', isPct: true },
    ],
  },
  {
    label: 'CPP',
    params: [
      { key: 'cppBasicExemption', label: 'Basic Exemption' },
      { key: 'cppYmpe', label: 'YMPE' },
      { key: 'cppYampe', label: 'YAMPE' },
      { key: 'cppEmployeeRate', label: 'Employee Rate', isPct: true },
      { key: 'cppCpp2Rate', label: 'CPP2 Rate', isPct: true },
    ],
  },
  {
    label: 'EI',
    params: [
      { key: 'eiMaxInsurableEarnings', label: 'Max Insurable Earnings' },
      { key: 'eiEmployeeRate', label: 'Employee Rate', isPct: true },
    ],
  },
  {
    label: 'Limits',
    params: [
      { key: 'rrspLimit', label: 'RRSP Limit' },
      { key: 'tfsaAnnualLimit', label: 'TFSA Annual Limit' },
      { key: 'fhsaAnnualLimit', label: 'FHSA Annual Limit' },
      { key: 'fhsaLifetimeLimit', label: 'FHSA Lifetime Limit' },
    ],
  },
  {
    label: 'Rates',
    params: [
      { key: 'dividendEligibleGrossUp', label: 'Eligible Div Gross-Up', isPct: true },
      { key: 'dividendEligibleFederalCredit', label: 'Eligible Div Fed Credit', isPct: true },
      { key: 'dividendEligibleProvincialCredit', label: 'Eligible Div Prov Credit', isPct: true },
      { key: 'dividendNonEligibleGrossUp', label: 'Non-Elig Div Gross-Up', isPct: true },
      { key: 'dividendNonEligibleFederalCredit', label: 'Non-Elig Div Fed Credit', isPct: true },
      { key: 'dividendNonEligibleProvincialCredit', label: 'Non-Elig Div Prov Credit', isPct: true },
      { key: 'oasClawbackThreshold', label: 'OAS Clawback Threshold' },
      { key: 'inflationRate', label: 'Inflation Rate', isPct: true },
    ],
  },
];

const ALL_OVERRIDE_PARAMS = OVERRIDE_PARAM_GROUPS.flatMap(g => g.params);

function OverrideManager({ scenario, dispatch }: {
  scenario: import('../types/scenario').Scenario;
  dispatch: React.Dispatch<any>;
}) {
  const [addYear, setAddYear] = useState<number>(scenario.assumptions.startYear);
  const [addParam, setAddParam] = useState<keyof AssumptionOverrides>('federalBPA');
  const [addValue, setAddValue] = useState('');

  const overrides = scenario.assumptionOverrides ?? {};
  const ass = scenario.assumptions;
  const startYear = ass.startYear;
  const endYear = startYear + ass.numYears - 1;

  // Collect all override entries as flat list
  const entries: { year: number; field: keyof AssumptionOverrides; value: any }[] = [];
  for (const [yr, ov] of Object.entries(overrides)) {
    for (const [k, v] of Object.entries(ov)) {
      if (v !== undefined) entries.push({ year: Number(yr), field: k as keyof AssumptionOverrides, value: v });
    }
  }
  entries.sort((a, b) => a.year - b.year || a.field.localeCompare(b.field));

  function handleAdd() {
    const paramInfo = ALL_OVERRIDE_PARAMS.find(p => p.key === addParam);
    const num = parseFloat(addValue);
    if (isNaN(num)) return;
    const val = paramInfo?.isPct ? num / 100 : num;
    dispatch({ type: 'SET_ASSUMPTION_OVERRIDE', year: addYear, overrides: { [addParam]: val } });
    setAddValue('');
  }

  function handleDelete(year: number, field: keyof AssumptionOverrides) {
    dispatch({ type: 'DELETE_ASSUMPTION_OVERRIDE', year, field });
  }

  function getIndexedValue(year: number, field: keyof AssumptionOverrides): string | null {
    if (ass.autoIndexAssumptions === false) return null;
    const yearsElapsed = year - startYear;
    if (yearsElapsed <= 0) return null;
    const factor = Math.pow(1 + ass.inflationRate, yearsElapsed);
    const resolved = resolveAssumptions(ass, year, factor);
    // Map field to resolved value
    const map: Partial<Record<keyof AssumptionOverrides, number>> = {
      federalBPA: resolved.federalBPA,
      provincialBPA: resolved.provincialBPA,
      cppBasicExemption: resolved.cpp.basicExemption,
      cppYmpe: resolved.cpp.ympe,
      cppYampe: resolved.cpp.yampe,
      cppEmployeeRate: resolved.cpp.employeeRate,
      cppCpp2Rate: resolved.cpp.cpp2Rate,
      eiMaxInsurableEarnings: resolved.ei.maxInsurableEarnings,
      eiEmployeeRate: resolved.ei.employeeRate,
      rrspLimit: resolved.rrspLimit,
      tfsaAnnualLimit: resolved.tfsaAnnualLimit,
      fhsaAnnualLimit: resolved.fhsaAnnualLimit,
      fhsaLifetimeLimit: resolved.fhsaLifetimeLimit,
      capitalGainsInclusionRate: resolved.capitalGainsInclusionRate,
      dividendEligibleGrossUp: resolved.dividendRates.eligible.grossUp,
      dividendEligibleFederalCredit: resolved.dividendRates.eligible.federalCredit,
      dividendEligibleProvincialCredit: resolved.dividendRates.eligible.provincialCredit,
      dividendNonEligibleGrossUp: resolved.dividendRates.nonEligible.grossUp,
      dividendNonEligibleFederalCredit: resolved.dividendRates.nonEligible.federalCredit,
      dividendNonEligibleProvincialCredit: resolved.dividendRates.nonEligible.provincialCredit,
      oasClawbackThreshold: resolved.oasClawbackThreshold,
      inflationRate: resolved.inflationRate,
    };
    const v = map[field];
    if (v === undefined) return null;
    const paramInfo = ALL_OVERRIDE_PARAMS.find(p => p.key === field);
    return paramInfo?.isPct ? `${(v * 100).toFixed(2)}%` : formatCAD(v);
  }

  function formatOverrideValue(value: any, field: keyof AssumptionOverrides): string {
    const paramInfo = ALL_OVERRIDE_PARAMS.find(p => p.key === field);
    if (paramInfo?.isPct) return `${(value * 100).toFixed(2)}%`;
    return formatCAD(value);
  }

  // Count overrides per year for summary
  const yearCounts = Object.entries(overrides)
    .filter(([, ov]) => Object.values(ov).some(v => v !== undefined))
    .map(([yr, ov]) => ({ year: Number(yr), count: Object.values(ov).filter(v => v !== undefined).length }))
    .sort((a, b) => a.year - b.year);

  return (
    <Section title="Year-Specific Parameter Overrides">
      <div className="text-[11px] text-app-text4 mb-3">
        Override any assumption parameter for a specific year. Overrides replace auto-indexed values.
      </div>

      {yearCounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {yearCounts.map(({ year, count }) => (
            <span key={year} className="text-[10px] px-2 py-0.5 rounded-full bg-app-accent/10 text-app-accent border border-app-accent/20">
              {year}: {count} override{count > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Existing overrides table */}
      {entries.length > 0 && (
        <div className="mb-4 border border-app-border rounded-lg overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-app-surface2 text-app-text3">
                <th className="text-left px-2 py-1.5 font-medium">Year</th>
                <th className="text-left px-2 py-1.5 font-medium">Parameter</th>
                <th className="text-right px-2 py-1.5 font-medium">Override</th>
                <th className="text-right px-2 py-1.5 font-medium">Indexed</th>
                <th className="w-8 px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const paramLabel = ALL_OVERRIDE_PARAMS.find(p => p.key === e.field)?.label ?? e.field;
                const indexed = getIndexedValue(e.year, e.field);
                return (
                  <tr key={`${e.year}-${e.field}-${i}`} className="border-t border-app-border hover:bg-app-surface2/50">
                    <td className="px-2 py-1.5 text-app-text2">{e.year}</td>
                    <td className="px-2 py-1.5 text-app-text2">{paramLabel}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-app-text">{formatOverrideValue(e.value, e.field)}</td>
                    <td className="px-2 py-1.5 text-right text-app-text4">{indexed ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleDelete(e.year, e.field)}
                        className="text-app-text4 hover:text-red-500 transition-colors"
                        title="Remove override"
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add override form */}
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="block text-[10px] text-app-text4 mb-0.5">Year</label>
          <select
            className={selectCls + ' !w-20 !text-[11px]'}
            value={addYear}
            onChange={e => setAddYear(Number(e.target.value))}
          >
            {Array.from({ length: ass.numYears }, (_, i) => startYear + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] text-app-text4 mb-0.5">Parameter</label>
          <select
            className={selectCls + ' !text-[11px]'}
            value={addParam}
            onChange={e => setAddParam(e.target.value as keyof AssumptionOverrides)}
          >
            {OVERRIDE_PARAM_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.params.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-app-text4 mb-0.5">
            Value {ALL_OVERRIDE_PARAMS.find(p => p.key === addParam)?.isPct ? '(%)' : '($)'}
          </label>
          <input
            type="number"
            className={inputCls + ' !w-28 !text-[11px]'}
            value={addValue}
            onChange={e => setAddValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="0"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!addValue || isNaN(parseFloat(addValue))}
          className="px-3 py-1 text-[11px] rounded bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </Section>
  );
}

/* ─── Main Page ─── */

export function AssumptionsPage() {
  const { activeScenario, dispatch } = useScenario();
  const update = useUpdateScenario();

  const [tab, setTabRaw] = useState<SettingsTab>(loadTab);
  function setTab(t: SettingsTab) { setTabRaw(t); try { localStorage.setItem(SETTINGS_TAB_KEY, t); } catch {} }

  // Lock state
  const [unlocked, setUnlocked] = useState<Set<LockKey>>(new Set());
  const [confirmKey, setConfirmKey] = useState<LockKey | null>(null);

  if (!activeScenario) return null;
  const ass = activeScenario.assumptions;
  const ob = activeScenario.openingBalances;

  function isLocked(k: LockKey) { return !unlocked.has(k); }
  function requestUnlock(k: LockKey) { setConfirmKey(k); }
  function confirmUnlock() {
    if (confirmKey) { setUnlocked(prev => new Set([...prev, confirmKey])); setConfirmKey(null); }
  }
  function cancelUnlock() { setConfirmKey(null); }
  function lockCard(k: LockKey) { setUnlocked(prev => { const n = new Set(prev); n.delete(k); return n; }); }

  const DEFAULT_RET = { cppBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 }, oasBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 }, rrifConversionAge: 71 };
  function getRet(a: Assumptions) { return a.retirement ?? DEFAULT_RET; }
  const ret = getRet(ass);
  function setRet<K extends keyof typeof DEFAULT_RET>(key: K, val: (typeof DEFAULT_RET)[K]) {
    update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), [key]: val } } }));
  }

  function setAss<K extends keyof Assumptions>(key: K, val: Assumptions[K]) {
    update(s => ({ ...s, assumptions: { ...s.assumptions, [key]: val } }));
  }
  function setBalance(key: keyof typeof ob, val: number) {
    update(s => ({ ...s, openingBalances: { ...s.openingBalances, [key]: val } }));
  }
  const cf = activeScenario.openingCarryForwards ?? { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 };
  function setCF(key: keyof OpeningCarryForwards, val: number) {
    update(s => ({ ...s, openingCarryForwards: { ...(s.openingCarryForwards ?? { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 }), [key]: val } }));
  }
  function changeProvince(prov: Province) {
    const brackets = PROVINCIAL_BRACKETS[prov] ?? ass.provincialBrackets;
    const bpa = PROVINCIAL_BPA[prov] ?? ass.provincialBPA;
    const divC = PROVINCIAL_DIV_CREDITS[prov];
    update(s => ({
      ...s,
      assumptions: {
        ...s.assumptions,
        province: prov,
        provincialBrackets: brackets,
        provincialBPA: bpa,
        dividendRates: divC ? {
          eligible: { ...s.assumptions.dividendRates.eligible, provincialCredit: divC.eligibleProvCredit },
          nonEligible: { ...s.assumptions.dividendRates.nonEligible, provincialCredit: divC.nonEligibleProvCredit },
        } : s.assumptions.dividendRates,
      },
    }));
  }

  // Reset helpers
  function resetCPP() { update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: DEFAULT_ASSUMPTIONS.cpp } })); lockCard('cpp'); }
  function resetEI() { update(s => ({ ...s, assumptions: { ...s.assumptions, ei: DEFAULT_ASSUMPTIONS.ei } })); lockCard('ei'); }
  function resetDividends() {
    const divC = PROVINCIAL_DIV_CREDITS[ass.province] ?? { eligibleProvCredit: DEFAULT_ASSUMPTIONS.dividendRates.eligible.provincialCredit, nonEligibleProvCredit: DEFAULT_ASSUMPTIONS.dividendRates.nonEligible.provincialCredit };
    update(s => ({
      ...s,
      assumptions: {
        ...s.assumptions,
        dividendRates: {
          eligible: { grossUp: DEFAULT_ASSUMPTIONS.dividendRates.eligible.grossUp, federalCredit: DEFAULT_ASSUMPTIONS.dividendRates.eligible.federalCredit, provincialCredit: divC.eligibleProvCredit },
          nonEligible: { grossUp: DEFAULT_ASSUMPTIONS.dividendRates.nonEligible.grossUp, federalCredit: DEFAULT_ASSUMPTIONS.dividendRates.nonEligible.federalCredit, provincialCredit: divC.nonEligibleProvCredit },
        },
      },
    }));
    lockCard('dividends');
  }
  function resetFedBrackets() { update(s => ({ ...s, assumptions: { ...s.assumptions, federalBrackets: DEFAULT_ASSUMPTIONS.federalBrackets, federalBPA: DEFAULT_ASSUMPTIONS.federalBPA } })); lockCard('fedBrackets'); }
  function resetProvBrackets() {
    const brackets = PROVINCIAL_BRACKETS[ass.province] ?? DEFAULT_ASSUMPTIONS.provincialBrackets;
    const bpa = PROVINCIAL_BPA[ass.province] ?? DEFAULT_ASSUMPTIONS.provincialBPA;
    update(s => ({ ...s, assumptions: { ...s.assumptions, provincialBrackets: brackets, provincialBPA: bpa } }));
    lockCard('provBrackets');
  }
  function resetLimits() {
    update(s => ({
      ...s, assumptions: {
        ...s.assumptions,
        rrspLimit: DEFAULT_ASSUMPTIONS.rrspLimit,
        rrspPctEarnedIncome: DEFAULT_ASSUMPTIONS.rrspPctEarnedIncome,
        tfsaAnnualLimit: DEFAULT_ASSUMPTIONS.tfsaAnnualLimit,
        fhsaAnnualLimit: DEFAULT_ASSUMPTIONS.fhsaAnnualLimit,
        fhsaLifetimeLimit: DEFAULT_ASSUMPTIONS.fhsaLifetimeLimit,
      },
    }));
    lockCard('limits');
  }

  function lockProps(k: LockKey, onReset: () => void) {
    return {
      lockKey: k,
      locked: isLocked(k),
      showConfirm: confirmKey === k,
      onRequestUnlock: () => requestUnlock(k),
      onConfirmUnlock: confirmUnlock,
      onCancelUnlock: cancelUnlock,
      onLock: () => lockCard(k),
      onReset,
    };
  }

  return (
    <div className="h-full overflow-y-auto bg-app-bg">
      <div className="max-w-5xl mx-auto px-6 py-5">
        {/* Tab bar */}
        <div className="flex items-center justify-center gap-1 mb-6 border-b border-app-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-app-accent text-app-accent'
                  : 'border-transparent text-app-text4 hover:text-app-text2 hover:border-app-border2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'general' && (
          <div className="max-w-xl mx-auto">
            <Section title="Scenario Setup">
              <FormRow label="Province">
                <select className={selectCls} value={ass.province} onChange={e => changeProvince(e.target.value as Province)}>
                  {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </FormRow>
              <FormRow label="Start Year">
                <NumInput value={ass.startYear} onChange={v => {
                  const newStart = Math.max(1990, Math.min(2100, Math.round(v)));
                  update(s => {
                    const n = s.assumptions.numYears;
                    const oldYearMap = new Map(s.years.map(y => [y.year, y]));
                    const newYears: import('../types/scenario').YearData[] = [];
                    for (let i = 0; i < n; i++) {
                      const yr = newStart + i;
                      newYears.push(oldYearMap.get(yr) ?? makeDefaultYear(yr));
                    }
                    return { ...s, assumptions: { ...s.assumptions, startYear: newStart }, years: newYears };
                  });
                }} />
              </FormRow>
              <FormRow label="# Years">
                <NumInput value={ass.numYears} onChange={v => {
                  const n = Math.max(1, Math.min(50, Math.round(v)));
                  update(s => {
                    const startY = s.assumptions.startYear;
                    let newYears = [...s.years];
                    while (newYears.length < n) {
                      const lastYear = newYears[newYears.length - 1]?.year ?? startY - 1;
                      const prev = newYears[newYears.length - 1] ?? null;
                      const yr = { ...(prev ?? {}), year: lastYear + 1 } as import('../types/scenario').YearData;
                      newYears.push(yr);
                    }
                    newYears = newYears.slice(0, n);
                    return { ...s, assumptions: { ...s.assumptions, numYears: n }, years: newYears };
                  });
                }} />
              </FormRow>
              <FormRow label="Inflation Rate">
                <NumInput value={ass.inflationRate} onChange={v => setAss('inflationRate', v)} pct step={0.1} />
              </FormRow>
              <FormRow label="Tiered CG Inclusion" hint="Post-June 2024 two-tier rules">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={ass.cgInclusionTiered ?? false}
                    onChange={e => setAss('cgInclusionTiered', e.target.checked)}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              {ass.cgInclusionTiered ? (
                <>
                  <FormRow label="Tier 1 Rate" hint={`First $${((ass.cgInclusionThreshold ?? 250000) / 1000).toFixed(0)}K`}>
                    <NumInput value={ass.cgInclusionTier1Rate ?? 0.5} onChange={v => setAss('cgInclusionTier1Rate', v)} pct step={0.5} />
                  </FormRow>
                  <FormRow label="Tier 2 Rate" hint="Above threshold">
                    <NumInput value={ass.cgInclusionTier2Rate ?? (2/3)} onChange={v => setAss('cgInclusionTier2Rate', v)} pct step={0.5} />
                  </FormRow>
                  <FormRow label="Threshold">
                    <NumInput value={ass.cgInclusionThreshold ?? 250000} onChange={v => setAss('cgInclusionThreshold', v)} />
                  </FormRow>
                </>
              ) : (
                <FormRow label="CG Inclusion Rate">
                  <NumInput value={ass.capitalGainsInclusionRate} onChange={v => setAss('capitalGainsInclusionRate', v)} pct step={0.5} />
                </FormRow>
              )}
            </Section>

            <Divider />

            <Section title="Asset Return Assumptions">
              <div className="text-[11px] text-app-text4 mb-2">Set to 0 by default — enter your own return projections.</div>
              <FormRow label="Equity">
                <NumInput value={ass.assetReturns.equity} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, equity: v } } }))} pct />
              </FormRow>
              <FormRow label="Fixed Income">
                <NumInput value={ass.assetReturns.fixedIncome} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, fixedIncome: v } } }))} pct />
              </FormRow>
              <FormRow label="Cash">
                <NumInput value={ass.assetReturns.cash} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, cash: v } } }))} pct />
              </FormRow>
              <FormRow label="Savings">
                <NumInput value={ass.assetReturns.savings} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, savings: v } } }))} pct />
              </FormRow>
            </Section>

            <Divider />

            <Section title="Return Sequences">
              <div className="text-[11px] text-app-text4 mb-2">
                Define per-year return values that override the global returns above. Useful for modeling specific market scenarios.
              </div>
              <FormRow label="Enable return sequences">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={activeScenario.returnSequence?.enabled ?? false}
                    onChange={e => {
                      const numYears = ass.numYears;
                      const cur = activeScenario.returnSequence;
                      update(s => ({
                        ...s,
                        returnSequence: {
                          enabled: e.target.checked,
                          equity: cur?.equity?.length === numYears ? cur.equity : Array(numYears).fill(ass.assetReturns.equity),
                          fixedIncome: cur?.fixedIncome?.length === numYears ? cur.fixedIncome : Array(numYears).fill(ass.assetReturns.fixedIncome),
                          cash: cur?.cash?.length === numYears ? cur.cash : Array(numYears).fill(ass.assetReturns.cash),
                          savings: cur?.savings?.length === numYears ? cur.savings : Array(numYears).fill(ass.assetReturns.savings),
                        },
                      }));
                    }}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              {activeScenario.returnSequence?.enabled && (
                <div className="mt-2 overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-app-surface z-10">
                      <tr className="border-b border-app-border">
                        <th className="text-left py-1 px-1 text-app-text4 font-medium">Year</th>
                        <th className="text-right py-1 px-1 text-app-text4 font-medium">Equity %</th>
                        <th className="text-right py-1 px-1 text-app-text4 font-medium">Fixed %</th>
                        <th className="text-right py-1 px-1 text-app-text4 font-medium">Cash %</th>
                        <th className="text-right py-1 px-1 text-app-text4 font-medium">Savings %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeScenario.years.map((yd, i) => {
                        const seq = activeScenario.returnSequence!;
                        return (
                          <tr key={yd.year} className="border-b border-app-border">
                            <td className="py-0.5 px-1 text-app-text3 font-medium">{yd.year}</td>
                            {(['equity', 'fixedIncome', 'cash', 'savings'] as const).map(key => (
                              <td key={key} className="py-0.5 px-1 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-16 text-right text-[11px] bg-transparent border-b border-app-border focus:border-app-accent outline-none tabular-nums text-app-text"
                                  value={((seq[key]?.[i] ?? 0) * 100).toFixed(1)}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) / 100;
                                    if (isNaN(val)) return;
                                    update(s => {
                                      const rs = { ...s.returnSequence! };
                                      const arr = [...(rs[key] ?? [])];
                                      arr[i] = val;
                                      return { ...s, returnSequence: { ...rs, [key]: arr } };
                                    });
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Divider />

            <Section title="Monte Carlo Settings">
              <div className="text-[11px] text-app-text4 mb-2">
                Configure default Monte Carlo parameters. Run simulations from the Analysis page.
              </div>
              <FormRow label="Default trials">
                <NumInput value={activeScenario.monteCarloConfig?.numTrials ?? 500} onChange={v => {
                  update(s => ({
                    ...s,
                    monteCarloConfig: {
                      ...(s.monteCarloConfig ?? { enabled: true, numTrials: 500,
                        equity: { mean: ass.assetReturns.equity, stdDev: 0.15 },
                        fixedIncome: { mean: ass.assetReturns.fixedIncome, stdDev: 0.05 },
                        cash: { mean: ass.assetReturns.cash, stdDev: 0.01 },
                        savings: { mean: ass.assetReturns.savings, stdDev: 0.005 },
                      }),
                      numTrials: Math.max(10, Math.min(2000, v)),
                    },
                  }));
                }} />
              </FormRow>
              <FormRow label="Equity Std Dev">
                <NumInput value={activeScenario.monteCarloConfig?.equity.stdDev ?? 0.15} onChange={v => {
                  update(s => ({
                    ...s,
                    monteCarloConfig: {
                      ...(s.monteCarloConfig ?? { enabled: true, numTrials: 500,
                        equity: { mean: ass.assetReturns.equity, stdDev: 0.15 },
                        fixedIncome: { mean: ass.assetReturns.fixedIncome, stdDev: 0.05 },
                        cash: { mean: ass.assetReturns.cash, stdDev: 0.01 },
                        savings: { mean: ass.assetReturns.savings, stdDev: 0.005 },
                      }),
                      equity: { mean: ass.assetReturns.equity, stdDev: Math.max(0, v) },
                    },
                  }));
                }} pct />
              </FormRow>
              <FormRow label="Fixed Income Std Dev">
                <NumInput value={activeScenario.monteCarloConfig?.fixedIncome.stdDev ?? 0.05} onChange={v => {
                  update(s => ({
                    ...s,
                    monteCarloConfig: {
                      ...(s.monteCarloConfig ?? { enabled: true, numTrials: 500,
                        equity: { mean: ass.assetReturns.equity, stdDev: 0.15 },
                        fixedIncome: { mean: ass.assetReturns.fixedIncome, stdDev: 0.05 },
                        cash: { mean: ass.assetReturns.cash, stdDev: 0.01 },
                        savings: { mean: ass.assetReturns.savings, stdDev: 0.005 },
                      }),
                      fixedIncome: { mean: ass.assetReturns.fixedIncome, stdDev: Math.max(0, v) },
                    },
                  }));
                }} pct />
              </FormRow>
            </Section>

            <Divider />

            <Section title="Auto-Indexing">
              <div className="text-[11px] text-app-text4 mb-2">
                When enabled, CRA dollar thresholds (brackets, BPA, CPP/EI limits, account limits) grow by inflation each year.
              </div>
              <FormRow label="Auto-index by inflation">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={ass.autoIndexAssumptions !== false}
                    onChange={e => dispatch({ type: 'TOGGLE_AUTO_INDEX', enabled: e.target.checked })}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
            </Section>

            <Divider />

            <OverrideManager scenario={activeScenario} dispatch={dispatch} />
          </div>
        )}

        {tab === 'tax' && (
          <div className="max-w-4xl mx-auto">
            {/* Two-column layout for brackets */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <Section title="Federal Tax Brackets" {...lockProps('fedBrackets', resetFedBrackets)}>
                  <FormRow label="Federal BPA">
                    <NumInput value={ass.federalBPA} onChange={v => setAss('federalBPA', v)} />
                  </FormRow>
                  <FormRow label="Employment Amount">
                    <NumInput value={ass.federalEmploymentAmount} onChange={v => setAss('federalEmploymentAmount', v)} />
                  </FormRow>
                  <BracketTable brackets={ass.federalBrackets} onChange={b => setAss('federalBrackets', b)} />
                </Section>
              </div>
              <div>
                <Section title="Provincial Tax Brackets" {...lockProps('provBrackets', resetProvBrackets)}>
                  <FormRow label="Provincial BPA">
                    <NumInput value={ass.provincialBPA} onChange={v => setAss('provincialBPA', v)} />
                  </FormRow>
                  <BracketTable brackets={ass.provincialBrackets} onChange={b => setAss('provincialBrackets', b)} />
                </Section>
              </div>
            </div>

            <Divider />

            {/* Two-column for CPP/EI */}
            <div className="grid grid-cols-2 gap-8">
              <Section title="CPP / QPP Parameters" {...lockProps('cpp', resetCPP)}>
                <FormRow label="Basic Exemption">
                  <NumInput value={ass.cpp.basicExemption} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, basicExemption: v } } }))} />
                </FormRow>
                <FormRow label="YMPE">
                  <NumInput value={ass.cpp.ympe} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, ympe: v } } }))} />
                </FormRow>
                <FormRow label="YAMPE">
                  <NumInput value={ass.cpp.yampe} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, yampe: v } } }))} />
                </FormRow>
                <FormRow label="Employee Rate %">
                  <NumInput value={ass.cpp.employeeRate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, employeeRate: v } } }))} pct />
                </FormRow>
                <FormRow label="CPP2 Rate %">
                  <NumInput value={ass.cpp.cpp2Rate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, cpp2Rate: v } } }))} pct />
                </FormRow>
              </Section>

              <Section title="EI Parameters" {...lockProps('ei', resetEI)}>
                <FormRow label="Max Insurable Earnings">
                  <NumInput value={ass.ei.maxInsurableEarnings} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, maxInsurableEarnings: v } } }))} />
                </FormRow>
                <FormRow label="Employee Rate %">
                  <NumInput value={ass.ei.employeeRate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, employeeRate: v } } }))} pct />
                </FormRow>
                <FormRow label="SE Opt-In">
                  <div className="flex justify-end items-center h-full">
                    <input
                      type="checkbox"
                      disabled={isLocked('ei')}
                      checked={ass.ei.seOptIn}
                      onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, seOptIn: e.target.checked } } }))}
                      className="accent-[var(--app-accent)] w-4 h-4 disabled:cursor-not-allowed"
                    />
                  </div>
                </FormRow>
              </Section>
            </div>

            <Divider />

            <div className="max-w-xl mx-auto">
              <Section title="Dividend Tax Rates" {...lockProps('dividends', resetDividends)}>
                <SubHeader title="Eligible Dividends" />
                <FormRow label="Gross-up %">
                  <NumInput value={ass.dividendRates.eligible.grossUp} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, grossUp: v } } } }))} pct />
                </FormRow>
                <FormRow label="Fed Credit %">
                  <NumInput value={ass.dividendRates.eligible.federalCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, federalCredit: v } } } }))} pct />
                </FormRow>
                <FormRow label="Prov Credit %">
                  <NumInput value={ass.dividendRates.eligible.provincialCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, provincialCredit: v } } } }))} pct />
                </FormRow>
                <SubHeader title="Non-Eligible Dividends" />
                <FormRow label="Gross-up %">
                  <NumInput value={ass.dividendRates.nonEligible.grossUp} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, grossUp: v } } } }))} pct />
                </FormRow>
                <FormRow label="Fed Credit %">
                  <NumInput value={ass.dividendRates.nonEligible.federalCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, federalCredit: v } } } }))} pct />
                </FormRow>
                <FormRow label="Prov Credit %">
                  <NumInput value={ass.dividendRates.nonEligible.provincialCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, provincialCredit: v } } } }))} pct />
                </FormRow>
              </Section>

              <Divider />

              <Section title="Contribution Limits" {...lockProps('limits', resetLimits)}>
                <FormRow label="RRSP Annual Cap">
                  <NumInput value={ass.rrspLimit} onChange={v => setAss('rrspLimit', v)} />
                </FormRow>
                <FormRow label="RRSP % Earned Income">
                  <NumInput value={ass.rrspPctEarnedIncome} onChange={v => setAss('rrspPctEarnedIncome', v)} pct />
                </FormRow>
                <FormRow label="TFSA Annual Limit">
                  <NumInput value={ass.tfsaAnnualLimit} onChange={v => setAss('tfsaAnnualLimit', v)} />
                </FormRow>
                <FormRow label="FHSA Annual Limit">
                  <NumInput value={ass.fhsaAnnualLimit} onChange={v => setAss('fhsaAnnualLimit', v)} />
                </FormRow>
                <FormRow label="FHSA Lifetime Limit">
                  <NumInput value={ass.fhsaLifetimeLimit} onChange={v => setAss('fhsaLifetimeLimit', v)} />
                </FormRow>
              </Section>
            </div>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="max-w-xl mx-auto">
            <Section title="Opening Balances">
              <BalanceRow label="RRSP" color="bg-app-accent" value={ob.rrsp} onChange={v => setBalance('rrsp', v)} />
              <BalanceRow label="TFSA" color="bg-emerald-500" value={ob.tfsa} onChange={v => setBalance('tfsa', v)} />
              <BalanceRow label="FHSA" color="bg-cyan-500" value={ob.fhsa} onChange={v => setBalance('fhsa', v)} />
              <BalanceRow label="Non-Registered" color="bg-amber-500" value={ob.nonReg} onChange={v => setBalance('nonReg', v)} />
              <BalanceRow label="Savings" color="bg-sky-500" value={ob.savings} onChange={v => setBalance('savings', v)} />
              <BalanceRow label="LIRA" color="bg-purple-500" value={ob.lira} onChange={v => setBalance('lira', v)} />
              <BalanceRow label="RESP" color="bg-rose-500" value={ob.resp} onChange={v => setBalance('resp', v)} />
            </Section>

            <Divider />

            <Section title="Opening Carry-Forwards">
              <div className="text-[11px] text-app-text4 mb-2">Pre-existing room & losses from before start year.</div>
              <BalanceRow label="RRSP Unused Room" color="bg-app-accent" value={cf.rrspUnusedRoom} onChange={v => setCF('rrspUnusedRoom', v)} />
              <BalanceRow label="TFSA Unused Room" color="bg-emerald-500" value={cf.tfsaUnusedRoom} onChange={v => setCF('tfsaUnusedRoom', v)} />
              <BalanceRow label="Capital Loss C/F" color="bg-red-500" value={cf.capitalLossCF} onChange={v => setCF('capitalLossCF', v)} />
              <BalanceRow label="FHSA Lifetime Contrib" color="bg-cyan-500" value={cf.fhsaContribLifetime} onChange={v => setCF('fhsaContribLifetime', v)} />
              <BalanceRow label="RESP CESG Lifetime" color="bg-rose-500" value={cf.respGrantsLifetime ?? 0} onChange={v => setCF('respGrantsLifetime', v)} />
              <BalanceRow label="Prior Year Earned Income" color="bg-app-text4" value={cf.priorYearEarnedIncome ?? 0} onChange={v => setCF('priorYearEarnedIncome', v)} />
            </Section>

            <Divider />

            <Section title="Account Opening Years">
              <div className="text-[11px] text-app-text4 mb-2">Year each account was opened. Defaults to age 18 (or 2009 for TFSA). Used for room calculations and FHSA 15-year rule.</div>
              {(() => {
                const aoy = ass.accountOpeningYears ?? {};
                const defaultTfsa = ass.birthYear ? Math.max(2009, ass.birthYear + 18) : ass.startYear;
                const defaultRrsp = ass.birthYear ? ass.birthYear + 18 : ass.startYear;
                const setAOY = (key: 'tfsa' | 'fhsa' | 'rrsp', v: number | undefined) =>
                  update(s => ({
                    ...s,
                    assumptions: {
                      ...s.assumptions,
                      accountOpeningYears: { ...s.assumptions.accountOpeningYears, [key]: v },
                    },
                  }));
                return (
                  <>
                    <FormRow label="TFSA" hint={`Default: ${defaultTfsa}`}>
                      <input
                        type="number"
                        className={inputCls}
                        placeholder={String(defaultTfsa)}
                        value={aoy.tfsa ?? ''}
                        onChange={e => {
                          const raw = e.target.value;
                          setAOY('tfsa', raw === '' ? undefined : Math.round(parseFloat(raw)));
                        }}
                      />
                    </FormRow>
                    <FormRow label="FHSA" hint="Default: auto-detect from first contribution">
                      <input
                        type="number"
                        className={inputCls}
                        placeholder="Auto"
                        value={aoy.fhsa ?? ''}
                        onChange={e => {
                          const raw = e.target.value;
                          setAOY('fhsa', raw === '' ? undefined : Math.round(parseFloat(raw)));
                        }}
                      />
                    </FormRow>
                    <FormRow label="RRSP" hint={`Default: ${defaultRrsp}`}>
                      <input
                        type="number"
                        className={inputCls}
                        placeholder={String(defaultRrsp)}
                        value={aoy.rrsp ?? ''}
                        onChange={e => {
                          const raw = e.target.value;
                          setAOY('rrsp', raw === '' ? undefined : Math.round(parseFloat(raw)));
                        }}
                      />
                    </FormRow>
                  </>
                );
              })()}
            </Section>

            <Divider />

            <Section title="FHSA Disposition">
              <div className="text-[11px] text-app-text4 mb-2">
                Control what happens to the FHSA account.
              </div>
              <FormRow label="Disposition">
                <select
                  className={selectCls}
                  value={ass.fhsa?.disposition ?? 'active'}
                  onChange={e => update(s => ({
                    ...s,
                    assumptions: {
                      ...s.assumptions,
                      fhsa: { ...(s.assumptions.fhsa ?? { disposition: 'active' }), disposition: e.target.value as FHSADisposition },
                    },
                  }))}
                >
                  <option value="active">Active (ongoing)</option>
                  <option value="home-purchase">Home Purchase (tax-free)</option>
                  <option value="transfer-rrsp">Transfer to RRSP</option>
                  <option value="taxable-close">Taxable Close-out</option>
                </select>
              </FormRow>
              {(ass.fhsa?.disposition ?? 'active') !== 'active' && (
                <FormRow label="Disposition Year">
                  <NumInput
                    value={ass.fhsa?.dispositionYear ?? ass.startYear}
                    onChange={v => update(s => ({
                      ...s,
                      assumptions: {
                        ...s.assumptions,
                        fhsa: { ...(s.assumptions.fhsa ?? { disposition: 'active' }), dispositionYear: Math.round(v) },
                      },
                    }))}
                  />
                </FormRow>
              )}
            </Section>

            <Divider />

            <Section title="Liabilities / Debts">
              <div className="text-[11px] text-app-text4 mb-2">
                Add debts to subtract from net worth. Investment loan interest is tax-deductible (Smith Manoeuvre).
              </div>
              {(activeScenario.liabilities ?? []).map((l, idx) => (
                <div key={l.id} className="mb-3 px-3 py-2.5 bg-app-surface2 border border-app-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      className="text-sm font-medium text-app-text2 bg-transparent border-b border-transparent hover:border-app-border2 focus:border-app-accent outline-none px-0 py-0.5"
                      value={l.label}
                      onChange={e => update(s => {
                        const libs = [...(s.liabilities ?? [])];
                        libs[idx] = { ...libs[idx], label: e.target.value };
                        return { ...s, liabilities: libs };
                      })}
                    />
                    <button
                      onClick={() => update(s => {
                        const libs = (s.liabilities ?? []).filter((_, i) => i !== idx);
                        return { ...s, liabilities: libs.length > 0 ? libs : undefined };
                      })}
                      className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                    >Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <FormRow label="Type">
                      <select className={selectCls} value={l.type} onChange={e => update(s => {
                        const libs = [...(s.liabilities ?? [])];
                        libs[idx] = { ...libs[idx], type: e.target.value as LiabilityType };
                        return { ...s, liabilities: libs };
                      })}>
                        <option value="mortgage">Mortgage</option>
                        <option value="student-loan">Student Loan</option>
                        <option value="loc">LOC / HELOC</option>
                        <option value="other">Other</option>
                      </select>
                    </FormRow>
                    <FormRow label="Opening Balance">
                      <NumInput value={l.openingBalance} onChange={v => update(s => {
                        const libs = [...(s.liabilities ?? [])];
                        libs[idx] = { ...libs[idx], openingBalance: v };
                        return { ...s, liabilities: libs };
                      })} />
                    </FormRow>
                    <FormRow label="Annual Rate %">
                      <NumInput value={l.annualRate} onChange={v => update(s => {
                        const libs = [...(s.liabilities ?? [])];
                        libs[idx] = { ...libs[idx], annualRate: v };
                        return { ...s, liabilities: libs };
                      })} pct />
                    </FormRow>
                    <FormRow label="Monthly Payment">
                      <NumInput value={l.monthlyPayment} onChange={v => update(s => {
                        const libs = [...(s.liabilities ?? [])];
                        libs[idx] = { ...libs[idx], monthlyPayment: v };
                        return { ...s, liabilities: libs };
                      })} />
                    </FormRow>
                    <FormRow label="Investment Loan" hint="Interest is tax-deductible">
                      <div className="flex justify-end items-center h-full">
                        <input
                          type="checkbox"
                          checked={l.isInvestmentLoan ?? false}
                          onChange={e => update(s => {
                            const libs = [...(s.liabilities ?? [])];
                            libs[idx] = { ...libs[idx], isInvestmentLoan: e.target.checked };
                            return { ...s, liabilities: libs };
                          })}
                          className="accent-[var(--app-accent)] w-4 h-4"
                        />
                      </div>
                    </FormRow>
                  </div>
                </div>
              ))}
              <button
                onClick={() => update(s => ({
                  ...s,
                  liabilities: [...(s.liabilities ?? []), {
                    id: crypto.randomUUID(),
                    label: 'New Debt',
                    type: 'mortgage' as LiabilityType,
                    openingBalance: 0,
                    annualRate: 0.05,
                    monthlyPayment: 0,
                  }],
                }))}
                className="text-xs text-app-accent hover:text-app-accent transition-colors"
              >
                + Add Liability
              </button>
            </Section>

            <Divider />

            <Section title="Adjusted Cost Base (Non-Reg)">
              <div className="text-[11px] text-app-text4 mb-2">
                Track ACB for non-registered account to compute capital gains/losses on withdrawals.
              </div>
              <FormRow label="Enable ACB Tracking">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={!!activeScenario.acbConfig}
                    onChange={e => {
                      if (e.target.checked) {
                        update(s => ({ ...s, acbConfig: { openingACB: s.openingBalances.nonReg } }));
                      } else {
                        update(s => {
                          const { acbConfig: _, ...rest } = s;
                          return rest as typeof s;
                        });
                      }
                    }}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              {activeScenario.acbConfig && (
                <>
                  <FormRow label="Opening ACB" hint="Cost basis at start of simulation">
                    <NumInput
                      value={activeScenario.acbConfig.openingACB ?? ob.nonReg}
                      onChange={v => update(s => ({
                        ...s,
                        acbConfig: { ...(s.acbConfig ?? { openingACB: s.openingBalances.nonReg }), openingACB: v },
                      }))}
                    />
                  </FormRow>
                  <FormRow label="LI Opening ACB" hint="Opening cost basis for life insurance account">
                    <NumInput
                      value={activeScenario.acbConfig.liOpeningACB ?? ob.li}
                      onChange={v => update(s => ({
                        ...s,
                        acbConfig: { ...(s.acbConfig ?? { openingACB: s.openingBalances.nonReg }), liOpeningACB: v },
                      }))}
                    />
                  </FormRow>
                </>
              )}
            </Section>
          </div>
        )}

        {tab === 'retirement' && (
          <div className="max-w-xl mx-auto">
            <Section title="Personal">
              <FormRow label="Birth Year">
                <NumInput value={ass.birthYear ?? 1990} onChange={v => setAss('birthYear', Math.round(v))} />
              </FormRow>
              <FormRow label="RRIF Conversion Age" hint="RRSP must convert to RRIF by Dec 31 of this age">
                <NumInput value={ret.rrifConversionAge} onChange={v => setRet('rrifConversionAge', Math.round(v))} />
              </FormRow>
            </Section>

            <Divider />

            <Section title="CPP Pension Benefit">
              <FormRow label="Enabled">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={ret.cppBenefit.enabled}
                    onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, enabled: e.target.checked } } } }))}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              <FormRow label="Monthly Amount" hint="In today's dollars, inflation-adjusted">
                <NumInput value={ret.cppBenefit.monthlyAmount} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, monthlyAmount: v } } } }))} />
              </FormRow>
              <FormRow label="Start Age">
                <NumInput value={ret.cppBenefit.startAge} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, startAge: Math.round(v) } } } }))} />
              </FormRow>
            </Section>

            <Divider />

            <Section title="OAS Benefit">
              <FormRow label="Enabled">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={ret.oasBenefit.enabled}
                    onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, enabled: e.target.checked } } } }))}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              <FormRow label="Monthly Amount" hint="In today's dollars, inflation-adjusted">
                <NumInput value={ret.oasBenefit.monthlyAmount} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, monthlyAmount: v } } } }))} />
              </FormRow>
              <FormRow label="Start Age">
                <NumInput value={ret.oasBenefit.startAge} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, startAge: Math.round(v) } } } }))} />
              </FormRow>
            </Section>

            <Divider />

            <Section title="OAS Clawback">
              <FormRow label="Clawback Threshold" hint="15% recovery tax on income above this threshold">
                <NumInput value={ass.oasClawbackThreshold ?? 86912} onChange={v => setAss('oasClawbackThreshold', v)} />
              </FormRow>
            </Section>

            <Divider />

            <Section title="RRSP Home Buyers' Plan (HBP)">
              <div className="text-[11px] text-app-text4 mb-2">
                Tax-free RRSP withdrawal up to $35K for first home. Must repay 1/15 per year starting 2 years after withdrawal.
              </div>
              <FormRow label="Enable HBP">
                <div className="flex justify-end items-center h-full">
                  <input
                    type="checkbox"
                    checked={!!ass.hbp}
                    onChange={e => {
                      if (e.target.checked) {
                        update(s => ({ ...s, assumptions: { ...s.assumptions, hbp: { withdrawalYear: s.assumptions.startYear, withdrawalAmount: 35000, repaymentStartDelay: 2 } } }));
                      } else {
                        update(s => {
                          const { hbp: _, ...restAss } = s.assumptions;
                          return { ...s, assumptions: restAss as typeof s.assumptions };
                        });
                      }
                    }}
                    className="accent-[var(--app-accent)] w-4 h-4"
                  />
                </div>
              </FormRow>
              {ass.hbp && (
                <>
                  <FormRow label="Withdrawal Year">
                    <NumInput value={ass.hbp.withdrawalYear} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, hbp: { ...s.assumptions.hbp!, withdrawalYear: Math.round(v) } } }))} />
                  </FormRow>
                  <FormRow label="Withdrawal Amount" hint="Max $35,000">
                    <NumInput value={ass.hbp.withdrawalAmount} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, hbp: { ...s.assumptions.hbp!, withdrawalAmount: Math.min(35000, Math.max(0, v)) } } }))} />
                  </FormRow>
                  <FormRow label="Repayment Delay" hint="Years after withdrawal before repayment starts">
                    <NumInput value={ass.hbp.repaymentStartDelay} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, hbp: { ...s.assumptions.hbp!, repaymentStartDelay: Math.max(0, Math.round(v)) } } }))} />
                  </FormRow>
                </>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
