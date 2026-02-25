import React, { useState } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import type { ScheduledItem, ScheduledField, ScheduleCondition, ConditionField, ConditionOperator, AmountReference, AmountMaxReference } from '../types/scenario';

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

const CONDITION_FIELDS: { value: ConditionField; label: string; group: string }[] = [
  { value: 'grossIncome', label: 'Gross Income', group: 'Income' },
  { value: 'netTaxableIncome', label: 'Net Taxable Income', group: 'Income' },
  { value: 'afterTaxIncome', label: 'After-Tax Income', group: 'Income' },
  { value: 'employmentIncome', label: 'Employment Income', group: 'Income' },
  { value: 'selfEmploymentIncome', label: 'Self-Employment Income', group: 'Income' },
  { value: 'netCashFlow', label: 'Net Cash Flow', group: 'Cash Flow' },
  { value: 'totalIncomeTax', label: 'Total Income Tax', group: 'Tax' },
  { value: 'netWorth', label: 'Net Worth', group: 'Accounts' },
  { value: 'rrspEOY', label: 'RRSP Balance', group: 'Accounts' },
  { value: 'tfsaEOY', label: 'TFSA Balance', group: 'Accounts' },
  { value: 'fhsaEOY', label: 'FHSA Balance', group: 'Accounts' },
  { value: 'nonRegEOY', label: 'Non-Reg Balance', group: 'Accounts' },
  { value: 'savingsEOY', label: 'Savings Balance', group: 'Accounts' },
  { value: 'rrspUnusedRoom', label: 'RRSP Unused Room', group: 'Room' },
  { value: 'tfsaUnusedRoom', label: 'TFSA Unused Room', group: 'Room' },
  { value: 'age', label: 'Age', group: 'Other' },
];

const REFERENCE_FIELDS: { value: AmountReference; label: string; group: string }[] = [
  { value: 'grossIncome', label: 'Gross Income', group: 'Income' },
  { value: 'netTaxableIncome', label: 'Net Taxable Income', group: 'Income' },
  { value: 'afterTaxIncome', label: 'After-Tax Income', group: 'Income' },
  { value: 'employmentIncome', label: 'Employment Income', group: 'Income' },
  { value: 'selfEmploymentIncome', label: 'Self-Empl. Income', group: 'Income' },
  { value: 'netCashFlow', label: 'Net Cash Flow', group: 'Cash Flow' },
  { value: 'netWorth', label: 'Net Worth', group: 'Accounts' },
  { value: 'rrspEOY', label: 'RRSP Balance', group: 'Accounts' },
  { value: 'tfsaEOY', label: 'TFSA Balance', group: 'Accounts' },
  { value: 'fhsaEOY', label: 'FHSA Balance', group: 'Accounts' },
  { value: 'nonRegEOY', label: 'Non-Reg Balance', group: 'Accounts' },
  { value: 'savingsEOY', label: 'Savings Balance', group: 'Accounts' },
  { value: 'rrspUnusedRoom', label: 'RRSP Unused Room', group: 'Room' },
  { value: 'tfsaUnusedRoom', label: 'TFSA Unused Room', group: 'Room' },
];

const MAX_REF_OPTIONS: { value: AmountMaxReference; label: string; group: string }[] = [
  { value: 'rrspRoom', label: 'RRSP Room', group: 'Contribution Room' },
  { value: 'tfsaRoom', label: 'TFSA Room', group: 'Contribution Room' },
  { value: 'fhsaRoom', label: 'FHSA Room (Annual)', group: 'Contribution Room' },
  { value: 'fhsaLifetimeRoom', label: 'FHSA Lifetime Room', group: 'Contribution Room' },
  { value: 'rrspBalance', label: 'RRSP Balance', group: 'Account Balance' },
  { value: 'tfsaBalance', label: 'TFSA Balance', group: 'Account Balance' },
  { value: 'fhsaBalance', label: 'FHSA Balance', group: 'Account Balance' },
  { value: 'nonRegBalance', label: 'Non-Reg Balance', group: 'Account Balance' },
  { value: 'savingsBalance', label: 'Savings Balance', group: 'Account Balance' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '=' },
  { value: 'between', label: 'between' },
];

