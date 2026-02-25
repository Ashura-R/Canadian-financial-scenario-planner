import React, { useState } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import type { ScheduledItem, ScheduledField, ScheduleCondition, ConditionField, ConditionOperator } from '../types/scenario';

const SCHEDULED_FIELD_OPTIONS: { value: ScheduledField; label: string; group: string }[] = [
  { value: 'employmentIncome', label: 'Employment Income', group: 'Income' },
  { value: 'selfEmploymentIncome', label: 'Self-Employment Income', group: 'Income' },
  { value: 'eligibleDividends', label: 'Eligible Dividends', group: 'Income' },
  { value: 'nonEligibleDividends', label: 'Non-Eligible Dividends', group: 'Income' },
  { value: 'interestIncome', label: 'Interest Income', group: 'Income' },
  { value: 'capitalGainsRealized', label: 'Capital Gains Realized', group: 'Income' },
  { value: 'capitalLossesRealized', label: 'Capital Losses Realized', group: 'Income' },
  { value: 'otherTaxableIncome', label: 'Other Taxable Income', group: 'Income' },
  { value: 'rrspContribution', label: 'RRSP Contribution', group: 'Contributions' },
  { value: 'rrspDeductionClaimed', label: 'RRSP Deduction Claimed', group: 'Contributions' },
  { value: 'tfsaContribution', label: 'TFSA Contribution', group: 'Contributions' },
  { value: 'fhsaContribution', label: 'FHSA Contribution', group: 'Contributions' },
  { value: 'fhsaDeductionClaimed', label: 'FHSA Deduction Claimed', group: 'Contributions' },
  { value: 'nonRegContribution', label: 'Non-Reg Contribution', group: 'Contributions' },
  { value: 'rrspWithdrawal', label: 'RRSP Withdrawal', group: 'Withdrawals' },
  { value: 'tfsaWithdrawal', label: 'TFSA Withdrawal', group: 'Withdrawals' },
  { value: 'fhsaWithdrawal', label: 'FHSA Withdrawal', group: 'Withdrawals' },
  { value: 'nonRegWithdrawal', label: 'Non-Reg Withdrawal', group: 'Withdrawals' },
  { value: 'savingsDeposit', label: 'Savings Deposit', group: 'Savings' },
  { value: 'savingsWithdrawal', label: 'Savings Withdrawal', group: 'Savings' },
  { value: 'capitalLossApplied', label: 'Capital Loss Applied', group: 'Other' },
  { value: 'rrspEquityPct', label: 'RRSP Equity %', group: 'Asset Allocation' },
  { value: 'rrspFixedPct', label: 'RRSP Fixed %', group: 'Asset Allocation' },
  { value: 'rrspCashPct', label: 'RRSP Cash %', group: 'Asset Allocation' },
  { value: 'tfsaEquityPct', label: 'TFSA Equity %', group: 'Asset Allocation' },
  { value: 'tfsaFixedPct', label: 'TFSA Fixed %', group: 'Asset Allocation' },
  { value: 'tfsaCashPct', label: 'TFSA Cash %', group: 'Asset Allocation' },
  { value: 'fhsaEquityPct', label: 'FHSA Equity %', group: 'Asset Allocation' },
  { value: 'fhsaFixedPct', label: 'FHSA Fixed %', group: 'Asset Allocation' },
  { value: 'fhsaCashPct', label: 'FHSA Cash %', group: 'Asset Allocation' },
  { value: 'nonRegEquityPct', label: 'Non-Reg Equity %', group: 'Asset Allocation' },
  { value: 'nonRegFixedPct', label: 'Non-Reg Fixed %', group: 'Asset Allocation' },
  { value: 'nonRegCashPct', label: 'Non-Reg Cash %', group: 'Asset Allocation' },
];

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'grossIncome', label: 'Gross Income' },
  { value: 'netTaxableIncome', label: 'Net Taxable Income' },
  { value: 'afterTaxIncome', label: 'After-Tax Income' },
  { value: 'netCashFlow', label: 'Net Cash Flow' },
  { value: 'netWorth', label: 'Net Worth' },
  { value: 'totalIncomeTax', label: 'Total Income Tax' },
  { value: 'employmentIncome', label: 'Employment Income' },
  { value: 'selfEmploymentIncome', label: 'Self-Employment Income' },
  { value: 'rrspEOY', label: 'RRSP EOY Balance' },
  { value: 'tfsaEOY', label: 'TFSA EOY Balance' },
  { value: 'age', label: 'Age' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '=' },
  { value: 'between', label: 'between' },
];

const cellCls = "border border-slate-200 text-[11px] text-right px-1.5 py-1 bg-white text-slate-700 outline-none focus:border-blue-400 rounded";

