import React, { useState } from 'react';
import { useScenario } from '../store/ScenarioContext';
import { formatCAD, formatPct, formatShort } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { ChartRangeSelector, sliceByRange } from '../components/ChartRangeSelector';
import type { ChartRange } from '../components/ChartRangeSelector';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line,
} from 'recharts';
import type { ComputedYear } from '../types/computed';
import type { YearData, OpeningBalances } from '../types/scenario';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${cls ?? 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

interface AccountFlowData {
  label: string;
  opening: number;
  contribution: number;
  withdrawal: number;
  returnAmt: number;
  eoy: number;
  hasOverride: boolean;
}

function getAccountFlows(
  yr: ComputedYear,
  rawYd: YearData,
  prevBalances: OpeningBalances
): AccountFlowData[] {
  return [
    {
      label: 'RRSP',
      opening: prevBalances.rrsp,
      contribution: rawYd.rrspContribution,
      withdrawal: rawYd.rrspWithdrawal,
      returnAmt: (prevBalances.rrsp + rawYd.rrspContribution - rawYd.rrspWithdrawal) * yr.accounts.rrspReturn,
      eoy: yr.accounts.rrspEOY,
      hasOverride: rawYd.rrspEOYOverride !== undefined,
    },
    {
      label: 'TFSA',
      opening: prevBalances.tfsa,
      contribution: rawYd.tfsaContribution,
      withdrawal: rawYd.tfsaWithdrawal,
      returnAmt: (prevBalances.tfsa + rawYd.tfsaContribution - rawYd.tfsaWithdrawal) * yr.accounts.tfsaReturn,
      eoy: yr.accounts.tfsaEOY,
      hasOverride: rawYd.tfsaEOYOverride !== undefined,
    },
    {
      label: 'FHSA',
      opening: prevBalances.fhsa,
      contribution: rawYd.fhsaContribution,
      withdrawal: rawYd.fhsaWithdrawal,
      returnAmt: (prevBalances.fhsa + rawYd.fhsaContribution - rawYd.fhsaWithdrawal) * yr.accounts.fhsaReturn,
      eoy: yr.accounts.fhsaEOY,
      hasOverride: rawYd.fhsaEOYOverride !== undefined,
    },
    {
      label: 'Non-Reg',
      opening: prevBalances.nonReg,
      contribution: rawYd.nonRegContribution,
      withdrawal: rawYd.nonRegWithdrawal,
      returnAmt: (prevBalances.nonReg + rawYd.nonRegContribution - rawYd.nonRegWithdrawal) * yr.accounts.nonRegReturn,
      eoy: yr.accounts.nonRegEOY,
      hasOverride: rawYd.nonRegEOYOverride !== undefined,
    },
    {
      label: 'Savings',
      opening: prevBalances.savings,
      contribution: rawYd.savingsDeposit,
      withdrawal: rawYd.savingsWithdrawal,
      returnAmt: (prevBalances.savings + rawYd.savingsDeposit - rawYd.savingsWithdrawal) * yr.accounts.savingsReturn,
      eoy: yr.accounts.savingsEOY,
      hasOverride: rawYd.savingsEOYOverride !== undefined,
    },
  ];
}

function AccountFlowTable({ flows }: { flows: AccountFlowData[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-1.5 text-[10px] text-slate-400 font-medium">Account</th>
          <th className="text-right py-1.5 text-[10px] text-slate-400 font-medium">Opening</th>
          <th className="text-right py-1.5 text-[10px] text-slate-400 font-medium">+Contribution</th>
          <th className="text-right py-1.5 text-[10px] text-slate-400 font-medium">-Withdrawal</th>
          <th className="text-right py-1.5 text-[10px] text-slate-400 font-medium">Return</th>
          <th className="text-right py-1.5 text-[10px] text-slate-400 font-medium">EOY</th>
        </tr>
      </thead>
      <tbody>
        {flows.map(f => (
          <tr key={f.label} className="border-b border-slate-50 hover:bg-blue-50/30">
            <td className="py-1.5 text-slate-600 font-medium">{f.label}</td>
            <td className="py-1.5 text-right text-slate-600">{formatCAD(f.opening)}</td>
            <td className="py-1.5 text-right text-emerald-600">{f.contribution > 0 ? '+' + formatCAD(f.contribution) : '—'}</td>
            <td className="py-1.5 text-right text-red-600">{f.withdrawal > 0 ? '-' + formatCAD(f.withdrawal) : '—'}</td>
            <td className="py-1.5 text-right text-blue-600">{formatCAD(f.returnAmt)}</td>
            <td className={`py-1.5 text-right font-semibold ${f.hasOverride ? 'text-amber-600' : 'text-slate-800'}`}>
              {formatCAD(f.eoy)}{f.hasOverride ? ' *' : ''}
            </td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50">
          <td className="py-1.5 font-semibold text-slate-700">Total</td>
          <td className="py-1.5 text-right font-semibold">{formatCAD(flows.reduce((s, f) => s + f.opening, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-emerald-600">{formatCAD(flows.reduce((s, f) => s + f.contribution, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-red-600">{formatCAD(flows.reduce((s, f) => s + f.withdrawal, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-blue-600">{formatCAD(flows.reduce((s, f) => s + f.returnAmt, 0))}</td>
          <td className="py-1.5 text-right font-bold">{formatCAD(flows.reduce((s, f) => s + f.eoy, 0))}</td>
        </tr>
      </tbody>
    </table>
  );
}

function buildPrevBalances(
  yearIdx: number,
  computedYears: ComputedYear[],
  openingBalances: OpeningBalances
): OpeningBalances {
  if (yearIdx === 0) return openingBalances;
  const prev = computedYears[yearIdx - 1];
  return {
    rrsp: prev.accounts.rrspEOY,
    tfsa: prev.accounts.tfsaEOY,
    fhsa: prev.accounts.fhsaEOY,
    nonReg: prev.accounts.nonRegEOY,
    savings: prev.accounts.savingsEOY,
  };
}

function SingleYearView({ yr, rawYd, prevBalances }: {
  yr: ComputedYear;
  rawYd: YearData;
  prevBalances: OpeningBalances;
}) {
  const flows = getAccountFlows(yr, rawYd, prevBalances);

  return (
    <div className="space-y-4">
      <Section title="Account Balance Flow">
        <AccountFlowTable flows={flows} />
      </Section>

      <div className="grid grid-cols-2 gap-4">
        <Section title="Room Tracking">
          <Row label="RRSP Unused Room" value={formatCAD(yr.rrspUnusedRoom)} />
          <Row label="TFSA Unused Room" value={formatCAD(yr.tfsaUnusedRoom)} />
          <Row label="FHSA Lifetime Contributions" value={formatCAD(yr.fhsaContribLifetime)} />
          <Row label="FHSA Unused Room" value={formatCAD(yr.fhsaUnusedRoom)} />
          <Row label="Capital Loss C/F" value={formatCAD(yr.capitalLossCF)} />
        </Section>

        <Section title="Blended Returns">
          <Row label="RRSP" value={formatPct(yr.accounts.rrspReturn)} />
          <Row label="TFSA" value={formatPct(yr.accounts.tfsaReturn)} />
          <Row label="FHSA" value={formatPct(yr.accounts.fhsaReturn)} />
          <Row label="Non-Reg" value={formatPct(yr.accounts.nonRegReturn)} />
          <Row label="Savings" value={formatPct(yr.accounts.savingsReturn)} />
        </Section>
      </div>

      <Section title="Net Worth Breakdown">
        <div className="grid grid-cols-5 gap-4 text-center">
          {[
            { label: 'RRSP', value: yr.accounts.rrspEOY, color: 'text-blue-600' },
            { label: 'TFSA', value: yr.accounts.tfsaEOY, color: 'text-emerald-600' },
            { label: 'FHSA', value: yr.accounts.fhsaEOY, color: 'text-cyan-600' },
            { label: 'Non-Reg', value: yr.accounts.nonRegEOY, color: 'text-amber-600' },
            { label: 'Savings', value: yr.accounts.savingsEOY, color: 'text-sky-600' },
          ].map(a => (
            <div key={a.label}>
              <div className={`text-lg font-bold tabular-nums ${a.color}`}>{formatShort(a.value)}</div>
              <div className="text-xs text-slate-500">{a.label}</div>
              <div className="text-[10px] text-slate-400">
                {yr.accounts.netWorth > 0 ? formatPct(a.value / yr.accounts.netWorth) : '—'}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AllYearsView({ years, rawYears, openingBalances }: {
  years: ComputedYear[];
  rawYears: YearData[];
  openingBalances: OpeningBalances;
}) {
  const [chartRange, setChartRange] = useState<ChartRange>('all');
  const chartYears = sliceByRange(years, chartRange);

  const tooltipStyle = {
    contentStyle: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 },
    labelStyle: { color: '#0f172a' },
  };

  // Stacked bar chart data
  const barData = chartYears.map(yr => ({
    year: yr.year,
    RRSP: yr.accounts.rrspEOY,
    TFSA: yr.accounts.tfsaEOY,
    FHSA: yr.accounts.fhsaEOY,
    'Non-Reg': yr.accounts.nonRegEOY,
    Savings: yr.accounts.savingsEOY,
  }));

  // Returns chart data
  const returnData = chartYears.map(yr => ({
    year: yr.year,
    RRSP: yr.accounts.rrspReturn * 100,
    TFSA: yr.accounts.tfsaReturn * 100,
    FHSA: yr.accounts.fhsaReturn * 100,
    'Non-Reg': yr.accounts.nonRegReturn * 100,
    Savings: yr.accounts.savingsReturn * 100,
  }));

  return (
    <div className="space-y-4">
      {/* Net Worth Composition chart */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Net Worth Composition Over Time</div>
          <ChartRangeSelector value={chartRange} onChange={setChartRange} />
        </div>
        <div className="px-4 py-3">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tickFormatter={v => formatShort(v as number)} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Bar dataKey="RRSP" stackId="a" fill="#3b82f6" />
              <Bar dataKey="TFSA" stackId="a" fill="#10b981" />
              <Bar dataKey="FHSA" stackId="a" fill="#06b6d4" />
              <Bar dataKey="Non-Reg" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Savings" stackId="a" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>

      {/* Return Performance chart */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Blended Return % by Account</div>
          <ChartRangeSelector value={chartRange} onChange={setChartRange} />
        </div>
        <div className="px-4 py-3">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={returnData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Line type="monotone" dataKey="RRSP" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="TFSA" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="FHSA" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Non-Reg" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Savings" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>

      {/* YoY Balance Table */}
      <Section title="Year-over-Year Account Balances">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 text-left text-[10px] text-slate-500 font-semibold">Year</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-blue-600 font-semibold">RRSP</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-emerald-600 font-semibold">TFSA</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-cyan-600 font-semibold">FHSA</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-amber-600 font-semibold">Non-Reg</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-sky-600 font-semibold">Savings</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-700 font-bold">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, i) => (
                <tr key={yr.year} className={`border-b border-slate-100 hover:bg-blue-50/30 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="py-1 px-2 text-slate-700 font-medium">{yr.year}</td>
                  <td className="py-1 px-2 text-right text-blue-600">{formatShort(yr.accounts.rrspEOY)}</td>
                  <td className="py-1 px-2 text-right text-emerald-600">{formatShort(yr.accounts.tfsaEOY)}</td>
                  <td className="py-1 px-2 text-right text-cyan-600">{formatShort(yr.accounts.fhsaEOY)}</td>
                  <td className="py-1 px-2 text-right text-amber-600">{formatShort(yr.accounts.nonRegEOY)}</td>
                  <td className="py-1 px-2 text-right text-sky-600">{formatShort(yr.accounts.savingsEOY)}</td>
                  <td className="py-1 px-2 text-right font-semibold">{formatShort(yr.accounts.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Room tracking over time */}
      <Section title="Room Tracking Over Time">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 text-left text-[10px] text-slate-500 font-semibold">Year</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-500 font-semibold">RRSP Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-500 font-semibold">TFSA Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-500 font-semibold">FHSA Lifetime</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-500 font-semibold">FHSA Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-slate-500 font-semibold">Capital Loss C/F</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, i) => (
                <tr key={yr.year} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="py-1 px-2 text-slate-700 font-medium">{yr.year}</td>
                  <td className="py-1 px-2 text-right">{formatCAD(yr.rrspUnusedRoom)}</td>
                  <td className="py-1 px-2 text-right">{formatCAD(yr.tfsaUnusedRoom)}</td>
                  <td className="py-1 px-2 text-right">{formatCAD(yr.fhsaContribLifetime)}</td>
                  <td className="py-1 px-2 text-right">{formatCAD(yr.fhsaUnusedRoom)}</td>
                  <td className="py-1 px-2 text-right">{formatCAD(yr.capitalLossCF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

export function AccountsPage() {
  const { activeComputed, activeScenario } = useScenario();
  const [viewMode, setViewModeRaw] = useState<'single' | 'all'>(() => {
    try { const v = localStorage.getItem('cdn-tax-accounts-view'); return v === 'all' ? 'all' : 'single'; } catch { return 'single'; }
  });
  function setViewMode(v: 'single' | 'all') { setViewModeRaw(v); try { localStorage.setItem('cdn-tax-accounts-view', v); } catch {} }

  if (!activeComputed || !activeScenario) {
    return <div className="p-8 text-slate-400 text-sm">No scenario data.</div>;
  }

  const years = activeComputed.years;
  const [selectedYearIdx, setSelectedYearIdx] = usePersistedYear(years.length - 1);
  const rawYears = activeScenario.years;
  const yr = years[selectedYearIdx] ?? years[0];
  const rawYd = rawYears[selectedYearIdx] ?? rawYears[0];

  if (!yr) return null;

  const prevBalances = buildPrevBalances(selectedYearIdx, years, activeScenario.openingBalances);

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Accounts</div>
          <div className="flex items-center gap-3">
            {viewMode === 'single' && (
              <select
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none focus:border-blue-500"
                value={selectedYearIdx}
                onChange={e => setSelectedYearIdx(Number(e.target.value))}
              >
                {years.map((y, i) => (
                  <option key={y.year} value={i}>{y.year}</option>
                ))}
              </select>
            )}
            <div className="flex border border-slate-200 rounded overflow-hidden">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1 text-xs transition-colors ${viewMode === 'single' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >Single Year</button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-xs transition-colors ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >All Years</button>
            </div>
          </div>
        </div>

        {viewMode === 'single' ? (
          <SingleYearView yr={yr} rawYd={rawYd} prevBalances={prevBalances} />
        ) : (
          <AllYearsView years={years} rawYears={rawYears} openingBalances={activeScenario.openingBalances} />
        )}
      </div>
    </div>
  );
}
