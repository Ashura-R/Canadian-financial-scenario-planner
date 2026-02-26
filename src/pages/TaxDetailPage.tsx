import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useScenario, useWhatIf } from '../store/ScenarioContext';
import { formatCAD, formatPct, formatShort, safe } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import type { ComputedYear, BracketDetail } from '../types/computed';
import { useChartColors } from '../hooks/useChartColors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app-border text-xs font-semibold text-app-text2 uppercase tracking-wide">{title}</div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, cls, indent }: { label: string; value: string; cls?: string; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 border-b border-app-border last:border-0 ${indent ? 'pl-4' : ''}`}>
      <span className="text-xs text-app-text3">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${cls ?? 'text-app-text'}`}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-t border-app-border bg-app-surface2 -mx-4 px-4">
      <span className="text-xs font-semibold text-app-text2">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${cls ?? 'text-app-text'}`}>{value}</span>
    </div>
  );
}

function BracketTable({ brackets, label }: { brackets: BracketDetail[]; label: string }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-1">{label}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-app-border">
            <th className="text-left py-1 text-[10px] text-app-text4 font-medium">Bracket</th>
            <th className="text-right py-1 text-[10px] text-app-text4 font-medium">Rate</th>
            <th className="text-right py-1 text-[10px] text-app-text4 font-medium">Income</th>
            <th className="text-right py-1 text-[10px] text-app-text4 font-medium">Tax</th>
          </tr>
        </thead>
        <tbody>
          {brackets.map((b, i) => (
            <tr key={i} className="border-b border-app-border">
              <td className="py-0.5 text-app-text3">
                {formatCAD(b.min)} – {b.max !== null ? formatCAD(b.max) : '∞'}
              </td>
              <td className="py-0.5 text-right text-app-text2">{(b.rate * 100).toFixed(2)}%</td>
              <td className="py-0.5 text-right text-app-text2">{formatCAD(b.incomeInBracket)}</td>
              <td className="py-0.5 text-right font-medium text-red-600">{formatCAD(b.taxInBracket)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SingleYearView({ yr, rawYd }: { yr: ComputedYear; rawYd: import('../types/scenario').YearData }) {
  const { tax, taxDetail, cpp, ei, waterfall, retirement } = yr;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Income Composition */}
      <Section title="Income Composition">
        <Row label="Employment Income" value={formatCAD(rawYd.employmentIncome)} />
        <Row label="Self-Employment Income" value={formatCAD(rawYd.selfEmploymentIncome)} />
        <Row label="Eligible Dividends (actual)" value={formatCAD(rawYd.eligibleDividends)} />
        <Row label="  → Grossed-up" value={formatCAD(tax.grossedUpEligibleDiv)} indent cls="text-app-text4" />
        <Row label="Non-Eligible Dividends (actual)" value={formatCAD(rawYd.nonEligibleDividends)} />
        <Row label="  → Grossed-up" value={formatCAD(tax.grossedUpNonEligibleDiv)} indent cls="text-app-text4" />
        <Row label="Interest Income" value={formatCAD(rawYd.interestIncome)} />
        <Row label="Capital Gains (taxable)" value={formatCAD(tax.taxableCapitalGains)} />
        <Row label="RRSP Withdrawal" value={formatCAD(rawYd.rrspWithdrawal)} />
        {retirement.cppIncome > 0 && <Row label="CPP Benefit" value={formatCAD(retirement.cppIncome)} />}
        {retirement.oasIncome > 0 && <Row label="OAS Benefit" value={formatCAD(retirement.oasIncome)} />}
        <Row label="Other Taxable Income" value={formatCAD(rawYd.otherTaxableIncome)} />
        <TotalRow label="Total Income Before Deductions" value={formatCAD(tax.totalIncomeBeforeDeductions)} />
      </Section>

      {/* Deductions */}
      <Section title="Deductions → Net Taxable">
        <Row label="RRSP Deduction" value={`(${formatCAD(rawYd.rrspDeductionClaimed)})`} cls="text-emerald-600" />
        <Row label="FHSA Deduction" value={`(${formatCAD(rawYd.fhsaDeductionClaimed)})`} cls="text-emerald-600" />
        <Row label="CPP SE Employer Half" value={`(${formatCAD(cpp.cppSEEmployerHalfDed)})`} cls="text-emerald-600" />
        <TotalRow label="Net Taxable Income" value={formatCAD(tax.netTaxableIncome)} />
      </Section>

      {/* Federal Tax */}
      <Section title="Federal Tax">
        <BracketTable brackets={taxDetail.federalBracketDetail} label="Federal Brackets" />
        <div className="mt-3">
          <TotalRow label="Federal Tax Before Credits" value={formatCAD(tax.federalTaxBeforeCredits)} cls="text-red-600" />
        </div>
        <div className="mt-2">
          <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-1">Credits</div>
          <Row label="BPA Credit" value={`(${formatCAD(taxDetail.fedBPACredit)})`} cls="text-emerald-600" />
          <Row label="CPP Credit" value={`(${formatCAD(taxDetail.fedCPPCredit)})`} cls="text-emerald-600" />
          <Row label="EI Credit" value={`(${formatCAD(taxDetail.fedEICredit)})`} cls="text-emerald-600" />
          <Row label="Employment Amount Credit" value={`(${formatCAD(taxDetail.fedEmploymentCredit)})`} cls="text-emerald-600" />
          {taxDetail.fedPensionCredit > 0 && <Row label="Pension Income Credit" value={`(${formatCAD(taxDetail.fedPensionCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedAgeCredit > 0 && <Row label="Age Amount Credit" value={`(${formatCAD(taxDetail.fedAgeCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedDonationCredit > 0 && <Row label="Donation Credit" value={`(${formatCAD(taxDetail.fedDonationCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedDTCCredit > 0 && <Row label="Disability Credit" value={`(${formatCAD(taxDetail.fedDTCCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedMedicalCredit > 0 && <Row label="Medical Credit" value={`(${formatCAD(taxDetail.fedMedicalCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedStudentLoanCredit > 0 && <Row label="Student Loan Credit" value={`(${formatCAD(taxDetail.fedStudentLoanCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedHomeBuyersCredit > 0 && <Row label="Home Buyers' Credit" value={`(${formatCAD(taxDetail.fedHomeBuyersCredit)})`} cls="text-emerald-600" />}
          {taxDetail.fedOtherCredits > 0 && <Row label="Other Credits" value={`(${formatCAD(taxDetail.fedOtherCredits)})`} cls="text-emerald-600" />}
          <Row label="Eligible Div Credit" value={`(${formatCAD(taxDetail.fedEligibleDivCredit)})`} cls="text-emerald-600" />
          <Row label="Non-Eligible Div Credit" value={`(${formatCAD(taxDetail.fedNonEligibleDivCredit)})`} cls="text-emerald-600" />
          {tax.quebecAbatement > 0 && (
            <Row label="Quebec Abatement (16.5%)" value={`(${formatCAD(tax.quebecAbatement)})`} cls="text-emerald-600" />
          )}
          {tax.amtAdditional > 0 && (
            <Row label="AMT Additional" value={formatCAD(tax.amtAdditional)} cls="text-red-600" />
          )}
          <TotalRow label="Federal Tax Payable" value={formatCAD(tax.federalTaxPayable)} cls="text-red-600" />
        </div>
      </Section>

      {/* Provincial Tax */}
      <Section title="Provincial Tax">
        <BracketTable brackets={taxDetail.provincialBracketDetail} label="Provincial Brackets" />
        <div className="mt-3">
          <TotalRow label="Provincial Tax Before Credits" value={formatCAD(tax.provincialTaxBeforeCredits)} cls="text-red-600" />
        </div>
        <div className="mt-2">
          <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-1">Credits</div>
          <Row label="BPA Credit" value={`(${formatCAD(taxDetail.provBPACredit)})`} cls="text-emerald-600" />
          <Row label="CPP Credit" value={`(${formatCAD(taxDetail.provCPPCredit)})`} cls="text-emerald-600" />
          <Row label="EI Credit" value={`(${formatCAD(taxDetail.provEICredit)})`} cls="text-emerald-600" />
          <Row label="Employment Amount Credit" value={`(${formatCAD(taxDetail.provEmploymentCredit)})`} cls="text-emerald-600" />
          {taxDetail.provPensionCredit > 0 && <Row label="Pension Income Credit" value={`(${formatCAD(taxDetail.provPensionCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provAgeCredit > 0 && <Row label="Age Amount Credit" value={`(${formatCAD(taxDetail.provAgeCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provDonationCredit > 0 && <Row label="Donation Credit" value={`(${formatCAD(taxDetail.provDonationCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provDTCCredit > 0 && <Row label="Disability Credit" value={`(${formatCAD(taxDetail.provDTCCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provMedicalCredit > 0 && <Row label="Medical Credit" value={`(${formatCAD(taxDetail.provMedicalCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provStudentLoanCredit > 0 && <Row label="Student Loan Credit" value={`(${formatCAD(taxDetail.provStudentLoanCredit)})`} cls="text-emerald-600" />}
          {taxDetail.provOtherCredits > 0 && <Row label="Other Credits" value={`(${formatCAD(taxDetail.provOtherCredits)})`} cls="text-emerald-600" />}
          <Row label="Eligible Div Credit" value={`(${formatCAD(taxDetail.provEligibleDivCredit)})`} cls="text-emerald-600" />
          <Row label="Non-Eligible Div Credit" value={`(${formatCAD(taxDetail.provNonEligibleDivCredit)})`} cls="text-emerald-600" />
          {tax.ontarioSurtax > 0 && (
            <Row label="Ontario Surtax" value={formatCAD(tax.ontarioSurtax)} cls="text-red-600" />
          )}
          <TotalRow label="Provincial Tax Payable" value={formatCAD(tax.provincialTaxPayable)} cls="text-red-600" />
        </div>
        {tax.oasClawback > 0 && (
          <div className="mt-2">
            <Row label="OAS Clawback" value={formatCAD(tax.oasClawback)} cls="text-red-600" />
          </div>
        )}
      </Section>

      {/* CPP & EI */}
      <Section title="CPP & EI Breakdown">
        <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-1">CPP</div>
        <Row label="CPP1 Employee" value={formatCAD(cpp.cppEmployee)} />
        <Row label="CPP2 Employee" value={formatCAD(cpp.cpp2Employee)} />
        <Row label="CPP Self-Employed" value={formatCAD(cpp.cppSE)} />
        <Row label="CPP2 Self-Employed" value={formatCAD(cpp.cpp2SE)} />
        <Row label="SE Employer Half Deduction" value={`(${formatCAD(cpp.cppSEEmployerHalfDed)})`} cls="text-emerald-600" />
        <Row label="Total CPP Paid" value={formatCAD(cpp.totalCPPPaid)} cls="text-amber-600" />
        <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-1 mt-3">EI</div>
        <Row label="EI Employment" value={formatCAD(ei.eiEmployment)} />
        <Row label="EI Self-Employed" value={formatCAD(ei.eiSE)} />
        <Row label="Total EI" value={formatCAD(ei.totalEI)} cls="text-amber-600" />
      </Section>

      {/* Waterfall */}
      <Section title="Tax Waterfall">
        <Row label="Gross Income" value={formatCAD(waterfall.grossIncome)} />
        <Row label="After RRSP Deduction" value={formatCAD(waterfall.afterRRSPDed)} />
        <Row label="After FHSA Deduction" value={formatCAD(waterfall.afterFHSADed)} />
        <Row label="After CPP SE Half" value={formatCAD(waterfall.afterCPPSEHalf)} />
        <Row label="After Cap Loss" value={formatCAD(waterfall.afterCapLoss)} />
        <Row label="Net Taxable Income" value={formatCAD(waterfall.netTaxableIncome)} cls="font-semibold text-app-text" />
        <Row label="After Federal Tax" value={formatCAD(waterfall.afterFederalTax)} />
        <Row label="After Provincial Tax" value={formatCAD(waterfall.afterProvincialTax)} />
        <Row label="After CPP+EI" value={formatCAD(waterfall.afterCPPEI)} />
        <TotalRow label="After-Tax Income" value={formatCAD(waterfall.afterTaxIncome)} cls="text-emerald-600" />
        <div className="mt-2">
          <TotalRow label="Net Cash Flow" value={formatCAD(waterfall.netCashFlow)} cls={waterfall.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        </div>
      </Section>

      {/* Rates */}
      <div className="col-span-2">
        <Section title="Tax Rates">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-2">Federal</div>
              <Row label="Marginal Rate" value={formatPct(tax.marginalFederalRate)} />
              <Row label="Effective Rate" value={formatPct(tax.federalTaxPayable / Math.max(1, waterfall.grossIncome))} />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-2">Provincial</div>
              <Row label="Marginal Rate" value={formatPct(tax.marginalProvincialRate)} />
              <Row label="Effective Rate" value={formatPct(tax.provincialTaxPayable / Math.max(1, waterfall.grossIncome))} />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-app-text4 uppercase tracking-wider mb-2">Combined</div>
              <Row label="Marginal Combined" value={formatPct(tax.marginalCombinedRate)} />
              <Row label="Avg Income Tax Rate" value={formatPct(tax.avgIncomeTaxRate)} />
              <Row label="Avg All-In Rate" value={formatPct(tax.avgAllInRate)} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function AllYearsView({ years, rawYears }: { years: ComputedYear[]; rawYears: import('../types/scenario').YearData[] }) {
  const rows: { label: string; fn: (yr: ComputedYear, i: number) => string; cls?: string; group: string }[] = [
    { group: 'Income', label: 'Employment', fn: (_, i) => formatShort(rawYears[i].employmentIncome) },
    { group: 'Income', label: 'Self-Employment', fn: (_, i) => formatShort(rawYears[i].selfEmploymentIncome) },
    { group: 'Income', label: 'Gross Income', fn: yr => formatShort(yr.waterfall.grossIncome), cls: 'font-semibold' },
    { group: 'Income', label: 'Net Taxable', fn: yr => formatShort(yr.tax.netTaxableIncome), cls: 'font-semibold' },
    { group: 'Tax', label: 'Fed Tax Before Credits', fn: yr => formatShort(yr.tax.federalTaxBeforeCredits), cls: 'text-red-600' },
    { group: 'Tax', label: 'Fed Credits', fn: yr => formatShort(yr.tax.federalCredits), cls: 'text-emerald-600' },
    { group: 'Tax', label: 'Fed Tax Payable', fn: yr => formatShort(yr.tax.federalTaxPayable), cls: 'text-red-600 font-semibold' },
    { group: 'Tax', label: 'Prov Tax Before Credits', fn: yr => formatShort(yr.tax.provincialTaxBeforeCredits), cls: 'text-red-600' },
    { group: 'Tax', label: 'Prov Credits', fn: yr => formatShort(yr.tax.provincialCredits), cls: 'text-emerald-600' },
    { group: 'Tax', label: 'Prov Tax Payable', fn: yr => formatShort(yr.tax.provincialTaxPayable), cls: 'text-red-600 font-semibold' },
    { group: 'Tax', label: 'Ontario Surtax', fn: yr => formatShort(yr.tax.ontarioSurtax), cls: 'text-red-600' },
    { group: 'Tax', label: 'OAS Clawback', fn: yr => formatShort(yr.tax.oasClawback), cls: 'text-red-600' },
    { group: 'Tax', label: 'Foreign Tax Credit', fn: yr => formatShort(yr.tax.foreignTaxCredit), cls: 'text-emerald-600' },
    { group: 'Tax', label: 'CWB Credit', fn: yr => formatShort(yr.tax.cwbCredit), cls: 'text-emerald-600' },
    { group: 'Tax', label: 'Total Income Tax', fn: yr => formatShort(yr.tax.totalIncomeTax), cls: 'text-red-700 font-bold' },
    { group: 'CPP/EI', label: 'CPP Paid', fn: yr => formatShort(yr.cpp.totalCPPPaid), cls: 'text-amber-600' },
    { group: 'CPP/EI', label: 'EI Paid', fn: yr => formatShort(yr.ei.totalEI), cls: 'text-amber-600' },
    { group: 'Result', label: 'After-Tax Income', fn: yr => formatShort(yr.waterfall.afterTaxIncome), cls: 'text-emerald-600 font-semibold' },
    { group: 'Result', label: 'Net Cash Flow', fn: yr => formatShort(yr.waterfall.netCashFlow) },
    { group: 'Rates', label: 'Marginal Combined', fn: yr => formatPct(yr.tax.marginalCombinedRate) },
    { group: 'Rates', label: 'Avg Tax Rate', fn: yr => formatPct(yr.tax.avgIncomeTaxRate) },
    { group: 'Rates', label: 'Avg All-In Rate', fn: yr => formatPct(yr.tax.avgAllInRate) },
  ];

  const groups = [...new Set(rows.map(r => r.group))];

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ minWidth: 200 + years.length * 80 }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-app-surface2 border-b border-app-border">
            <th className="sticky left-0 bg-app-surface2 z-20 py-2 px-3 text-left text-[10px] text-app-text3 font-semibold uppercase w-48">Metric</th>
            {years.map(yr => (
              <th key={yr.year} className="py-2 px-2 text-center text-[10px] font-semibold text-app-text2" style={{ minWidth: 80 }}>{yr.year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <React.Fragment key={group}>
              <tr className="bg-app-surface2/60">
                <td colSpan={years.length + 1} className="py-1 px-3 text-[9px] font-semibold text-app-text4 uppercase tracking-widest">{group}</td>
              </tr>
              {rows.filter(r => r.group === group).map(row => (
                <tr key={row.label} className="border-b border-app-border hover:bg-app-accent-light/30">
                  <td className="sticky left-0 bg-app-surface z-10 py-1 px-3 text-xs text-app-text2 whitespace-nowrap">{row.label}</td>
                  {years.map((yr, i) => (
                    <td key={yr.year} className={`py-1 px-2 text-right text-xs ${row.cls ?? 'text-app-text2'}`}>
                      {row.fn(yr, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginalRateChart({ years, selectedYearIdx, onSelectYear }: {
  years: ComputedYear[];
  selectedYearIdx: number;
  onSelectYear: (i: number) => void;
}) {
  const chartColors = useChartColors();
  const data = useMemo(() =>
    years.map(y => ({
      year: y.year,
      Federal: safe(y.tax.marginalFederalRate),
      Provincial: safe(y.tax.marginalProvincialRate),
      Combined: safe(y.tax.marginalCombinedRate),
      'Avg All-In': safe(y.tax.avgAllInRate),
    })),
    [years]
  );

  return (
    <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-2 border-b border-app-border text-xs font-semibold text-app-text2">Marginal & Average Tax Rates Over Time</div>
      <div style={{ height: 200, padding: '12px 12px 8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            onClick={(e) => {
              if (e?.activeTooltipIndex !== undefined) onSelectYear(e.activeTooltipIndex);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
            <XAxis dataKey="year" tick={chartColors.axisTick} />
            <YAxis tickFormatter={v => formatPct(v)} tick={chartColors.axisTick} />
            <Tooltip
              contentStyle={chartColors.tooltipStyle}
              formatter={(v: number, name: string) => [formatPct(v), name]}
            />
            <Legend wrapperStyle={chartColors.legendStyle10} />
            <Line type="monotone" dataKey="Federal" stroke="#2563eb" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Provincial" stroke="#059669" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Combined" stroke="#dc2626" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Avg All-In" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TaxDetailPage() {
  const { activeComputed, activeScenario } = useScenario();
  const { isActive: isWhatIfMode, computed: whatIfComputed } = useWhatIf();
  const [viewMode, setViewModeRaw] = useState<'single' | 'all'>(() => {
    try { const v = localStorage.getItem('cdn-tax-taxdetail-view'); return v === 'all' ? 'all' : 'single'; } catch { return 'single'; }
  });
  function setViewMode(v: 'single' | 'all') { setViewModeRaw(v); try { localStorage.setItem('cdn-tax-taxdetail-view', v); } catch {} }

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

  return (
    <div className="h-full overflow-auto bg-app-bg">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">Tax Detail</div>
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

        {/* Marginal Rate Chart — always visible */}
        <MarginalRateChart years={years} selectedYearIdx={selectedYearIdx} onSelectYear={setSelectedYearIdx} />

        {viewMode === 'single' ? (
          <SingleYearView yr={yr} rawYd={rawYd} />
        ) : (
          <AllYearsView years={years} rawYears={rawYears} />
        )}
      </div>
    </div>
  );
}