const cellBase = "border border-slate-200 text-[11px] px-1.5 py-1 bg-white text-slate-700 outline-none focus:border-blue-400 rounded";

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

  function duplicateItem(item: ScheduledItem) {
    const dup: ScheduledItem = {
      ...item,
      id: crypto.randomUUID(),
      label: item.label ? `${item.label} (copy)` : '',
      conditions: item.conditions ? item.conditions.map(c => ({ ...c })) : undefined,
    };
    setItems([...items, dup]);
    setExpandedId(dup.id);
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

  function renderGroupedSelect(
    options: { value: string; label: string; group: string }[],
    value: string,
    onChange: (v: string) => void,
    className: string,
  ) {
    const groups = [...new Set(options.map(o => o.group))];
    return (
      <select className={className} value={value} onChange={e => onChange(e.target.value)}>
        {groups.map(g => (
          <optgroup key={g} label={g}>
            {options.filter(o => o.group === g).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Scheduling Rules</div>
            <div className="text-xs text-slate-500">
              Auto-fill recurring amounts across years. Supports fixed dollar amounts or percentage of computed values.
              Per-year overrides in the Timeline take priority. Conditional & percentage rules evaluate against Pass 1 computed values.
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
                  <th className="text-left py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase w-32">Label</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase">Field</th>
                  <th className="text-center py-2.5 px-1 text-[10px] text-slate-500 font-semibold uppercase w-10">Type</th>
                  <th className="text-right py-2.5 px-3 text-[10px] text-slate-500 font-semibold uppercase w-20">Amount</th>
                  <th className="text-left py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-36">Reference</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">Start</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">End</th>
                  <th className="text-right py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-16">Growth</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">Grow By</th>
                  <th className="text-center py-2.5 px-2 text-[10px] text-slate-500 font-semibold uppercase w-20">Settings</th>
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const condCount = item.conditions?.length ?? 0;
                  const isExpanded = expandedId === item.id;
                  const isPct = item.amountType === 'percentage';
                  const hasCaps = (item.amountMin !== undefined && item.amountMin > 0) || (item.amountMax !== undefined && item.amountMax > 0) || !!item.amountMaxRef;
                  const settingsCount = condCount + (hasCaps ? 1 : 0);

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                        {/* Label */}
                        <td className="py-1.5 px-3">
                          <input
                            className={`${cellBase} text-left w-full`}
                            placeholder="e.g. Salary"
                            value={item.label}
                            onChange={e => updateItem(item.id, { label: e.target.value })}
                          />
                        </td>
                        {/* Field */}
                        <td className="py-1.5 px-3">
                          {renderGroupedSelect(
                            SCHEDULED_FIELD_OPTIONS,
                            item.field,
                            v => updateItem(item.id, { field: v as ScheduledField }),
                            `${cellBase} text-left w-full`,
                          )}
                        </td>
                        {/* Amount Type toggle */}
                        <td className="py-1.5 px-1 text-center">
                          <button
                            onClick={() => {
                              if (isPct) {
                                updateItem(item.id, { amountType: 'fixed', amountReference: undefined });
                              } else {
                                updateItem(item.id, { amountType: 'percentage', amountReference: item.amountReference ?? 'grossIncome', amount: 0 });
                              }
                            }}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                              isPct
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title={isPct ? 'Percentage of reference — click for fixed $' : 'Fixed dollar — click for percentage'}
                          >
                            {isPct ? '%' : '$'}
                          </button>
                        </td>
                        {/* Amount */}
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            className={`${cellBase} text-right w-full`}
                            placeholder={isPct ? '10' : '0'}
                            value={isPct ? (item.amount !== 0 ? (item.amount * 100).toFixed(1).replace(/\.0$/, '') : '') : (item.amount || '')}
                            onChange={e => {
                              const v = e.target.value;
                              if (isPct) {
                                updateItem(item.id, { amount: v === '' ? 0 : (parseFloat(v) / 100 || 0) });
                              } else {
                                updateItem(item.id, { amount: v === '' ? 0 : (parseFloat(v) || 0) });
                              }
                            }}
                          />
                        </td>
                        {/* Reference (only for percentage) */}
                        <td className="py-1.5 px-2">
                          {isPct ? (
                            renderGroupedSelect(
                              REFERENCE_FIELDS,
                              item.amountReference ?? 'grossIncome',
                              v => updateItem(item.id, { amountReference: v as AmountReference }),
                              `${cellBase} text-left w-full`,
                            )
                          ) : (
                            <span className="text-[10px] text-slate-300 px-1">—</span>
                          )}
                        </td>
                        {/* Start */}
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellBase} w-full text-center`}
                            value={item.startYear}
                            onChange={e => updateItem(item.id, { startYear: parseInt(e.target.value) || startYear })}
                          />
                        </td>
                        {/* End */}
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellBase} w-full text-center`}
                            placeholder="∞"
                            value={item.endYear ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              updateItem(item.id, { endYear: v === '' ? undefined : (parseInt(v) || endYear) });
                            }}
                          />
                        </td>
                        {/* Growth % */}
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            className={`${cellBase} text-right w-full`}
                            step="0.1"
                            placeholder="0"
                            value={item.growthRate !== undefined ? (item.growthRate * 100).toFixed(1).replace(/\.0$/, '') : ''}
                            onChange={e => {
                              const v = e.target.value;
                              updateItem(item.id, { growthRate: v === '' ? undefined : (parseFloat(v) / 100 || 0) });
                            }}
                          />
                        </td>
                        {/* Growth Type */}
                        <td className="py-1.5 px-2 text-center">
                          <select
                            className={`${cellBase} text-center w-full`}
                            value={item.growthType ?? 'fixed'}
                            onChange={e => updateItem(item.id, { growthType: e.target.value as 'fixed' | 'inflation' })}
                          >
                            <option value="fixed">Fixed %</option>
                            <option value="inflation">Inflation</option>
                          </select>
                        </td>
                        {/* Settings (conditions + caps) */}
                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              settingsCount > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                          >
                            {settingsCount > 0 ? `${settingsCount} set` : 'more'}
                          </button>
                        </td>
                        {/* Actions */}
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <button
                            onClick={() => duplicateItem(item)}
                            className="text-slate-300 hover:text-blue-500 transition-colors text-sm leading-none mr-1"
                            title="Duplicate"
                          >⧉</button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none"
                            title="Remove"
                          >×</button>
                        </td>
                      </tr>

                      {/* Expanded settings */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Left: Min/Max Caps */}
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  Amount Caps
                                </div>
                                <div className="flex items-center gap-3 mb-2">
                                  <label className="text-[10px] text-slate-500 w-8">Min</label>
                                  <input
                                    type="number"
                                    className={`${cellBase} text-right w-28`}
                                    placeholder="none"
                                    value={item.amountMin ?? ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      updateItem(item.id, { amountMin: v === '' ? undefined : (parseFloat(v) || 0) });
                                    }}
                                  />
                                  <span className="text-[9px] text-slate-400">Computed amount won't go below this</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <label className="text-[10px] text-slate-500 w-8">Max</label>
                                  <input
                                    type="number"
                                    className={`${cellBase} text-right w-28`}
                                    placeholder="none"
                                    value={item.amountMax ?? ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      updateItem(item.id, { amountMax: v === '' ? undefined : (parseFloat(v) || 0) });
                                    }}
                                  />
                                  <span className="text-[9px] text-slate-400">Computed amount won't exceed this</span>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <label className="text-[10px] text-slate-500 w-8">Limit</label>
                                  <select
                                    className={`${cellBase} text-left w-40`}
                                    value={item.amountMaxRef ?? ''}
                                    onChange={e => updateItem(item.id, { amountMaxRef: (e.target.value || undefined) as AmountMaxReference | undefined })}
                                  >
                                    <option value="">None (no dynamic cap)</option>
                                    {(() => {
                                      const groups = [...new Set(MAX_REF_OPTIONS.map(o => o.group))];
                                      return groups.map(g => (
                                        <optgroup key={g} label={g}>
                                          {MAX_REF_OPTIONS.filter(o => o.group === g).map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                          ))}
                                        </optgroup>
                                      ));
                                    })()}
                                  </select>
                                  <span className="text-[9px] text-slate-400">Cap amount to this computed limit each year</span>
                                </div>
                                {(isPct || item.amountMaxRef) && (
                                  <div className="mt-2 text-[9px] text-emerald-600 bg-emerald-50 rounded px-2 py-1 border border-emerald-100">
                                    {isPct && <>This rule computes: {(item.amount * 100).toFixed(1)}% of {REFERENCE_FIELDS.find(r => r.value === item.amountReference)?.label ?? item.amountReference}</>}
                                    {item.amountMax ? `, capped at $${item.amountMax.toLocaleString()}` : ''}
                                    {item.amountMin ? `, min $${item.amountMin.toLocaleString()}` : ''}
                                    {item.amountMaxRef ? `${isPct ? ', ' : 'Capped to '}${MAX_REF_OPTIONS.find(r => r.value === item.amountMaxRef)?.label ?? item.amountMaxRef}` : ''}
                                  </div>
                                )}
                              </div>

                              {/* Right: Conditions */}
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  Conditions <span className="font-normal text-slate-400">(all must pass)</span>
                                </div>
                                {(item.conditions ?? []).map((cond, ci) => (
                                  <div key={ci} className="flex items-center gap-2 mb-1.5">
                                    {renderGroupedSelect(
                                      CONDITION_FIELDS,
                                      cond.field,
                                      v => updateCondition(item.id, ci, { field: v as ConditionField }),
                                      `${cellBase} text-left w-36`,
                                    )}
                                    <select
                                      className={`${cellBase} text-center w-20`}
                                      value={cond.operator}
                                      onChange={e => updateCondition(item.id, ci, { operator: e.target.value as ConditionOperator })}
                                    >
                                      {OPERATORS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      className={`${cellBase} text-right w-28`}
                                      value={cond.value}
                                      onChange={e => updateCondition(item.id, ci, { value: parseFloat(e.target.value) || 0 })}
                                    />
                                    {cond.operator === 'between' && (
                                      <>
                                        <span className="text-[10px] text-slate-400">and</span>
                                        <input
                                          type="number"
                                          className={`${cellBase} text-right w-28`}
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
                              </div>
                            </div>
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
