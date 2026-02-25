import React, { useRef } from 'react';
import { useScenario, useUpdateScenario } from '../../../store/ScenarioContext';
import { TimelineCell } from './TimelineCell';
import { RowGroup } from './RowGroup';
import type { YearData } from '../../../types/scenario';

type YDKey = keyof YearData;

interface RowDef {
  label: string;
  key: YDKey;
  readOnly?: boolean;
  pct?: boolean;
  computed?: (yearIndex: number) => number;
}

export function TimelineTable() {
  const { activeScenario, activeComputed } = useScenario();
  const update = useUpdateScenario();
  const tableRef = useRef<HTMLDivElement>(null);

  if (!activeScenario) return null;

  const years = activeScenario.years;
  const computed = activeComputed?.years ?? [];

  function updateYear(yearIdx: number, key: YDKey, val: number) {
    update(s => {
      const newYears = [...s.years];
      newYears[yearIdx] = { ...newYears[yearIdx], [key]: val };
      return { ...s, years: newYears };
    });
  }

  function updateYearOpt(yearIdx: number, key: YDKey, val: number | undefined) {
    update(s => {
      const newYears = [...s.years];
      const yr = { ...newYears[yearIdx] };
      if (val === undefined) {
        delete (yr as Record<string, unknown>)[key as string];
      } else {
        (yr as Record<string, unknown>)[key as string] = val;
      }
      newYears[yearIdx] = yr;
      return { ...s, years: newYears };
    });
  }

  function warningFields(yearIdx: number): Set<string> {
    const s = new Set<string>();
    computed[yearIdx]?.warnings.forEach(w => s.add(w.field));
    return s;
  }

  function renderRow(label: string, key: YDKey, opts: { readOnly?: boolean; pct?: boolean; computedFn?: (i: number) => number } = {}) {
    return (
      <tr key={key} className="border-b border-[#1e2d3d] hover:bg-[#111827]/50">
        <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[10px] text-[#9ca3af] whitespace-nowrap min-w-[130px] max-w-[130px]">
          {label}
        </td>
        {years.map((yd, i) => {
          const warns = warningFields(i);
          const displayVal = opts.computedFn ? opts.computedFn(i) : (yd[key] as number ?? 0);
          const isOpt = key.endsWith('Override');
          return (
            <td key={yd.year} className="py-0.5 px-0.5">
              {opts.readOnly || opts.computedFn ? (
                <div className="w-full text-right text-[10px] px-1 py-px text-[#6b7280]">
                  {opts.pct ? ((displayVal) * 100).toFixed(1) + '%' : displayVal >= 1000 ? '$' + (displayVal / 1000).toFixed(0) + 'K' : displayVal === 0 ? '—' : '$' + Math.round(displayVal).toLocaleString()}
                </div>
              ) : (
                <TimelineCell
                  value={displayVal}
                  onChange={v => updateYear(i, key, v)}
                  pct={opts.pct}
                  hasWarning={warns.has(key as string)}
                  hasOverride={isOpt && displayVal !== 0}
                  readOnly={opts.readOnly}
                />
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  const YEAR_WIDTH = 56;

  return (
    <div ref={tableRef} className="h-full overflow-auto">
      <table className="text-xs border-collapse" style={{ minWidth: 130 + years.length * YEAR_WIDTH }}>
        <thead className="sticky top-0 z-20">
          <tr className="bg-[#111827] border-b border-[#1e2d3d]">
            <th className="sticky left-0 bg-[#111827] z-30 py-2 pl-3 pr-2 text-left text-[10px] text-[#6b7280] font-medium min-w-[130px]">Row</th>
            {years.map(yd => (
              <th key={yd.year} className="py-2 px-0.5 text-center text-[10px] font-semibold text-[#f9fafb]" style={{ width: YEAR_WIDTH }}>
                {yd.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <RowGroup title="Income">
            {renderRow('Employment', 'employmentIncome')}
            {renderRow('Self-Employment', 'selfEmploymentIncome')}
            {renderRow('Eligible Dividends', 'eligibleDividends')}
            {renderRow('Non-Elig. Dividends', 'nonEligibleDividends')}
            {renderRow('Interest', 'interestIncome')}
            {renderRow('Capital Gains', 'capitalGainsRealized')}
            {renderRow('Capital Losses', 'capitalLossesRealized')}
            {renderRow('Other Taxable', 'otherTaxableIncome')}
            <tr className="bg-[#111827] border-b border-[#1e2d3d]">
              <td className="sticky left-0 bg-[#111827] z-10 py-0.5 pl-3 pr-2 text-[10px] text-[#f9fafb] font-semibold whitespace-nowrap">Total Gross Income</td>
              {years.map((_, i) => (
                <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-[#10b981]">
                  {computed[i] ? '$' + Math.round(computed[i].waterfall.grossIncome / 1000) + 'K' : '—'}
                </td>
              ))}
            </tr>
          </RowGroup>

          <RowGroup title="RRSP">
            {renderRow('Contribution', 'rrspContribution')}
            {renderRow('Deduction Claimed', 'rrspDeductionClaimed')}
            {renderRow('Withdrawal', 'rrspWithdrawal')}
          </RowGroup>

          <RowGroup title="TFSA">
            {renderRow('Contribution', 'tfsaContribution')}
            {renderRow('Withdrawal', 'tfsaWithdrawal')}
          </RowGroup>

          <RowGroup title="FHSA">
            {renderRow('Contribution', 'fhsaContribution')}
            {renderRow('Deduction Claimed', 'fhsaDeductionClaimed')}
            {renderRow('Withdrawal', 'fhsaWithdrawal')}
          </RowGroup>

          <RowGroup title="Non-Reg & Savings">
            {renderRow('Non-Reg Contribution', 'nonRegContribution')}
            {renderRow('Non-Reg Withdrawal', 'nonRegWithdrawal')}
            {renderRow('Savings Deposit', 'savingsDeposit')}
            {renderRow('Savings Withdrawal', 'savingsWithdrawal')}
          </RowGroup>

          <RowGroup title="Asset Allocation" defaultOpen={false}>
            <tr className="bg-[#1f2937]/30">
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[9px] text-[#6b7280] italic" colSpan={1}>RRSP Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'rrspEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'rrspFixedPct', { pct: true })}
            {renderRow('  Cash %', 'rrspCashPct', { pct: true })}
            <tr>
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[9px] text-[#6b7280]">  Return (calc)</td>
              {years.map((_, i) => (
                <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-[#6b7280]">
                  {computed[i] ? (computed[i].accounts.rrspReturn * 100).toFixed(1) + '%' : '—'}
                </td>
              ))}
            </tr>

            <tr className="bg-[#1f2937]/30">
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[9px] text-[#6b7280] italic">TFSA Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'tfsaEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'tfsaFixedPct', { pct: true })}
            {renderRow('  Cash %', 'tfsaCashPct', { pct: true })}

            <tr className="bg-[#1f2937]/30">
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[9px] text-[#6b7280] italic">FHSA Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'fhsaEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'fhsaFixedPct', { pct: true })}
            {renderRow('  Cash %', 'fhsaCashPct', { pct: true })}

            <tr className="bg-[#1f2937]/30">
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[9px] text-[#6b7280] italic">Non-Reg Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'nonRegEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'nonRegFixedPct', { pct: true })}
            {renderRow('  Cash %', 'nonRegCashPct', { pct: true })}
          </RowGroup>

          <RowGroup title="Capital Loss" defaultOpen={false}>
            {renderRow('Loss Applied', 'capitalLossApplied')}
            <tr className="border-b border-[#1e2d3d]">
              <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[10px] text-[#6b7280]">Loss C/F Balance</td>
              {years.map((_, i) => (
                <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-[#6b7280]">
                  {computed[i] ? '$' + Math.round(computed[i].capitalLossCF).toLocaleString() : '—'}
                </td>
              ))}
            </tr>
          </RowGroup>

          <RowGroup title="EOY Overrides" defaultOpen={false}>
            {(['rrspEOYOverride', 'tfsaEOYOverride', 'fhsaEOYOverride', 'nonRegEOYOverride', 'savingsEOYOverride'] as YDKey[]).map(key => {
              const label = key.replace('EOYOverride', '').toUpperCase() + ' Override';
              return (
                <tr key={key} className="border-b border-[#1e2d3d] hover:bg-[#111827]/50">
                  <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[10px] text-[#9ca3af] whitespace-nowrap min-w-[130px]">{label}</td>
                  {years.map((yd, i) => {
                    const v = yd[key] as number | undefined;
                    return (
                      <td key={yd.year} className="py-0.5 px-0.5">
                        <TimelineCell
                          value={v ?? 0}
                          onChange={val => updateYearOpt(i, key, val === 0 ? undefined : val)}
                          hasOverride={v !== undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </RowGroup>

          {/* Computed Results Summary */}
          <RowGroup title="Tax Results (Computed)" defaultOpen>
            {[
              { label: 'Net Taxable Income', fn: (i: number) => computed[i]?.tax.netTaxableIncome ?? 0 },
              { label: 'Federal Tax', fn: (i: number) => computed[i]?.tax.federalTaxPayable ?? 0 },
              { label: 'Provincial Tax', fn: (i: number) => computed[i]?.tax.provincialTaxPayable ?? 0 },
              { label: 'CPP Paid', fn: (i: number) => computed[i]?.cpp.totalCPPPaid ?? 0 },
              { label: 'EI Paid', fn: (i: number) => computed[i]?.ei.totalEI ?? 0 },
              { label: 'After-Tax Income', fn: (i: number) => computed[i]?.waterfall.afterTaxIncome ?? 0 },
              { label: 'Net Cash Flow', fn: (i: number) => computed[i]?.waterfall.netCashFlow ?? 0 },
              { label: 'Net Worth (EOY)', fn: (i: number) => computed[i]?.accounts.netWorth ?? 0 },
            ].map(({ label, fn }) => (
              <tr key={label} className="border-b border-[#1e2d3d]">
                <td className="sticky left-0 bg-[#0a0d14] z-10 py-0.5 pl-3 pr-2 text-[10px] text-[#9ca3af] whitespace-nowrap">{label}</td>
                {years.map((_, i) => {
                  const v = fn(i);
                  const color = label.includes('Flow') || label.includes('After-Tax')
                    ? v >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                    : label.includes('Tax') || label.includes('CPP') || label.includes('EI')
                    ? 'text-[#f59e0b]'
                    : 'text-[#3b82f6]';
                  return (
                    <td key={i} className={`py-0.5 px-0.5 text-right text-[10px] ${color}`}>
                      {v >= 1000 || v <= -1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </RowGroup>
        </tbody>
      </table>
    </div>
  );
}
