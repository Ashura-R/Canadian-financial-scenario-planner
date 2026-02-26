import React, { useMemo } from 'react';
import { useScenario, useWhatIf } from '../store/ScenarioContext';
import { formatCAD, formatShort, safe } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { usePersistedState } from '../utils/usePersistedState';
import { ChartRangeSelector, sliceByRange } from '../components/ChartRangeSelector';
import type { ChartRange } from '../components/ChartRangeSelector';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import type { ComputedYear } from '../types/computed';
import type { YearData } from '../types/scenario';
import { useChartColors } from '../hooks/useChartColors';

/* ─── Helpers ─── */

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between">
        <span className="text-xs font-semibold text-app-text2 uppercase tracking-wide">{title}</span>
        {right}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, cls, hint }: { label: string; value: string; cls?: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-app-border last:border-0">
      <div className="flex flex-col">
        <span className="text-xs text-app-text3">{label}</span>
        {hint && <span className="text-[10px] text-app-text4">{hint}</span>}
      </div>
      <span className={`text-xs font-medium tabular-nums ${cls ?? 'text-app-text'}`}>{value}</span>
    </div>
  );
}

function KPI({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-app-text4 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-lg font-bold text-app-text tabular-nums">{value}</div>
      {subtitle && <div className="text-[10px] text-app-text4">{subtitle}</div>}
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  { key: 'housingExpense' as const, label: 'Housing', color: '#6366f1' },
  { key: 'groceriesExpense' as const, label: 'Groceries', color: '#22c55e' },
  { key: 'transportationExpense' as const, label: 'Transportation', color: '#f59e0b' },
  { key: 'utilitiesExpense' as const, label: 'Utilities', color: '#3b82f6' },
  { key: 'insuranceExpense' as const, label: 'Insurance', color: '#8b5cf6' },
  { key: 'entertainmentExpense' as const, label: 'Entertainment', color: '#ec4899' },
  { key: 'personalExpense' as const, label: 'Personal', color: '#14b8a6' },
  { key: 'otherLivingExpense' as const, label: 'Other', color: '#94a3b8' },
];

const DEDUCTIBLE_CATEGORIES = [
  { key: 'selfEmploymentExpenses' as const, label: 'SE Expenses', hint: 'Offsets SE income' },
  { key: 'childCareExpenses' as const, label: 'Child Care', hint: 'Line 21400' },
  { key: 'medicalExpenses' as const, label: 'Medical', hint: 'Non-refundable credit' },
  { key: 'unionDues' as const, label: 'Union/Prof. Dues', hint: 'Line 21200' },
  { key: 'studentLoanInterest' as const, label: 'Student Loan Interest', hint: 'Non-refundable credit' },
  { key: 'movingExpenses' as const, label: 'Moving Expenses', hint: 'Line 21900' },
  { key: 'charitableDonations' as const, label: 'Donations', hint: 'Non-refundable credit' },
  { key: 'otherDeductions' as const, label: 'Other Deductions', hint: 'Line 23200' },
];

type ExpenseKey = typeof EXPENSE_CATEGORIES[number]['key'];

function getExpenseTotal(yd: YearData): number {
  return EXPENSE_CATEGORIES.reduce((s, c) => s + ((yd[c.key] as number) ?? 0), 0);
}

function getDeductibleTotal(yd: YearData): number {
  return DEDUCTIBLE_CATEGORIES.reduce((s, c) => s + ((yd[c.key] as number) ?? 0), 0);
}

/* ─── Main Page ─── */

export function ExpensesPage() {
  const { activeScenario, activeComputed } = useScenario();
  const { computed: whatIfComputed, isActive: isWhatIf } = useWhatIf();
  const cc = useChartColors();

  const computed = isWhatIf && whatIfComputed ? whatIfComputed : activeComputed;
  const [yearIdx, setYearIdx] = usePersistedYear((computed?.years.length ?? 1) - 1);
  const [chartRange, setChartRange] = usePersistedState<ChartRange>('cdn-tax-expenses-range', 'all');

  if (!activeScenario || !computed) return null;

  const years = computed.years;
  const effectiveYears = computed.effectiveYears;
  const yr = years[yearIdx];
  const eyd = effectiveYears[yearIdx];
  if (!yr || !eyd) return null;

  const startYear = activeScenario.assumptions.startYear;
  const liabilities = activeScenario.liabilities ?? [];
  const hasLiabilities = liabilities.length > 0;

  const livingTotal = getExpenseTotal(eyd);
  const deductibleTotal = getDeductibleTotal(eyd);
  const debtPayment = yr.totalDebtPayment ?? 0;
  const allExpensesTotal = livingTotal + deductibleTotal + debtPayment;

  // Chart data for stacked area over time
  const areaData = sliceByRange(
    effectiveYears.map((ey, i) => {
      const row: Record<string, number> = { year: ey.year };
      for (const c of EXPENSE_CATEGORIES) row[c.key] = (ey[c.key] as number) ?? 0;
      row.deductible = getDeductibleTotal(ey);
      row.debt = years[i]?.totalDebtPayment ?? 0;
      row.total = getExpenseTotal(ey) + row.deductible + row.debt;
      return row;
    }),
    chartRange,
  );

  // Pie data for current year breakdown
  const pieData = EXPENSE_CATEGORIES
    .map(c => ({ name: c.label, value: (eyd[c.key] as number) ?? 0, color: c.color }))
    .filter(d => d.value > 0);
  if (deductibleTotal > 0) pieData.push({ name: 'Tax-Deductible', value: deductibleTotal, color: '#ef4444' });
  if (debtPayment > 0) pieData.push({ name: 'Debt Payments', value: debtPayment, color: '#78716c' });

  // Cash flow context
  const afterTax = yr.waterfall.afterTaxIncome;
  const expenseRatio = afterTax > 0 ? allExpensesTotal / afterTax : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-app-text">Expenses & Budget</h2>
          <p className="text-[11px] text-app-text4 mt-0.5">Living expenses, tax-deductible costs, and debt payments</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-app-text3">Year</label>
          <select
            className="text-sm bg-app-surface border border-app-border rounded px-2 py-1 text-app-text"
            value={yearIdx}
            onChange={e => setYearIdx(Number(e.target.value))}
          >
            {years.map((y, i) => (
              <option key={y.year} value={i}>{y.year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4 bg-app-surface border border-app-border rounded-lg px-4 py-3">
        <KPI label="Living Expenses" value={formatCAD(livingTotal)} />
        <KPI label="Tax-Deductible" value={formatCAD(deductibleTotal)} />
        <KPI label="Debt Payments" value={formatCAD(debtPayment)} />
        <KPI
          label="Total Outflows"
          value={formatCAD(allExpensesTotal)}
          subtitle={`${(expenseRatio * 100).toFixed(0)}% of after-tax income`}
        />
        <KPI
          label="After Expenses"
          value={formatCAD(yr.waterfall.afterExpenses)}
          subtitle={afterTax > 0 ? `${((yr.waterfall.afterExpenses / afterTax) * 100).toFixed(0)}% retained` : ''}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left Column: Category Breakdown */}
        <div className="space-y-4">
          <Section title={`Living Expenses — ${yr.year}`}>
            {EXPENSE_CATEGORIES.map(c => {
              const val = (eyd[c.key] as number) ?? 0;
              return (
                <div key={c.key} className="flex items-center justify-between py-1.5 border-b border-app-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                    <span className="text-xs text-app-text3">{c.label}</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-app-text">
                    {val > 0 ? formatCAD(val) : '—'}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-app-border">
              <span className="text-xs font-semibold text-app-text2">Total</span>
              <span className="text-xs font-bold tabular-nums text-app-text">{formatCAD(livingTotal)}</span>
            </div>
          </Section>

          <Section title="Tax-Deductible Expenses">
            {DEDUCTIBLE_CATEGORIES.map(c => {
              const val = (eyd[c.key] as number) ?? 0;
              return val > 0 ? (
                <Row key={c.key} label={c.label} value={formatCAD(val)} hint={c.hint} />
              ) : null;
            })}
            {deductibleTotal === 0 && (
              <div className="text-[11px] text-app-text4 py-2">No tax-deductible expenses for this year.</div>
            )}
            {deductibleTotal > 0 && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-app-border">
                <span className="text-xs font-semibold text-app-text2">Total</span>
                <span className="text-xs font-bold tabular-nums text-app-text">{formatCAD(deductibleTotal)}</span>
              </div>
            )}
          </Section>
        </div>

        {/* Center Column: Pie + Debt */}
        <div className="space-y-4">
          <Section title="Expense Breakdown">
            {pieData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      dataKey="value"
                      strokeWidth={1}
                      stroke="var(--app-surface)"
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatCAD(val)}
                      contentStyle={cc.tooltipStyle}
                    />
                    <Legend
                      wrapperStyle={cc.legendStyle10}
                      formatter={(val: string) => <span className="text-[10px]">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-[11px] text-app-text4 py-8 text-center">
                No expenses entered for {yr.year}. Use the Timeline or Scheduling page to add expenses.
              </div>
            )}
          </Section>

          {/* Debt Summary */}
          <Section title="Debt & Liabilities">
            {hasLiabilities && yr.liabilities ? (
              <>
                {yr.liabilities.map(l => (
                  <div key={l.id} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-app-text2">{l.label}</span>
                      <span className="text-[10px] text-app-text4">
                        {l.closingBalance > 0 ? formatCAD(l.closingBalance) + ' remaining' : 'Paid off'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="text-app-text4">Payment</span>
                        <div className="font-medium text-app-text tabular-nums">{formatCAD(l.totalPayment)}</div>
                      </div>
                      <div>
                        <span className="text-app-text4">Interest</span>
                        <div className="font-medium text-red-500 tabular-nums">{formatCAD(l.interestPaid)}</div>
                      </div>
                      <div>
                        <span className="text-app-text4">Principal</span>
                        <div className="font-medium text-green-600 tabular-nums">{formatCAD(l.principalPaid)}</div>
                      </div>
                    </div>
                    {/* Balance bar */}
                    {l.openingBalance > 0 && (
                      <div className="mt-1.5 h-1.5 bg-app-surface2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (l.closingBalance / l.openingBalance) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t-2 border-app-border space-y-1">
                  <Row label="Total Debt Outstanding" value={formatCAD(yr.totalDebt ?? 0)} />
                  <Row label="Annual Payments" value={formatCAD(yr.totalDebtPayment ?? 0)} />
                  <Row label="Interest Paid" value={formatCAD(yr.totalInterestPaid ?? 0)} cls="text-red-500" />
                  {(yr.deductibleInterest ?? 0) > 0 && (
                    <Row label="Deductible Interest" value={formatCAD(yr.deductibleInterest ?? 0)} cls="text-green-600" hint="Investment loans" />
                  )}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-app-text4 py-2">
                No liabilities configured. Add mortgages, loans, or lines of credit in Settings → Accounts & Balances.
              </div>
            )}
          </Section>
        </div>

        {/* Right Column: Charts */}
        <div className="space-y-4">
          <Section
            title="Expenses Over Time"
            right={<ChartRangeSelector value={chartRange} onChange={setChartRange} />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={areaData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
                <XAxis dataKey="year" tick={cc.axisTick} />
                <YAxis tick={cc.axisTick} tickFormatter={formatShort} />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    formatCAD(val),
                    EXPENSE_CATEGORIES.find(c => c.key === name)?.label ??
                    (name === 'deductible' ? 'Tax-Deductible' : name === 'debt' ? 'Debt Payments' : name),
                  ]}
                  contentStyle={cc.tooltipStyle}
                />
                {EXPENSE_CATEGORIES.map(c => (
                  <Area
                    key={c.key}
                    type="monotone"
                    dataKey={c.key}
                    stackId="1"
                    fill={c.color}
                    stroke={c.color}
                    fillOpacity={0.7}
                  />
                ))}
                <Area type="monotone" dataKey="deductible" stackId="1" fill="#ef4444" stroke="#ef4444" fillOpacity={0.7} />
                <Area type="monotone" dataKey="debt" stackId="1" fill="#78716c" stroke="#78716c" fillOpacity={0.7} />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* Expense vs Income Chart */}
          <Section title="Expenses vs After-Tax Income">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={sliceByRange(
                  effectiveYears.map((ey, i) => ({
                    year: ey.year,
                    afterTax: years[i]?.waterfall.afterTaxIncome ?? 0,
                    expenses: getExpenseTotal(ey) + getDeductibleTotal(ey) + (years[i]?.totalDebtPayment ?? 0),
                  })),
                  chartRange,
                )}
                margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
                <XAxis dataKey="year" tick={cc.axisTick} />
                <YAxis tick={cc.axisTick} tickFormatter={formatShort} />
                <Tooltip formatter={(v: number) => formatCAD(v)} contentStyle={cc.tooltipStyle} />
                <Legend wrapperStyle={cc.legendStyle10} />
                <Bar dataKey="afterTax" name="After-Tax Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Total Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Debt Paydown Chart */}
          {hasLiabilities && (
            <Section title="Debt Paydown">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart
                  data={sliceByRange(
                    years.map(y => ({
                      year: y.year,
                      debt: y.totalDebt ?? 0,
                    })),
                    chartRange,
                  )}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.gridStroke} />
                  <XAxis dataKey="year" tick={cc.axisTick} />
                  <YAxis tick={cc.axisTick} tickFormatter={formatShort} />
                  <Tooltip formatter={(v: number) => formatCAD(v)} contentStyle={cc.tooltipStyle} />
                  <Area type="monotone" dataKey="debt" name="Total Debt" fill="#ef4444" stroke="#ef4444" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      </div>

      {/* Multi-Year Expense Table */}
      <Section title="Expense Summary by Year">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-app-text3 border-b border-app-border">
                <th className="text-left py-1.5 pr-3 font-medium sticky left-0 bg-app-surface">Year</th>
                {EXPENSE_CATEGORIES.map(c => (
                  <th key={c.key} className="text-right py-1.5 px-2 font-medium">{c.label}</th>
                ))}
                <th className="text-right py-1.5 px-2 font-medium">Deductible</th>
                <th className="text-right py-1.5 px-2 font-medium">Debt</th>
                <th className="text-right py-1.5 px-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {effectiveYears.map((ey, i) => {
                const total = getExpenseTotal(ey) + getDeductibleTotal(ey) + (years[i]?.totalDebtPayment ?? 0);
                const isSelected = i === yearIdx;
                return (
                  <tr
                    key={ey.year}
                    className={`border-b border-app-border cursor-pointer hover:bg-app-surface2/50 ${isSelected ? 'bg-app-accent/5' : ''}`}
                    onClick={() => setYearIdx(i)}
                  >
                    <td className={`py-1 pr-3 font-medium sticky left-0 ${isSelected ? 'text-app-accent bg-app-accent/5' : 'text-app-text2 bg-app-surface'}`}>
                      {ey.year}
                    </td>
                    {EXPENSE_CATEGORIES.map(c => {
                      const v = (ey[c.key] as number) ?? 0;
                      return (
                        <td key={c.key} className="text-right py-1 px-2 tabular-nums text-app-text3">
                          {v > 0 ? formatShort(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="text-right py-1 px-2 tabular-nums text-app-text3">
                      {getDeductibleTotal(ey) > 0 ? formatShort(getDeductibleTotal(ey)) : '—'}
                    </td>
                    <td className="text-right py-1 px-2 tabular-nums text-app-text3">
                      {(years[i]?.totalDebtPayment ?? 0) > 0 ? formatShort(years[i]?.totalDebtPayment ?? 0) : '—'}
                    </td>
                    <td className="text-right py-1 px-2 tabular-nums font-medium text-app-text">
                      {total > 0 ? formatShort(total) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
