import React, { useState, createContext, useContext } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import { PROVINCIAL_BRACKETS, PROVINCIAL_BPA, PROVINCIAL_DIV_CREDITS, DEFAULT_ASSUMPTIONS } from '../store/defaults';
import { formatCAD } from '../utils/formatters';
import type { Province, TaxBracket, Assumptions, FHSADisposition, OpeningCarryForwards } from '../types/scenario';

const PROVINCES: { code: Province; label: string }[] = [
  { code: 'AB', label: 'Alberta' }, { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' }, { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland & Labrador' }, { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' }, { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' }, { code: 'PE', label: 'PEI' },
  { code: 'QC', label: 'Quebec' }, { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
];

// Context so nested inputs know if their card is locked
const LockedCtx = createContext(false);

type LockKey = 'cpp' | 'ei' | 'dividends' | 'fedBrackets' | 'provBrackets' | 'limits';

const ACCENT_MAP: Record<string, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  violet: 'border-l-violet-500',
  slate: 'border-l-slate-400',
};

interface CardProps {
  title: string;
  accent?: string;
  children: React.ReactNode;
  lockKey?: LockKey;
  locked?: boolean;
  showConfirm?: boolean;
  onRequestUnlock?: () => void;
  onConfirmUnlock?: () => void;
  onCancelUnlock?: () => void;
  onLock?: () => void;
  onReset?: () => void;
}

function Card({
  title, accent = 'blue', children,
  lockKey, locked = false, showConfirm = false,
  onRequestUnlock, onConfirmUnlock, onCancelUnlock, onLock, onReset,
}: CardProps) {
  const isLockable = lockKey !== undefined;
  return (
    <LockedCtx.Provider value={locked}>
      <div className={`bg-white border border-slate-200 rounded-lg border-l-4 ${ACCENT_MAP[accent] ?? ACCENT_MAP.blue} flex flex-col`}>
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{title}</span>
          {isLockable && (
            <div className="flex items-center gap-2">
              {!locked && onReset && (
                <button
                  onClick={onReset}
                  className="text-[10px] text-slate-400 hover:text-amber-600 transition-colors"
                  title="Reset to CRA defaults"
                >
                  ↩ Reset
                </button>
              )}
              <button
                onClick={locked ? onRequestUnlock : onLock}
                className={`text-base leading-none transition-colors ${locked ? 'text-slate-400 hover:text-slate-600' : 'text-amber-500 hover:text-amber-700'}`}
                title={locked ? 'Click to unlock and edit' : 'Lock to prevent accidental changes'}
              >
                {locked ? '🔒' : '🔓'}
              </button>
            </div>
          )}
        </div>
        {/* Unlock confirmation banner */}
        {showConfirm && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0 flex items-center justify-between gap-3">
            <span className="text-[11px] text-amber-700">These are CRA regulatory defaults — override with caution.</span>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={onCancelUnlock}
                className="text-[11px] px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmUnlock}
                className="text-[11px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
        {/* Content */}
        <div className={`px-4 py-3 flex-1 transition-opacity ${locked ? 'opacity-60' : ''}`}>
          {children}
        </div>
      </div>
    </LockedCtx.Provider>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <label className="text-sm text-slate-600 shrink-0 mr-4">{label}</label>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  );
}

function SubHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pt-2 pb-1 first:pt-0">
      {title}
    </div>
  );
}

const inputCls = "w-full text-right text-sm bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-colors disabled:bg-slate-50 disabled:cursor-not-allowed";
const selectCls = "w-full text-sm bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none focus:border-blue-500 transition-colors";

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
  const cellCls = "border border-slate-200 text-[11px] text-right px-1.5 py-1 bg-white text-slate-700 outline-none focus:border-blue-400 w-full rounded disabled:bg-slate-50 disabled:cursor-not-allowed";
  return (
    <table className="w-full text-xs mt-1">
      <thead>
        <tr>
          <th className="text-left pb-1 text-[10px] font-medium text-slate-400 pr-1">Min</th>
          <th className="text-left pb-1 text-[10px] font-medium text-slate-400 pr-1">Max</th>
          <th className="text-left pb-1 text-[10px] font-medium text-slate-400">Rate %</th>
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
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      {editing ? (
        <input
          autoFocus
          className="w-36 text-right text-sm bg-white border border-blue-400 rounded px-2 py-1 text-slate-800 outline-none"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <span
          className="text-sm text-slate-800 font-medium cursor-pointer hover:text-blue-600 transition-colors"
          onClick={start}
          title="Click to edit"
        >
          {formatCAD(value)}
        </span>
      )}
    </div>
  );
}

