import React, { useState, useMemo } from 'react';
import { useScenario } from '../store/ScenarioContext';
import type { ValidationWarning } from '../types/computed';

interface Props {
  onNavigate?: (page: string) => void;
}

type Filter = 'all' | 'error' | 'warning';

interface WarningRow {
  year: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  dedupeKey: string;
}

const FIELD_LABELS: Record<string, string> = {
  employmentIncome: 'Employment Income',
  selfEmploymentIncome: 'Self-Employment Income',
  otherIncome: 'Other Income',
  capitalGains: 'Capital Gains',
  eligibleDividends: 'Eligible Dividends',
  nonEligibleDividends: 'Non-Eligible Dividends',
  rentalIncome: 'Rental Income',
  foreignIncome: 'Foreign Income',
  pensionIncome: 'Pension Income',
  rrspContribution: 'RRSP Contribution',
  rrspWithdrawal: 'RRSP Withdrawal',
  tfsaContribution: 'TFSA Contribution',
  tfsaWithdrawal: 'TFSA Withdrawal',
  fhsaContribution: 'FHSA Contribution',
  fhsaWithdrawal: 'FHSA Withdrawal',
  nonRegContribution: 'Non-Reg Contribution',
  nonRegWithdrawal: 'Non-Reg Withdrawal',
  savingsContribution: 'Savings Contribution',
  savingsWithdrawal: 'Savings Withdrawal',
  liraContribution: 'LIRA Contribution',
  liraWithdrawal: 'LIRA Withdrawal',
  respContribution: 'RESP Contribution',
  respWithdrawal: 'RESP Withdrawal',
  liPremium: 'Life Insurance Premium',
  liWithdrawal: 'Life Insurance Withdrawal',
  charitableDonations: 'Charitable Donations',
  medicalExpenses: 'Medical Expenses',
  childcareExpenses: 'Childcare Expenses',
  movingExpenses: 'Moving Expenses',
  unionDues: 'Union Dues',
  otherDeductions: 'Other Deductions',
  foreignTaxPaid: 'Foreign Tax Paid',
  studentLoanInterest: 'Student Loan Interest',
};

function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

export function WarningsPage({ onNavigate }: Props) {
  const { activeComputed } = useScenario();
  const [filter, setFilter] = useState<Filter>('all');

  const rows: WarningRow[] = useMemo(() => {
    if (!activeComputed) return [];
    const seen = new Set<string>();
    const result: WarningRow[] = [];
    for (const yr of activeComputed.years) {
      for (const w of yr.warnings) {
        const dedupeKey = `${w.field}:${w.message}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        result.push({
          year: yr.year,
          field: w.field,
          message: w.message,
          severity: w.severity,
          dedupeKey,
        });
      }
    }
    // Sort: errors first, then by year
    result.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return a.year - b.year;
    });
    return result;
  }, [activeComputed]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.severity === filter);
  }, [rows, filter]);

  const errorCount = rows.filter(r => r.severity === 'error').length;
  const warnCount = rows.filter(r => r.severity === 'warning').length;
  const yearCount = new Set(rows.map(r => r.year)).size;

  if (!activeComputed) {
    return <div className="p-8 text-app-text4 text-sm">No scenario data.</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-app-bg">
      <div className="max-w-5xl mx-auto px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-app-text">Validation Issues</h2>
            {rows.length > 0 ? (
              <p className="text-xs text-app-text3 mt-0.5">
                {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
                {errorCount > 0 && warnCount > 0 && ', '}
                {warnCount > 0 && <span className="text-amber-600 font-medium">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>}
                {' '}across {yearCount} year{yearCount !== 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-xs text-app-text3 mt-0.5">All clear</p>
            )}
          </div>
          {/* Filter pills */}
          {rows.length > 0 && (
            <div className="bg-app-surface2 rounded-md p-0.5 flex gap-0.5">
              {([
                { value: 'all' as Filter, label: `All (${rows.length})` },
                { value: 'error' as Filter, label: `Errors (${errorCount})` },
                { value: 'warning' as Filter, label: `Warnings (${warnCount})` },
              ]).map(o => (
                <button
                  key={o.value}
                  onClick={() => setFilter(o.value)}
                  className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-all ${
                    filter === o.value
                      ? 'bg-app-surface text-app-text'
                      : 'text-app-text3 hover:text-app-text2'
                  }`}
                  style={filter === o.value ? { boxShadow: 'var(--app-shadow-sm)' } : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="bg-app-surface rounded-lg border border-app-border p-12 text-center">
            <div className="text-3xl mb-2 text-emerald-500">&#10003;</div>
            <div className="text-sm font-medium text-app-text">No validation issues found</div>
            <div className="text-xs text-app-text3 mt-1">Your scenario passes all validation checks.</div>
          </div>
        )}

        {/* Warnings table */}
        {filtered.length > 0 && (
          <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  <th className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 uppercase tracking-wide w-8"></th>
                  <th className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 uppercase tracking-wide w-16">Year</th>
                  <th className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 uppercase tracking-wide w-44">Field</th>
                  <th className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 uppercase tracking-wide">Message</th>
                  <th className="py-2 px-3 text-right text-[10px] font-semibold text-app-text3 uppercase tracking-wide w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.dedupeKey}
                    className={`border-b border-app-border hover:bg-app-accent-light/30 transition-colors ${i % 2 === 1 ? 'bg-app-surface2/50' : ''}`}
                  >
                    <td className="py-1.5 px-3">
                      {row.severity === 'error' ? (
                        <span className="text-red-500 text-sm" title="Error">&#9679;</span>
                      ) : (
                        <span className="text-amber-500 text-sm" title="Warning">&#9650;</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-app-text2 tabular-nums">{row.year}</td>
                    <td className="py-1.5 px-3 text-app-text2">{fieldLabel(row.field)}</td>
                    <td className="py-1.5 px-3 text-app-text3">{row.message}</td>
                    <td className="py-1.5 px-3 text-right">
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('timeline')}
                          className="text-[10px] text-app-accent hover:text-app-accent/80 underline underline-offset-2 transition-colors"
                        >
                          Go to Timeline
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
