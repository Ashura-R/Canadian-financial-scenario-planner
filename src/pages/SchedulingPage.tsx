import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import type { ScheduledItem, ScheduledField, ScheduleCondition, ConditionField, ConditionOperator, AmountReference, AmountMaxReference } from '../types/scenario';
import type { ValidationWarning } from '../types/computed';

const SCHEDULED_FIELD_OPTIONS: { value: ScheduledField; label: string; group: string }[] = [
  { value: 'employmentIncome', label: 'Employment Income', group: 'Income' },
  { value: 'selfEmploymentIncome', label: 'Self-Employment Income', group: 'Income' },
  { value: 'eligibleDividends', label: 'Eligible Dividends', group: 'Income' },
  { value: 'nonEligibleDividends', label: 'Non-Eligible Dividends', group: 'Income' },
  { value: 'interestIncome', label: 'Interest Income', group: 'Income' },
  { value: 'capitalGainsRealized', label: 'Capital Gains Realized', group: 'Income' },
  { value: 'capitalLossesRealized', label: 'Capital Losses Realized', group: 'Income' },
  { value: 'otherTaxableIncome', label: 'Other Taxable Income', group: 'Income' },
  { value: 'rentalGrossIncome', label: 'Rental Gross Income', group: 'Income' },
  { value: 'rentalExpenses', label: 'Rental Expenses', group: 'Income' },
  { value: 'pensionIncome', label: 'Pension Income', group: 'Income' },
  { value: 'foreignIncome', label: 'Foreign Income', group: 'Income' },
  { value: 'foreignTaxPaid', label: 'Foreign Tax Paid', group: 'Income' },
  { value: 'charitableDonations', label: 'Charitable Donations', group: 'Income' },
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
  { value: 'lifWithdrawal', label: 'LIF Withdrawal', group: 'Withdrawals' },
  { value: 'respContribution', label: 'RESP Contribution', group: 'Contributions' },
  { value: 'respWithdrawal', label: 'RESP Withdrawal', group: 'Withdrawals' },
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
  { value: 'liraEquityPct', label: 'LIRA Equity %', group: 'Asset Allocation' },
  { value: 'liraFixedPct', label: 'LIRA Fixed %', group: 'Asset Allocation' },
  { value: 'liraCashPct', label: 'LIRA Cash %', group: 'Asset Allocation' },
  { value: 'respEquityPct', label: 'RESP Equity %', group: 'Asset Allocation' },
  { value: 'respFixedPct', label: 'RESP Fixed %', group: 'Asset Allocation' },
  { value: 'respCashPct', label: 'RESP Cash %', group: 'Asset Allocation' },
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
  { value: 'capitalGainsRealized', label: 'Capital Gains Realized', group: 'Capital' },
  { value: 'capitalLossCF', label: 'Capital Loss C/F', group: 'Capital' },
  { value: 'liraEOY', label: 'LIRA/LIF Balance', group: 'Accounts' },
  { value: 'respEOY', label: 'RESP Balance', group: 'Accounts' },
  { value: 'rentalGrossIncome', label: 'Rental Gross Income', group: 'Income' },
  { value: 'pensionIncome', label: 'Pension Income', group: 'Income' },
  { value: 'foreignIncome', label: 'Foreign Income', group: 'Income' },
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
  { value: 'capitalGainsRealized', label: 'Capital Gains Realized', group: 'Capital' },
  { value: 'capitalLossCF', label: 'Capital Loss C/F', group: 'Capital' },
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
  { value: 'liraBalance', label: 'LIRA/LIF Balance', group: 'Account Balance' },
  { value: 'respBalance', label: 'RESP Balance', group: 'Account Balance' },
  { value: 'capitalLossCF', label: 'Capital Loss C/F', group: 'Carry-Forward' },
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

/** Map a scheduled field to the validation warning field names it could trigger */
function getWarningFieldsForScheduledField(field: ScheduledField): string[] {
  // Extra mappings beyond the direct field name match
  const extras: Record<string, string[]> = {
    savingsDeposit: ['savingsWithdrawal'],     // deposit affects balance → withdrawal validation
    nonRegContribution: ['nonRegWithdrawal'],  // contribution affects balance
  };
  // Always include the field itself as a direct match, plus any extras
  return [field, ...(extras[field] ?? [])];
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function SchedulingPage() {
  const { activeScenario, activeComputed } = useScenario();
  const update = useUpdateScenario();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Draft mode: work on a local copy, save explicitly
  const [draft, setDraft] = useState<ScheduledItem[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const savedRef = useRef<ScheduledItem[] | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  if (!activeScenario) return null;

  const saved = activeScenario.scheduledItems ?? [];
  const items = draft ?? saved;
  const isDirty = draft !== null;
  const ass = activeScenario.assumptions;
  const startYear = ass.startYear;
  const endYear = ass.startYear + ass.numYears - 1;

  // Collect all validation warnings from computed years, grouped by field
  const warningsByField = useMemo(() => {
    if (!activeComputed) return new Map<string, ValidationWarning[]>();
    const map = new Map<string, ValidationWarning[]>();
    for (const yr of activeComputed.years) {
      for (const w of yr.warnings) {
        if (w.severity === 'error' || w.severity === 'warning') {
          const existing = map.get(w.field) ?? [];
          // Avoid exact duplicate messages
          if (!existing.some(e => e.message === w.message)) {
            existing.push(w);
          }
          map.set(w.field, existing);
        }
      }
    }
    return map;
  }, [activeComputed]);

  // Get warnings relevant to a specific scheduled item
  function getWarningsForItem(item: ScheduledItem): ValidationWarning[] {
    const fields = getWarningFieldsForScheduledField(item.field);
    const warnings: ValidationWarning[] = [];
    for (const f of fields) {
      const w = warningsByField.get(f);
      if (w) warnings.push(...w);
    }
    return warnings;
  }

  // All unique warnings across all years (for the summary banner)
  const allWarnings = useMemo(() => {
    if (!activeComputed) return [];
    const seen = new Set<string>();
    const result: (ValidationWarning & { year: number })[] = [];
    for (const yr of activeComputed.years) {
      for (const w of yr.warnings) {
        const key = `${w.field}:${w.message}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ ...w, year: yr.year });
        }
      }
    }
    return result;
  }, [activeComputed]);

  const errorCount = allWarnings.filter(w => w.severity === 'error').length;
  const warnCount = allWarnings.filter(w => w.severity === 'warning').length;

  // Reverse map: warning field → item IDs that could trigger it
  const warningFieldToItems = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      const fields = getWarningFieldsForScheduledField(item.field);
      for (const f of fields) {
        const existing = map.get(f) ?? [];
        existing.push(item.id);
        map.set(f, existing);
      }
    }
    return map;
  }, [items]);

  function scrollToRule(itemId: string) {
    const el = rowRefs.current.get(itemId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(itemId);
      setTimeout(() => setFlashId(null), 2000);
    }
  }

  function startEditing() {
    setDraft(deepClone(saved));
    savedRef.current = saved;
  }

  function saveDraft() {
    if (draft) {
      update(s => ({ ...s, scheduledItems: draft }));
      setDraft(null);
    }
  }

  function discardDraft() {
    setDraft(null);
    setPendingDelete(null);
  }

  function setItems(newItems: ScheduledItem[]) {
    if (draft) {
      setDraft(newItems);
    } else {
      // Auto-enter draft mode on first edit
      setDraft(newItems);
    }
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

  function requestRemoveItem(id: string) {
    setPendingDelete(id);
  }

  function confirmRemoveItem() {
    if (pendingDelete) {
      setItems(items.filter(i => i.id !== pendingDelete));
      if (expandedId === pendingDelete) setExpandedId(null);
      setPendingDelete(null);
    }
  }

  function cancelRemoveItem() {
    setPendingDelete(null);
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Scheduling Rules</div>
            <div className="text-xs text-slate-500">
              Auto-fill recurring amounts across years. Supports fixed dollar amounts or percentage of computed values.
              Per-year overrides in the Timeline take priority. Conditional & percentage rules evaluate against Pass 1 computed values.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <>
                <button
                  onClick={discardDraft}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-500 rounded hover:bg-slate-100 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={saveDraft}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                >
                  Save Changes
                </button>
              </>
            )}
            <button
              onClick={addItem}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              + Add Rule
            </button>
          </div>
        </div>

        {/* Quick Templates */}
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick Templates</div>
          <div className="flex flex-wrap gap-2">
            {([
              {
                label: 'Auto-apply losses against gains',
                desc: 'Apply capital loss C/F to offset realized gains each year',
                item: {
                  label: 'Auto-apply losses',
                  field: 'capitalLossApplied' as ScheduledField,
                  amountType: 'percentage' as const,
                  amount: 1.0,
                  amountReference: 'capitalGainsRealized' as AmountReference,
                  amountMaxRef: 'capitalLossCF' as AmountMaxReference,
                  conditions: [{ field: 'capitalGainsRealized' as ConditionField, operator: '>' as ConditionOperator, value: 0 }],
                },
              },
              {
                label: 'Realize losses to offset gains',
                desc: 'Trigger capital loss realization when gains exist',
                item: {
                  label: 'Realize losses for gains',
                  field: 'capitalLossesRealized' as ScheduledField,
                  amountType: 'percentage' as const,
                  amount: 1.0,
                  amountReference: 'capitalGainsRealized' as AmountReference,
                  conditions: [{ field: 'capitalGainsRealized' as ConditionField, operator: '>' as ConditionOperator, value: 0 }],
                },
              },
              {
                label: 'Tax-loss harvest (low income)',
                desc: 'Realize losses when net taxable income is below a threshold',
                item: {
                  label: 'Tax-loss harvest',
                  field: 'capitalLossesRealized' as ScheduledField,
                  amountType: 'fixed' as const,
                  amount: 5000,
                  conditions: [{ field: 'netTaxableIncome' as ConditionField, operator: '<' as ConditionOperator, value: 50000 }],
                },
              },
            ] as const).map((tpl, i) => (
              <button
                key={i}
                onClick={() => {
                  const newItem: ScheduledItem = {
                    id: crypto.randomUUID(),
                    label: tpl.item.label,
                    field: tpl.item.field,
                    startYear,
                    endYear: undefined,
                    amount: tpl.item.amount,
                    amountType: tpl.item.amountType,
                    amountReference: (tpl.item as any).amountReference,
                    amountMaxRef: (tpl.item as any).amountMaxRef,
                    conditions: tpl.item.conditions ? tpl.item.conditions.map(c => ({ ...c })) : undefined,
                  };
                  setItems([...items, newItem]);
                  setExpandedId(newItem.id);
                }}
                className="px-3 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-600 hover:text-blue-700"
                title={tpl.desc}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dirty indicator */}
        {isDirty && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-700">
              You have unsaved changes. Click <strong>Save Changes</strong> to apply or <strong>Discard</strong> to revert.
            </span>
          </div>
        )}

        {/* Validation summary */}
        {(errorCount > 0 || warnCount > 0) && (
          <div className={`mb-4 border rounded-lg overflow-hidden ${errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="px-4 py-2 flex items-center justify-between">
              <div className={`text-xs font-semibold ${errorCount > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                {errorCount > 0 && <>{errorCount} error{errorCount !== 1 ? 's' : ''}</>}
                {errorCount > 0 && warnCount > 0 && ', '}
                {warnCount > 0 && <>{warnCount} warning{warnCount !== 1 ? 's' : ''}</>}
                {' '}across all years
              </div>
            </div>
            <div className="px-4 pb-3 space-y-0.5 max-h-40 overflow-y-auto">
              {allWarnings.map((w, i) => {
                const matchedItemIds = warningFieldToItems.get(w.field) ?? [];
                const matchedIdx = matchedItemIds.length > 0 ? items.findIndex(it => it.id === matchedItemIds[0]) : -1;
                const ruleLabel = matchedIdx >= 0
                  ? `Rule #${matchedIdx + 1}${items[matchedIdx].label ? ` (${items[matchedIdx].label})` : ''}`
                  : null;
                return (
                  <div key={i} className={`text-[11px] flex items-start gap-1.5 ${w.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                    <span className="shrink-0">{w.severity === 'error' ? '!' : '?'}</span>
                    <span>
                      <strong>{w.year}:</strong>{' '}
                      {ruleLabel && (
                        <button
                          className="underline decoration-dotted hover:decoration-solid font-semibold mr-1"
                          onClick={() => scrollToRule(matchedItemIds[0])}
                        >
                          {ruleLabel}
                        </button>
                      )}
                      {w.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {pendingDelete && (
          <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-xs text-red-700">
              Delete Rule #{(items.findIndex(i => i.id === pendingDelete) + 1)} "<strong>{items.find(i => i.id === pendingDelete)?.label || 'Untitled'}</strong>"? This cannot be undone after saving.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={cancelRemoveItem} className="px-2.5 py-1 text-[11px] rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={confirmRemoveItem} className="px-2.5 py-1 text-[11px] rounded bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            No scheduling rules yet. Click "+ Add Rule" to create one.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center py-2.5 px-1.5 text-[10px] text-slate-500 font-semibold uppercase w-8">#</th>
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
                {items.map((item, itemIndex) => {
                  const condCount = item.conditions?.length ?? 0;
                  const isExpanded = expandedId === item.id;
                  const isPct = item.amountType === 'percentage';
                  const hasCaps = (item.amountMin !== undefined && item.amountMin > 0) || (item.amountMax !== undefined && item.amountMax > 0) || !!item.amountMaxRef;
                  const settingsCount = condCount + (hasCaps ? 1 : 0);
                  const itemWarnings = getWarningsForItem(item);
                  const hasErrors = itemWarnings.some(w => w.severity === 'error');
                  const hasWarnings = itemWarnings.length > 0;
                  const isBeingDeleted = pendingDelete === item.id;
                  const isFlashing = flashId === item.id;
                  const ruleNum = itemIndex + 1;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        ref={el => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
                        className={`border-b transition-all duration-300 ${
                          isBeingDeleted ? 'bg-red-50/50 opacity-50 border-slate-100' :
                          isFlashing ? 'bg-red-100 border-red-300 ring-2 ring-red-400 ring-inset' :
                          hasErrors ? 'bg-red-50 border-l-2 border-l-red-400 border-b-red-100' :
                          hasWarnings ? 'bg-amber-50/60 border-l-2 border-l-amber-400 border-b-amber-100' :
                          'border-slate-100 hover:bg-blue-50/30'
                        }`}>
                        {/* Rule # */}
                        <td className="py-1.5 px-1.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                            hasErrors ? 'bg-red-100 text-red-600 border border-red-200' :
                            hasWarnings ? 'bg-amber-100 text-amber-600 border border-amber-200' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {ruleNum}
                          </span>
                        </td>
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
                            onClick={() => requestRemoveItem(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none"
                            title="Remove"
                          >×</button>
                        </td>
                      </tr>

                      {/* Inline warnings for this rule */}
                      {itemWarnings.length > 0 && !isExpanded && (
                        <tr>
                          <td colSpan={12} className={`px-6 py-1.5 border-b ${hasErrors ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
                            <div className="flex items-start gap-1.5">
                              <span className={`text-[10px] shrink-0 mt-px font-bold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
                                Rule #{ruleNum}:
                              </span>
                              <div className="text-[10px] space-y-0.5">
                                {itemWarnings.map((w, wi) => (
                                  <div key={wi} className={w.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>
                                    {w.severity === 'error' ? '!' : '?'} {w.message}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded settings */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                            {/* Show warnings in expanded view too */}
                            {itemWarnings.length > 0 && (
                              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded">
                                <div className="text-[10px] font-semibold text-red-600 mb-1">
                                  Rule #{ruleNum} — {itemWarnings.length} issue{itemWarnings.length !== 1 ? 's' : ''}:
                                </div>
                                <div className="space-y-0.5">
                                  {itemWarnings.map((w, wi) => (
                                    <div key={wi} className={`text-[10px] ${w.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                                      {w.severity === 'error' ? '!' : '?'} {w.message}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