export function SchedulingPage() {
  const { activeScenario } = useScenario();
  const update = useUpdateScenario();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeScenario) return null;

  const items = activeScenario.scheduledItems ?? [];
  const ass = activeScenario.assumptions;
  const startYear = ass.startYear;
  const endYear = ass.startYear + ass.numYears - 1;

  function setItems(newItems: ScheduledItem[]) {
    update(s => ({ ...s, scheduledItems: newItems }));
  }

  function addItem() {
    const newItem: ScheduledItem = {
      id: crypto.randomUUID(),
      label: '',
      field: 'employmentIncome',
      startYear,
      endYear: undefined,
      amount: 0,
    };
    setItems([...items, newItem]);
    setExpandedId(newItem.id);
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function updateItem(id: string, patch: Partial<ScheduledItem>) {
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  function addCondition(itemId: string) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const cond: ScheduleCondition = { field: 'grossIncome', operator: '>', value: 0 };
    updateItem(itemId, { conditions: [...(item.conditions ?? []), cond] });
  }

  function updateCondition(itemId: string, condIdx: number, patch: Partial<ScheduleCondition>) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const conds = [...(item.conditions ?? [])];
    conds[condIdx] = { ...conds[condIdx], ...patch };
    updateItem(itemId, { conditions: conds });
  }

  function removeCondition(itemId: string, condIdx: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const conds = (item.conditions ?? []).filter((_, i) => i !== condIdx);
    updateItem(itemId, { conditions: conds.length > 0 ? conds : undefined });
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Scheduling Rules</div>
            <div className="text-xs text-slate-500">
              Auto-fill recurring amounts across years. Per-year overrides in the Timeline take priority.
              Conditional rules evaluate against Pass 1 computed values.
            </div>
          </div>
          <button
            onClick={addItem}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + Add Rule
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            No scheduling rules yet. Click "+ Add Rule" to create one.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase w-36">Label</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase">Field</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">Start</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">End</th>
                  <th className="text-right py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase w-24">Amount</th>
                  <th className="text-right py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-16">Growth %</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">Growth Type</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-24">Conditions</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const condCount = item.conditions?.length ?? 0;
                  const isExpanded = expandedId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                        <td className="py-1.5 px-3">
                          <input
                            className={`${cellCls} text-left w-full`}
                            placeholder="e.g. Salary"
                            value={item.label}
                            onChange={e => updateItem(item.id, { label: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            className={`${cellCls} text-left w-full`}
                            value={item.field}
                            onChange={e => updateItem(item.id, { field: e.target.value as ScheduledField })}
                          >
                            {SCHEDULED_FIELD_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellCls} w-full text-center`}
                            value={item.startYear}
                            onChange={e => updateItem(item.id, { startYear: parseInt(e.target.value) || startYear })}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellCls} w-full text-center`}
                            placeholder="∞"
                            value={item.endYear ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              updateItem(item.id, { endYear: v === '' ? undefined : (parseInt(v) || endYear) });
                            }}
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            className={`${cellCls} w-full`}
                            value={item.amount}
                            onChange={e => updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellCls} w-full`}
                            step="0.1"
                            placeholder="0"
                            value={item.growthRate !== undefined ? (item.growthRate * 100).toFixed(1) : ''}
                            onChange={e => {
                              const v = e.target.value;
                              updateItem(item.id, { growthRate: v === '' ? undefined : (parseFloat(v) / 100 || 0) });
                            }}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <select
                            className={`${cellCls} text-center w-full`}
                            value={item.growthType ?? 'fixed'}
                            onChange={e => updateItem(item.id, { growthType: e.target.value as 'fixed' | 'inflation' })}
                          >
                            <option value="fixed">Fixed %</option>
                            <option value="inflation">Inflation</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              condCount > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                          >
                            {condCount > 0 ? `${condCount} cond${condCount > 1 ? 's' : ''}` : 'none'}
                          </button>
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none"
                            title="Remove"
                          >×</button>
                        </td>
                      </tr>

                      {/* Expanded conditions */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                              Conditions (all must pass for this rule to apply)
                            </div>
                            {(item.conditions ?? []).map((cond, ci) => (
                              <div key={ci} className="flex items-center gap-2 mb-1.5">
                                <select
                                  className={`${cellCls} text-left w-40`}
                                  value={cond.field}
                                  onChange={e => updateCondition(item.id, ci, { field: e.target.value as ConditionField })}
                                >
                                  {CONDITION_FIELDS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                  ))}
                                </select>
                                <select
                                  className={`${cellCls} text-center w-20`}
                                  value={cond.operator}
                                  onChange={e => updateCondition(item.id, ci, { operator: e.target.value as ConditionOperator })}
                                >
                                  {OPERATORS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  className={`${cellCls} w-28`}
                                  value={cond.value}
                                  onChange={e => updateCondition(item.id, ci, { value: parseFloat(e.target.value) || 0 })}
                                />
                                {cond.operator === 'between' && (
                                  <>
                                    <span className="text-[10px] text-slate-400">and</span>
                                    <input
                                      type="number"
                                      className={`${cellCls} w-28`}
                                      value={cond.value2 ?? 0}
                                      onChange={e => updateCondition(item.id, ci, { value2: parseFloat(e.target.value) || 0 })}
                                    />
                                  </>
                                )}
                                <button
                                  onClick={() => removeCondition(item.id, ci)}
                                  className="text-slate-300 hover:text-red-500 transition-colors text-sm"
                                  title="Remove condition"
                                >×</button>
                              </div>
                            ))}
                            <button
                              onClick={() => addCondition(item.id)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 transition-colors mt-1"
                            >
                              + Add condition
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