export function AssumptionsPage() {
  const { activeScenario } = useScenario();
  const update = useUpdateScenario();

  // Lock state: all CRA-default cards start locked
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
  function resetCPP() {
    update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: DEFAULT_ASSUMPTIONS.cpp } }));
    lockCard('cpp');
  }
  function resetEI() {
    update(s => ({ ...s, assumptions: { ...s.assumptions, ei: DEFAULT_ASSUMPTIONS.ei } }));
    lockCard('ei');
  }
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
  function resetFedBrackets() {
    update(s => ({ ...s, assumptions: { ...s.assumptions, federalBrackets: DEFAULT_ASSUMPTIONS.federalBrackets, federalBPA: DEFAULT_ASSUMPTIONS.federalBPA } }));
    lockCard('fedBrackets');
  }
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
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Flat 3×3 grid — CSS grid stretches rows so cards in the same row share height */}
        <div className="grid grid-cols-3 gap-5">

          {/* ── ROW 1 ── */}

          {/* [0,0] General Settings — not lockable, user preference */}
          <Card title="General Settings" accent="blue">
            <FormRow label="Province">
              <select className={selectCls} value={ass.province} onChange={e => changeProvince(e.target.value as Province)}>
                {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </FormRow>
            <FormRow label="Start Year">
              <NumInput value={ass.startYear} onChange={v => setAss('startYear', Math.round(v))} />
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
            <FormRow label="CG Inclusion Rate">
              <NumInput value={ass.capitalGainsInclusionRate} onChange={v => setAss('capitalGainsInclusionRate', v)} pct step={0.5} />
            </FormRow>
          </Card>

          {/* [0,1] Dividend Rates — CRA-set gross-up + federal credits */}
          <Card title="Dividend Rates" accent="emerald" {...lockProps('dividends', resetDividends)}>
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
          </Card>

          {/* [0,2] Opening Balances — user input */}
          <Card title="Opening Balances" accent="slate">
            <BalanceRow label="RRSP" color="bg-blue-500" value={ob.rrsp} onChange={v => setBalance('rrsp', v)} />
            <BalanceRow label="TFSA" color="bg-emerald-500" value={ob.tfsa} onChange={v => setBalance('tfsa', v)} />
            <BalanceRow label="FHSA" color="bg-cyan-500" value={ob.fhsa} onChange={v => setBalance('fhsa', v)} />
            <BalanceRow label="Non-Registered" color="bg-amber-500" value={ob.nonReg} onChange={v => setBalance('nonReg', v)} />
            <BalanceRow label="Savings" color="bg-sky-500" value={ob.savings} onChange={v => setBalance('savings', v)} />
          </Card>

          {/* ── ROW 2 ── */}

          {/* [1,0] CPP / QPP — CRA-set rates */}
          <Card title="CPP / QPP Parameters" accent="amber" {...lockProps('cpp', resetCPP)}>
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
          </Card>

          {/* [1,1] Federal Tax Brackets — CRA-set */}
          <Card title="Federal Tax Brackets" accent="red" {...lockProps('fedBrackets', resetFedBrackets)}>
            <FormRow label="Federal BPA">
              <NumInput value={ass.federalBPA} onChange={v => setAss('federalBPA', v)} />
            </FormRow>
            <BracketTable brackets={ass.federalBrackets} onChange={b => setAss('federalBrackets', b)} />
          </Card>

          {/* [1,2] Contribution Limits — CRA-set annual limits */}
          <Card title="Contribution Limits" accent="blue" {...lockProps('limits', resetLimits)}>
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
          </Card>

          {/* ── ROW 3 ── */}

          {/* [2,0] EI — CRA-set rates */}
          <Card title="EI Parameters" accent="amber" {...lockProps('ei', resetEI)}>
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
                  className="accent-blue-600 w-4 h-4 disabled:cursor-not-allowed"
                />
              </div>
            </FormRow>
          </Card>

          {/* [2,1] Provincial Tax Brackets — CRA/province-set */}
          <Card title="Provincial Tax Brackets" accent="violet" {...lockProps('provBrackets', resetProvBrackets)}>
            <FormRow label="Provincial BPA">
              <NumInput value={ass.provincialBPA} onChange={v => setAss('provincialBPA', v)} />
            </FormRow>
            <BracketTable brackets={ass.provincialBrackets} onChange={b => setAss('provincialBrackets', b)} />
          </Card>

          {/* [2,2] Asset Returns — user discretion, default 0 */}
          <Card title="Asset Return Assumptions" accent="emerald">
            <div className="text-[11px] text-slate-400 mb-2">Set to 0 by default — enter your own return projections.</div>
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
          </Card>

          {/* ── ROW 4 ── */}

          {/* [3,0] Retirement & Government Benefits */}
          <Card title="Retirement & Benefits" accent="blue">
            <FormRow label="Birth Year">
              <NumInput value={ass.birthYear ?? 1990} onChange={v => setAss('birthYear', Math.round(v))} />
            </FormRow>
            <FormRow label="RRIF Conversion Age">
              <NumInput value={ret.rrifConversionAge} onChange={v => setRet('rrifConversionAge', Math.round(v))} />
            </FormRow>
            <SubHeader title="CPP Pension Benefit" />
            <FormRow label="Enabled">
              <div className="flex justify-end items-center h-full">
                <input
                  type="checkbox"
                  checked={ret.cppBenefit.enabled}
                  onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, enabled: e.target.checked } } } }))}
                  className="accent-blue-600 w-4 h-4"
                />
              </div>
            </FormRow>
            <FormRow label="Monthly Amount">
              <NumInput value={ret.cppBenefit.monthlyAmount} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, monthlyAmount: v } } } }))} />
            </FormRow>
            <FormRow label="Start Age">
              <NumInput value={ret.cppBenefit.startAge} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), cppBenefit: { ...getRet(s.assumptions).cppBenefit, startAge: Math.round(v) } } } }))} />
            </FormRow>
            <SubHeader title="OAS Benefit" />
            <FormRow label="Enabled">
              <div className="flex justify-end items-center h-full">
                <input
                  type="checkbox"
                  checked={ret.oasBenefit.enabled}
                  onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, enabled: e.target.checked } } } }))}
                  className="accent-blue-600 w-4 h-4"
                />
              </div>
            </FormRow>
            <FormRow label="Monthly Amount">
              <NumInput value={ret.oasBenefit.monthlyAmount} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, monthlyAmount: v } } } }))} />
            </FormRow>
            <FormRow label="Start Age">
              <NumInput value={ret.oasBenefit.startAge} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, retirement: { ...getRet(s.assumptions), oasBenefit: { ...getRet(s.assumptions).oasBenefit, startAge: Math.round(v) } } } }))} />
            </FormRow>
            <SubHeader title="OAS Clawback" />
            <FormRow label="Clawback Threshold">
              <NumInput value={ass.oasClawbackThreshold ?? 86912} onChange={v => setAss('oasClawbackThreshold', v)} />
            </FormRow>
          </Card>

          {/* [3,1] FHSA Disposition Settings */}
          <Card title="FHSA Disposition" accent="cyan">
            <div className="text-[11px] text-slate-400 mb-2">
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
          </Card>

          {/* [3,2] Opening Carry-Forwards */}
          <Card title="Opening Carry-Forwards" accent="slate">
            <div className="text-[11px] text-slate-400 mb-2">Pre-existing room & losses from before start year.</div>
            <BalanceRow label="RRSP Unused Room" color="bg-blue-500" value={cf.rrspUnusedRoom} onChange={v => setCF('rrspUnusedRoom', v)} />
            <BalanceRow label="TFSA Unused Room" color="bg-emerald-500" value={cf.tfsaUnusedRoom} onChange={v => setCF('tfsaUnusedRoom', v)} />
            <BalanceRow label="Capital Loss C/F" color="bg-red-500" value={cf.capitalLossCF} onChange={v => setCF('capitalLossCF', v)} />
            <BalanceRow label="FHSA Lifetime Contrib" color="bg-cyan-500" value={cf.fhsaContribLifetime} onChange={v => setCF('fhsaContribLifetime', v)} />
          </Card>

        </div>
      </div>
    </div>
  );
}
