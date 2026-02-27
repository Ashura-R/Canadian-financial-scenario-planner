import React, { useState } from 'react';
import { useScenario, useWhatIf } from '../store/ScenarioContext';
import { formatCAD, formatPct, formatShort, safe } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { usePersistedState } from '../utils/usePersistedState';
import { ChartRangeSelector, sliceByRange } from '../components/ChartRangeSelector';
import type { ChartRange } from '../components/ChartRangeSelector';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import type { ComputedYear, AccountPnL } from '../types/computed';
import type { YearData, OpeningBalances } from '../types/scenario';
import { useChartColors } from '../hooks/useChartColors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app-border text-xs font-semibold text-app-text2 uppercase tracking-wide">{title}</div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-app-border last:border-0">
      <span className="text-xs text-app-text3">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${cls ?? 'text-app-text'}`}>{value}</span>
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
    {
      label: 'LIRA/LIF',
      opening: prevBalances.lira,
      contribution: 0,
      withdrawal: rawYd.lifWithdrawal,
      returnAmt: (prevBalances.lira - rawYd.lifWithdrawal) * yr.accounts.liraReturn,
      eoy: yr.accounts.liraEOY,
      hasOverride: rawYd.liraEOYOverride !== undefined,
    },
    {
      label: 'RESP',
      opening: prevBalances.resp,
      contribution: rawYd.respContribution + (yr.respCESG ?? 0),
      withdrawal: rawYd.respWithdrawal,
      returnAmt: (prevBalances.resp + rawYd.respContribution + (yr.respCESG ?? 0) - rawYd.respWithdrawal) * yr.accounts.respReturn,
      eoy: yr.accounts.respEOY,
      hasOverride: rawYd.respEOYOverride !== undefined,
    },
    {
      label: 'Life Ins.',
      opening: prevBalances.li,
      contribution: rawYd.liPremium ?? 0,
      withdrawal: rawYd.liWithdrawal ?? 0,
      returnAmt: (prevBalances.li + (rawYd.liPremium ?? 0) - (rawYd.liCOI ?? 0)) * yr.accounts.liReturn,
      eoy: yr.accounts.liCashValueEOY,
      hasOverride: rawYd.liEOYOverride !== undefined,
    },
  ];
}

function AccountFlowTable({ flows }: { flows: AccountFlowData[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-app-border">
          <th className="text-left py-1.5 text-[10px] text-app-text4 font-medium">Account</th>
          <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Opening</th>
          <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">+Contribution</th>
          <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">-Withdrawal</th>
          <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Return</th>
          <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">EOY</th>
        </tr>
      </thead>
      <tbody>
        {flows.map(f => (
          <tr key={f.label} className="border-b border-app-border hover:bg-app-accent-light/30">
            <td className="py-1.5 text-app-text2 font-medium">{f.label}</td>
            <td className="py-1.5 text-right text-app-text2">{formatCAD(f.opening)}</td>
            <td className="py-1.5 text-right text-emerald-600">{f.contribution > 0 ? '+' + formatCAD(f.contribution) : '—'}</td>
            <td className="py-1.5 text-right text-red-600">{f.withdrawal > 0 ? '-' + formatCAD(f.withdrawal) : '—'}</td>
            <td className="py-1.5 text-right text-app-accent">{formatCAD(f.returnAmt)}</td>
            <td className={`py-1.5 text-right font-semibold ${f.hasOverride ? 'text-amber-600' : 'text-app-text'}`}>
              {formatCAD(f.eoy)}{f.hasOverride ? ' *' : ''}
            </td>
          </tr>
        ))}
        <tr className="border-t border-app-border bg-app-surface2">
          <td className="py-1.5 font-semibold text-app-text2">Total</td>
          <td className="py-1.5 text-right font-semibold">{formatCAD(flows.reduce((s, f) => s + f.opening, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-emerald-600">{formatCAD(flows.reduce((s, f) => s + f.contribution, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-red-600">{formatCAD(flows.reduce((s, f) => s + f.withdrawal, 0))}</td>
          <td className="py-1.5 text-right font-semibold text-app-accent">{formatCAD(flows.reduce((s, f) => s + f.returnAmt, 0))}</td>
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
    lira: prev.accounts.liraEOY,
    resp: prev.accounts.respEOY,
    li: prev.accounts.liCashValueEOY,
  };
}

const ACCOUNT_COLORS = ['#2563eb', '#059669', '#06b6d4', '#d97706', '#0284c7', '#7c3aed', '#e11d48', '#84cc16'];

function NetWorthBreakdown({ yr }: { yr: ComputedYear }) {
  const chartColors = useChartColors();
  const accounts = [
    { label: 'RRSP', value: yr.accounts.rrspEOY, fill: ACCOUNT_COLORS[0] },
    { label: 'TFSA', value: yr.accounts.tfsaEOY, fill: ACCOUNT_COLORS[1] },
    { label: 'FHSA', value: yr.accounts.fhsaEOY, fill: ACCOUNT_COLORS[2] },
    { label: 'Non-Reg', value: yr.accounts.nonRegEOY, fill: ACCOUNT_COLORS[3] },
    { label: 'Savings', value: yr.accounts.savingsEOY, fill: ACCOUNT_COLORS[4] },
    { label: 'LIRA/LIF', value: yr.accounts.liraEOY, fill: ACCOUNT_COLORS[5] },
    { label: 'RESP', value: yr.accounts.respEOY, fill: ACCOUNT_COLORS[6] },
    { label: 'Life Ins.', value: yr.accounts.liCashValueEOY, fill: ACCOUNT_COLORS[7] },
  ];
  const pieData = accounts.filter(a => a.value > 0);

  return (
    <Section title="Net Worth Breakdown">
      <div className="flex gap-4">
        {/* Pie chart */}
        <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={65}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map(a => (
                    <Cell key={a.label} fill={a.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartColors.tooltipStyle} formatter={(v: number, name: string) => [formatCAD(v), name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[10px] text-app-text4">No balances</p>
            </div>
          )}
        </div>

        {/* Account list */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 content-start">
          {accounts.map(a => (
            <div key={a.label} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.fill }} />
                <span className="text-xs text-app-text3">{a.label}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium tabular-nums text-app-text">{formatShort(a.value)}</span>
                <span className="text-[10px] text-app-text4 ml-1">
                  {yr.accounts.netWorth > 0 ? formatPct(a.value / yr.accounts.netWorth) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {(yr.totalDebt ?? 0) > 0 && (
        <div className="mt-3 pt-2 border-t border-app-border flex items-center justify-between">
          <span className="text-xs text-red-600 font-medium">Total Debt</span>
          <span className="text-xs font-bold text-red-700">-{formatShort(yr.totalDebt ?? 0)}</span>
        </div>
      )}
    </Section>
  );
}

function AccountCompositionChart({ flows }: { flows: AccountFlowData[] }) {
  const chartColors = useChartColors();
  const data = flows.filter(f => f.eoy > 0).map(f => ({ name: f.label, Balance: Math.round(f.eoy) }));
  if (data.length === 0) return null;

  return (
    <Section title="Account Composition">
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
            <XAxis type="number" tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
            <YAxis type="category" dataKey="name" tick={chartColors.axisTick} width={60} />
            <Tooltip contentStyle={chartColors.tooltipStyle} formatter={(v: number) => [formatCAD(v), 'Balance']} />
            <Bar dataKey="Balance" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function AccountFlowChart({ flows }: { flows: AccountFlowData[] }) {
  const chartColors = useChartColors();
  const data = flows
    .filter(f => f.contribution > 0 || f.returnAmt !== 0 || f.withdrawal > 0)
    .map(f => ({
      name: f.label,
      Contributions: Math.round(f.contribution),
      Returns: Math.round(f.returnAmt),
      Withdrawals: Math.round(f.withdrawal),
    }));
  if (data.length === 0) return null;

  return (
    <Section title="Account Flows">
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
            <XAxis dataKey="name" tick={chartColors.axisTick} />
            <YAxis tickFormatter={v => formatShort(v)} tick={chartColors.axisTick} />
            <Tooltip contentStyle={chartColors.tooltipStyle} formatter={(v: number, name: string) => [formatCAD(v), name]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Contributions" fill="#059669" />
            <Bar dataKey="Returns" fill="#2563eb" />
            <Bar dataKey="Withdrawals" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

const PNL_LABELS: { key: keyof Omit<AccountPnL, 'totalBookValue' | 'totalMarketValue' | 'totalGain' | 'totalReturnPct'>; label: string; color: string }[] = [
  { key: 'rrsp', label: 'RRSP', color: '#3b82f6' },
  { key: 'tfsa', label: 'TFSA', color: '#10b981' },
  { key: 'fhsa', label: 'FHSA', color: '#06b6d4' },
  { key: 'nonReg', label: 'Non-Reg', color: '#f59e0b' },
  { key: 'savings', label: 'Savings', color: '#0ea5e9' },
  { key: 'lira', label: 'LIRA/LIF', color: '#a855f7' },
  { key: 'resp', label: 'RESP', color: '#f43f5e' },
  { key: 'li', label: 'Life Ins.', color: '#84cc16' },
];

function PnLTable({ pnl }: { pnl: AccountPnL }) {
  return (
    <Section title="Profit & Loss by Account">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-app-border">
            <th className="text-left py-1.5 text-[10px] text-app-text4 font-medium">Account</th>
            <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Book Value</th>
            <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Market Value</th>
            <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Gain/Loss</th>
            <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Return %</th>
          </tr>
        </thead>
        <tbody>
          {PNL_LABELS.map(({ key, label, color }) => {
            const e = pnl[key];
            if (e.marketValue === 0 && e.bookValue === 0) return null;
            return (
              <tr key={key} className="border-b border-app-border hover:bg-app-accent-light/30">
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-app-text2 font-medium">{label}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right text-app-text3 tabular-nums">{formatCAD(e.bookValue)}</td>
                <td className="py-1.5 text-right text-app-text tabular-nums font-medium">{formatCAD(e.marketValue)}</td>
                <td className={`py-1.5 text-right tabular-nums font-medium ${e.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.gain >= 0 ? '+' : ''}{formatCAD(e.gain)}
                </td>
                <td className={`py-1.5 text-right tabular-nums ${e.returnPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.returnPct >= 0 ? '+' : ''}{(e.returnPct * 100).toFixed(1)}%
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-app-border bg-app-surface2">
            <td className="py-1.5 font-semibold text-app-text2">Total</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{formatCAD(pnl.totalBookValue)}</td>
            <td className="py-1.5 text-right font-bold tabular-nums">{formatCAD(pnl.totalMarketValue)}</td>
            <td className={`py-1.5 text-right font-bold tabular-nums ${pnl.totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {pnl.totalGain >= 0 ? '+' : ''}{formatCAD(pnl.totalGain)}
            </td>
            <td className={`py-1.5 text-right font-semibold tabular-nums ${pnl.totalReturnPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {pnl.totalReturnPct >= 0 ? '+' : ''}{(pnl.totalReturnPct * 100).toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AccountCompositionChart flows={flows} />
        <AccountFlowChart flows={flows} />
      </div>

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
          <Row label="LIRA/LIF" value={formatPct(yr.accounts.liraReturn)} />
          <Row label="RESP" value={formatPct(yr.accounts.respReturn)} />
          <Row label="Life Ins." value={formatPct(yr.accounts.liReturn)} />
        </Section>
      </div>

      {yr.liabilities && yr.liabilities.length > 0 && (
        <Section title="Liabilities">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-app-border">
                <th className="text-left py-1.5 text-[10px] text-app-text4 font-medium">Liability</th>
                <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Opening</th>
                <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Interest</th>
                <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Principal</th>
                <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Payment</th>
                <th className="text-right py-1.5 text-[10px] text-app-text4 font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {yr.liabilities.map(l => (
                <tr key={l.id} className="border-b border-app-border hover:bg-red-50/30">
                  <td className="py-1.5 text-app-text2 font-medium">{l.label}</td>
                  <td className="py-1.5 text-right text-app-text2">{formatCAD(l.openingBalance)}</td>
                  <td className="py-1.5 text-right text-red-600">{formatCAD(l.interestPaid)}</td>
                  <td className="py-1.5 text-right text-emerald-600">{formatCAD(l.principalPaid)}</td>
                  <td className="py-1.5 text-right text-app-text2">{formatCAD(l.totalPayment)}</td>
                  <td className="py-1.5 text-right font-semibold text-red-700">{formatCAD(l.closingBalance)}</td>
                </tr>
              ))}
              {yr.liabilities.length > 1 && (
                <tr className="border-t border-app-border bg-app-surface2">
                  <td className="py-1.5 font-semibold text-app-text2">Total</td>
                  <td className="py-1.5 text-right font-semibold">{formatCAD(yr.liabilities.reduce((s, l) => s + l.openingBalance, 0))}</td>
                  <td className="py-1.5 text-right font-semibold text-red-600">{formatCAD(yr.totalInterestPaid ?? 0)}</td>
                  <td className="py-1.5 text-right font-semibold text-emerald-600">{formatCAD(yr.liabilities.reduce((s, l) => s + l.principalPaid, 0))}</td>
                  <td className="py-1.5 text-right font-semibold">{formatCAD(yr.totalDebtPayment ?? 0)}</td>
                  <td className="py-1.5 text-right font-bold text-red-700">{formatCAD(yr.totalDebt ?? 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      )}

      {yr.pnl && <PnLTable pnl={yr.pnl} />}

      <NetWorthBreakdown yr={yr} />
    </div>
  );
}

function AllYearsView({ years, rawYears, openingBalances }: {
  years: ComputedYear[];
  rawYears: YearData[];
  openingBalances: OpeningBalances;
}) {
  const chartColors = useChartColors();
  const [chartRange, setChartRange] = usePersistedState<ChartRange>('cdn-tax-chart-range-accounts', 'all');
  const chartYears = sliceByRange(years, chartRange);

  // Stacked bar chart data
  const barData = chartYears.map(yr => ({
    year: yr.year,
    RRSP: safe(yr.accounts.rrspEOY),
    TFSA: safe(yr.accounts.tfsaEOY),
    FHSA: safe(yr.accounts.fhsaEOY),
    'Non-Reg': safe(yr.accounts.nonRegEOY),
    Savings: safe(yr.accounts.savingsEOY),
    'LIRA/LIF': safe(yr.accounts.liraEOY),
    RESP: safe(yr.accounts.respEOY),
    'Life Ins.': safe(yr.accounts.liCashValueEOY),
  }));

  // Returns chart data
  const returnData = chartYears.map(yr => ({
    year: yr.year,
    RRSP: safe(yr.accounts.rrspReturn * 100),
    TFSA: safe(yr.accounts.tfsaReturn * 100),
    FHSA: safe(yr.accounts.fhsaReturn * 100),
    'Non-Reg': safe(yr.accounts.nonRegReturn * 100),
    Savings: safe(yr.accounts.savingsReturn * 100),
    'LIRA/LIF': safe(yr.accounts.liraReturn * 100),
    RESP: safe(yr.accounts.respReturn * 100),
    'Life Ins.': safe(yr.accounts.liReturn * 100),
  }));

  return (
    <div className="space-y-4">
      {/* Net Worth Composition chart */}
      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
          <div className="text-xs font-semibold text-app-text2 uppercase tracking-wide">Net Worth Composition Over Time</div>
          <ChartRangeSelector value={chartRange} onChange={setChartRange} />
        </div>
        <div className="px-4 py-3">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={v => formatShort(v as number)} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} labelStyle={chartColors.labelStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
              <Legend wrapperStyle={chartColors.legendStyle} />
              <Bar dataKey="RRSP" stackId="a" fill="#3b82f6" />
              <Bar dataKey="TFSA" stackId="a" fill="#10b981" />
              <Bar dataKey="FHSA" stackId="a" fill="#06b6d4" />
              <Bar dataKey="Non-Reg" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Savings" stackId="a" fill="#0ea5e9" />
              <Bar dataKey="LIRA/LIF" stackId="a" fill="#a855f7" />
              <Bar dataKey="RESP" stackId="a" fill="#f43f5e" />
              <Bar dataKey="Life Ins." stackId="a" fill="#84cc16" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>

      {/* Return Performance chart */}
      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
          <div className="text-xs font-semibold text-app-text2 uppercase tracking-wide">Blended Return % by Account</div>
          <ChartRangeSelector value={chartRange} onChange={setChartRange} />
        </div>
        <div className="px-4 py-3">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={returnData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis dataKey="year" tick={chartColors.axisTick} />
              <YAxis tickFormatter={v => `${v}%`} tick={chartColors.axisTick} />
              <Tooltip contentStyle={chartColors.tooltipStyle} labelStyle={chartColors.labelStyle} formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
              <Legend wrapperStyle={chartColors.legendStyle} />
              <Line type="monotone" dataKey="RRSP" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="TFSA" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="FHSA" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Non-Reg" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Savings" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="LIRA/LIF" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="RESP" stroke="#f43f5e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Life Ins." stroke="#84cc16" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>

      {/* Book Value vs Market Value chart */}
      {chartYears.some(yr => yr.pnl) && (
        <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
            <div className="text-xs font-semibold text-app-text2 uppercase tracking-wide">Book Value vs Market Value</div>
            <ChartRangeSelector value={chartRange} onChange={setChartRange} />
          </div>
          <div className="px-4 py-3">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartYears.map(yr => ({
                  year: yr.year,
                  'Book Value': Math.round(yr.pnl?.totalBookValue ?? 0),
                  'Market Value': Math.round(yr.pnl?.totalMarketValue ?? 0),
                }))} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                  <XAxis dataKey="year" tick={chartColors.axisTick} />
                  <YAxis tickFormatter={v => formatShort(v as number)} tick={chartColors.axisTick} />
                  <Tooltip contentStyle={chartColors.tooltipStyle} labelStyle={chartColors.labelStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
                  <Legend wrapperStyle={chartColors.legendStyle} />
                  <Area type="monotone" dataKey="Book Value" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} strokeWidth={2} />
                  <Area type="monotone" dataKey="Market Value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Unrealized Gain/Loss chart */}
      {chartYears.some(yr => yr.pnl && yr.pnl.totalGain !== 0) && (
        <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
            <div className="text-xs font-semibold text-app-text2 uppercase tracking-wide">Unrealized Gain/Loss Over Time</div>
            <ChartRangeSelector value={chartRange} onChange={setChartRange} />
          </div>
          <div className="px-4 py-3">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartYears.map(yr => ({
                  year: yr.year,
                  Gain: Math.round(yr.pnl?.totalGain ?? 0),
                  'Return %': Number(((yr.pnl?.totalReturnPct ?? 0) * 100).toFixed(2)),
                }))} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
                  <XAxis dataKey="year" tick={chartColors.axisTick} />
                  <YAxis yAxisId="left" tickFormatter={v => formatShort(v as number)} tick={chartColors.axisTick} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={chartColors.axisTick} />
                  <Tooltip contentStyle={chartColors.tooltipStyle} labelStyle={chartColors.labelStyle} formatter={(v: number, name: string) => name === 'Return %' ? [`${v.toFixed(1)}%`, name] : [formatShort(v), name]} />
                  <Legend wrapperStyle={chartColors.legendStyle} />
                  <Bar yAxisId="left" dataKey="Gain" fill="#10b981" fillOpacity={0.6} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="Return %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* YoY Balance Table */}
      <Section title="Year-over-Year Account Balances">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-app-surface2">
                <th className="py-1.5 px-2 text-left text-[10px] text-app-text3 font-semibold">Year</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-accent font-semibold">RRSP</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-emerald-600 font-semibold">TFSA</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-cyan-600 font-semibold">FHSA</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-amber-600 font-semibold">Non-Reg</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-sky-600 font-semibold">Savings</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-purple-600 font-semibold">LIRA/LIF</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-rose-600 font-semibold">RESP</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-lime-600 font-semibold">Life Ins.</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text2 font-bold">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, i) => (
                <tr key={yr.year} className={`border-b border-app-border hover:bg-app-accent-light/30 ${i % 2 === 1 ? 'bg-app-surface2/50' : ''}`}>
                  <td className="py-1 px-2 text-app-text2 font-medium">{yr.year}</td>
                  <td className="py-1 px-2 text-right text-app-accent">{formatShort(yr.accounts.rrspEOY)}</td>
                  <td className="py-1 px-2 text-right text-emerald-600">{formatShort(yr.accounts.tfsaEOY)}</td>
                  <td className="py-1 px-2 text-right text-cyan-600">{formatShort(yr.accounts.fhsaEOY)}</td>
                  <td className="py-1 px-2 text-right text-amber-600">{formatShort(yr.accounts.nonRegEOY)}</td>
                  <td className="py-1 px-2 text-right text-sky-600">{formatShort(yr.accounts.savingsEOY)}</td>
                  <td className="py-1 px-2 text-right text-purple-600">{formatShort(yr.accounts.liraEOY)}</td>
                  <td className="py-1 px-2 text-right text-rose-600">{formatShort(yr.accounts.respEOY)}</td>
                  <td className="py-1 px-2 text-right text-lime-600">{formatShort(yr.accounts.liCashValueEOY)}</td>
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
              <tr className="border-b border-app-border bg-app-surface2">
                <th className="py-1.5 px-2 text-left text-[10px] text-app-text3 font-semibold">Year</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text3 font-semibold">RRSP Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text3 font-semibold">TFSA Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text3 font-semibold">FHSA Lifetime</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text3 font-semibold">FHSA Unused Room</th>
                <th className="py-1.5 px-2 text-right text-[10px] text-app-text3 font-semibold">Capital Loss C/F</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, i) => (
                <tr key={yr.year} className={`border-b border-app-border ${i % 2 === 1 ? 'bg-app-surface2/50' : ''}`}>
                  <td className="py-1 px-2 text-app-text2 font-medium">{yr.year}</td>
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
  const { isActive: isWhatIfMode, computed: whatIfComputed } = useWhatIf();
  const [viewMode, setViewModeRaw] = useState<'single' | 'all'>(() => {
    try { const v = localStorage.getItem('cdn-tax-accounts-view'); return v === 'all' ? 'all' : 'single'; } catch { return 'single'; }
  });
  function setViewMode(v: 'single' | 'all') { setViewModeRaw(v); try { localStorage.setItem('cdn-tax-accounts-view', v); } catch {} }

  if (!activeComputed || !activeScenario) {
    return <div className="p-8 text-app-text4 text-sm">No scenario data.</div>;
  }

  const displayComputed = (isWhatIfMode && whatIfComputed) ? whatIfComputed : activeComputed;
  const years = displayComputed.years;
  const [selectedYearIdx, setSelectedYearIdx] = usePersistedYear(years.length - 1);
  const rawYears = displayComputed.effectiveYears;
  const yr = years[selectedYearIdx] ?? years[0];
  const rawYd = rawYears[selectedYearIdx] ?? rawYears[0];

  if (!yr) return null;

  const prevBalances = buildPrevBalances(selectedYearIdx, years, activeScenario.openingBalances);

  return (
    <div className="h-full overflow-auto bg-app-bg">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">Accounts</div>
            {isWhatIfMode && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                What-If Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'single' && (
              <select
                className="text-xs border border-app-border rounded px-2 py-1 bg-app-surface text-app-text2 outline-none focus:border-app-accent"
                value={selectedYearIdx}
                onChange={e => setSelectedYearIdx(Number(e.target.value))}
              >
                {years.map((y, i) => (
                  <option key={y.year} value={i}>{y.year}</option>
                ))}
              </select>
            )}
            <div className="flex border border-app-border rounded overflow-hidden">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1 text-xs transition-colors ${viewMode === 'single' ? 'bg-app-accent text-white' : 'bg-app-surface text-app-text2 hover:bg-app-surface2'}`}
              >Single Year</button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-xs transition-colors ${viewMode === 'all' ? 'bg-app-accent text-white' : 'bg-app-surface text-app-text2 hover:bg-app-surface2'}`}
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
