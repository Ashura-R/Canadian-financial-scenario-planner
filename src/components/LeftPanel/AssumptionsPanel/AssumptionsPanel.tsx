import React, { useState } from 'react';
import { useScenario, useUpdateScenario } from '../../../store/ScenarioContext';
import { PROVINCIAL_BRACKETS, PROVINCIAL_BPA, PROVINCIAL_DIV_CREDITS } from '../../../store/defaults';
import type { Province, TaxBracket, Assumptions } from '../../../types/scenario';

const PROVINCES: { code: Province; label: string }[] = [
  { code: 'AB', label: 'Alberta' }, { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' }, { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland & Labrador' }, { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' }, { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' }, { code: 'PE', label: 'PEI' },
  { code: 'QC', label: 'Quebec' }, { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
];

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#111827] border border-[#1e2d3d] rounded-lg">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#f9fafb] uppercase tracking-wider hover:bg-[#1f2937] transition-colors rounded-lg"
        onClick={() => setOpen(o => !o)}
      >
        {title}
        <span className="text-[#6b7280]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-[#1e2d3d] space-y-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-[#9ca3af] shrink-0">{label}</label>
      <div className="w-36">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, pct = false, step }: {
  value: number; onChange: (v: number) => void; pct?: boolean; step?: number;
}) {
  const display = pct ? (value * 100).toFixed(2) : String(value);
  return (
    <input
      type="number"
      step={step ?? (pct ? 0.01 : 1)}
      className="w-full text-right text-xs bg-[#1f2937] border border-[#374151] rounded px-2 py-1 text-[#f9fafb] outline-none focus:border-[#3b82f6]"
      value={display}
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
  function update(i: number, field: keyof TaxBracket, raw: string) {
    const updated = brackets.map((b, idx) => {
      if (idx !== i) return b;
      if (field === 'rate') return { ...b, rate: parseFloat(raw) / 100 || 0 };
      if (field === 'max') return { ...b, max: raw === '' || raw === 'null' ? null : parseFloat(raw) || 0 };
      if (field === 'min') return { ...b, min: parseFloat(raw) || 0 };
      return b;
    });
    onChange(updated);
  }

  const cellCls = "border border-[#374151] text-xs text-right px-1 py-0.5 bg-[#1f2937] text-[#f9fafb] outline-none focus:border-[#3b82f6] w-full";

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[#6b7280]">
          <th className="text-left py-1">Min</th>
          <th className="text-left py-1">Max</th>
          <th className="text-left py-1">Rate %</th>
        </tr>
      </thead>
      <tbody>
        {brackets.map((b, i) => (
          <tr key={i}>
            <td><input className={cellCls} type="number" value={b.min} onChange={e => update(i, 'min', e.target.value)} /></td>
            <td><input className={cellCls} type="number" value={b.max ?? ''} placeholder="∞" onChange={e => update(i, 'max', e.target.value)} /></td>
            <td><input className={cellCls} type="number" step="0.01" value={(b.rate * 100).toFixed(4)} onChange={e => update(i, 'rate', e.target.value)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AssumptionsPanel() {
  const { activeScenario } = useScenario();
  const update = useUpdateScenario();

  if (!activeScenario) return null;
  const ass = activeScenario.assumptions;

  function setAss<K extends keyof Assumptions>(key: K, val: Assumptions[K]) {
    update(s => ({ ...s, assumptions: { ...s.assumptions, [key]: val } }));
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

  return (
    <div className="space-y-2">
      <Section title="General Settings" defaultOpen>
        <Row label="Province">
          <select
            className="w-full text-xs bg-[#1f2937] border border-[#374151] rounded px-2 py-1 text-[#f9fafb] outline-none focus:border-[#3b82f6]"
            value={ass.province}
            onChange={e => changeProvince(e.target.value as Province)}
          >
            {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </Row>
        <Row label="Start Year"><NumInput value={ass.startYear} onChange={v => setAss('startYear', Math.round(v))} /></Row>
        <Row label="# Years"><NumInput value={ass.numYears} onChange={v => {
          const n = Math.max(1, Math.min(50, Math.round(v)));
          update(s => {
            const curYears = s.years;
            const target = n;
            const startY = s.assumptions.startYear;
            let newYears = [...curYears];
            while (newYears.length < target) {
              const lastYear = newYears[newYears.length - 1]?.year ?? startY - 1;
              const prev = newYears[newYears.length - 1] ?? null;
              const yr = { ...(prev ?? {}), year: lastYear + 1 } as import('../../../types/scenario').YearData;
              newYears.push(yr);
            }
            newYears = newYears.slice(0, target);
            return { ...s, assumptions: { ...s.assumptions, numYears: n }, years: newYears };
          });
        }} /></Row>
        <Row label="Inflation Rate"><NumInput value={ass.inflationRate} onChange={v => setAss('inflationRate', v)} pct step={0.1} /></Row>
        <Row label="CG Inclusion Rate"><NumInput value={ass.capitalGainsInclusionRate} onChange={v => setAss('capitalGainsInclusionRate', v)} pct step={0.5} /></Row>
      </Section>

      <Section title="Dividend Rates">
        <div className="text-xs text-[#9ca3af] mb-1">Eligible Dividends</div>
        <Row label="Gross-up"><NumInput value={ass.dividendRates.eligible.grossUp} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, grossUp: v } } } }))} pct /></Row>
        <Row label="Fed Credit %"><NumInput value={ass.dividendRates.eligible.federalCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, federalCredit: v } } } }))} pct /></Row>
        <Row label="Prov Credit %"><NumInput value={ass.dividendRates.eligible.provincialCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, eligible: { ...s.assumptions.dividendRates.eligible, provincialCredit: v } } } }))} pct /></Row>
        <div className="text-xs text-[#9ca3af] mt-2 mb-1">Non-Eligible Dividends</div>
        <Row label="Gross-up"><NumInput value={ass.dividendRates.nonEligible.grossUp} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, grossUp: v } } } }))} pct /></Row>
        <Row label="Fed Credit %"><NumInput value={ass.dividendRates.nonEligible.federalCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, federalCredit: v } } } }))} pct /></Row>
        <Row label="Prov Credit %"><NumInput value={ass.dividendRates.nonEligible.provincialCredit} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, dividendRates: { ...s.assumptions.dividendRates, nonEligible: { ...s.assumptions.dividendRates.nonEligible, provincialCredit: v } } } }))} pct /></Row>
      </Section>

      <Section title="CPP / QPP Parameters">
        <Row label="Basic Exemption"><NumInput value={ass.cpp.basicExemption} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, basicExemption: v } } }))} /></Row>
        <Row label="YMPE"><NumInput value={ass.cpp.ympe} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, ympe: v } } }))} /></Row>
        <Row label="YAMPE"><NumInput value={ass.cpp.yampe} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, yampe: v } } }))} /></Row>
        <Row label="Employee Rate %"><NumInput value={ass.cpp.employeeRate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, employeeRate: v } } }))} pct /></Row>
        <Row label="CPP2 Rate %"><NumInput value={ass.cpp.cpp2Rate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, cpp: { ...s.assumptions.cpp, cpp2Rate: v } } }))} pct /></Row>
      </Section>

      <Section title="EI Parameters">
        <Row label="Max Insurable"><NumInput value={ass.ei.maxInsurableEarnings} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, maxInsurableEarnings: v } } }))} /></Row>
        <Row label="Employee Rate %"><NumInput value={ass.ei.employeeRate} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, employeeRate: v } } }))} pct /></Row>
        <Row label="SE Opt-In">
          <input type="checkbox" checked={ass.ei.seOptIn} onChange={e => update(s => ({ ...s, assumptions: { ...s.assumptions, ei: { ...s.assumptions.ei, seOptIn: e.target.checked } } }))} className="accent-[#3b82f6]" />
        </Row>
      </Section>

      <Section title="Federal Tax Brackets">
        <Row label="Federal BPA"><NumInput value={ass.federalBPA} onChange={v => setAss('federalBPA', v)} /></Row>
        <BracketTable brackets={ass.federalBrackets} onChange={b => setAss('federalBrackets', b)} />
      </Section>

      <Section title="Provincial Tax Brackets">
        <Row label="Provincial BPA"><NumInput value={ass.provincialBPA} onChange={v => setAss('provincialBPA', v)} /></Row>
        <BracketTable brackets={ass.provincialBrackets} onChange={b => setAss('provincialBrackets', b)} />
      </Section>

      <Section title="Asset Return Assumptions">
        <Row label="Equity"><NumInput value={ass.assetReturns.equity} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, equity: v } } }))} pct /></Row>
        <Row label="Fixed Income"><NumInput value={ass.assetReturns.fixedIncome} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, fixedIncome: v } } }))} pct /></Row>
        <Row label="Cash"><NumInput value={ass.assetReturns.cash} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, cash: v } } }))} pct /></Row>
        <Row label="Savings"><NumInput value={ass.assetReturns.savings} onChange={v => update(s => ({ ...s, assumptions: { ...s.assumptions, assetReturns: { ...s.assumptions.assetReturns, savings: v } } }))} pct /></Row>
      </Section>

      <Section title="Contribution Limits">
        <Row label="RRSP Annual Cap"><NumInput value={ass.rrspLimit} onChange={v => setAss('rrspLimit', v)} /></Row>
        <Row label="RRSP % Earned Income"><NumInput value={ass.rrspPctEarnedIncome} onChange={v => setAss('rrspPctEarnedIncome', v)} pct /></Row>
        <Row label="TFSA Annual Limit"><NumInput value={ass.tfsaAnnualLimit} onChange={v => setAss('tfsaAnnualLimit', v)} /></Row>
        <Row label="FHSA Annual Limit"><NumInput value={ass.fhsaAnnualLimit} onChange={v => setAss('fhsaAnnualLimit', v)} /></Row>
        <Row label="FHSA Lifetime Limit"><NumInput value={ass.fhsaLifetimeLimit} onChange={v => setAss('fhsaLifetimeLimit', v)} /></Row>
      </Section>
    </div>
  );
}
