import type { ComputedYear } from '../types/computed';
import type { YearData } from '../types/scenario';

interface CSVRow {
  label: string;
  values: (string | number)[];
}

function fmt(v: number): string {
  return Math.round(v * 100) / 100 + '';
}

export function buildTimelineCSV(
  years: ComputedYear[],
  rawYears: YearData[],
): string {
  const rows: CSVRow[] = [];

  // Header row
  const yearLabels = years.map(y => y.year);

  // Income
  rows.push({ label: 'Employment Income', values: rawYears.map(y => y.employmentIncome) });
  rows.push({ label: 'Self-Employment Income', values: rawYears.map(y => y.selfEmploymentIncome) });
  rows.push({ label: 'Eligible Dividends', values: rawYears.map(y => y.eligibleDividends) });
  rows.push({ label: 'Non-Eligible Dividends', values: rawYears.map(y => y.nonEligibleDividends) });
  rows.push({ label: 'Interest Income', values: rawYears.map(y => y.interestIncome) });
  rows.push({ label: 'Capital Gains Realized', values: rawYears.map(y => y.capitalGainsRealized) });
  rows.push({ label: 'Capital Losses Realized', values: rawYears.map(y => y.capitalLossesRealized) });
  rows.push({ label: 'Other Taxable Income', values: rawYears.map(y => y.otherTaxableIncome) });
  rows.push({ label: 'Rental Gross Income', values: rawYears.map(y => y.rentalGrossIncome) });
  rows.push({ label: 'Rental Expenses', values: rawYears.map(y => y.rentalExpenses) });
  rows.push({ label: 'Pension Income', values: rawYears.map(y => y.pensionIncome) });
  rows.push({ label: 'Foreign Income', values: rawYears.map(y => y.foreignIncome) });
  rows.push({ label: 'Foreign Tax Paid', values: rawYears.map(y => y.foreignTaxPaid) });
  rows.push({ label: 'Charitable Donations', values: rawYears.map(y => y.charitableDonations) });
  rows.push({ label: 'SE Expenses', values: rawYears.map(y => (y as any).selfEmploymentExpenses ?? 0) });
  rows.push({ label: 'Child Care Expenses', values: rawYears.map(y => (y as any).childCareExpenses ?? 0) });
  rows.push({ label: 'Union/Prof. Dues', values: rawYears.map(y => (y as any).unionDues ?? 0) });
  rows.push({ label: 'Moving Expenses', values: rawYears.map(y => (y as any).movingExpenses ?? 0) });
  rows.push({ label: 'Medical Expenses', values: rawYears.map(y => (y as any).medicalExpenses ?? 0) });
  rows.push({ label: 'Student Loan Interest', values: rawYears.map(y => (y as any).studentLoanInterest ?? 0) });
  rows.push({ label: 'Other Deductions', values: rawYears.map(y => (y as any).otherDeductions ?? 0) });
  rows.push({ label: 'Other Non-Ref. Credits', values: rawYears.map(y => (y as any).otherNonRefundableCredits ?? 0) });
  rows.push({ label: 'Gross Income', values: years.map(y => fmt(y.waterfall.grossIncome)) });

  // Contributions & Withdrawals
  rows.push({ label: '', values: [] }); // blank separator
  rows.push({ label: 'RRSP Contribution', values: rawYears.map(y => y.rrspContribution) });
  rows.push({ label: 'RRSP Deduction Claimed', values: rawYears.map(y => y.rrspDeductionClaimed) });
  rows.push({ label: 'RRSP Withdrawal', values: rawYears.map(y => y.rrspWithdrawal) });
  rows.push({ label: 'TFSA Contribution', values: rawYears.map(y => y.tfsaContribution) });
  rows.push({ label: 'TFSA Withdrawal', values: rawYears.map(y => y.tfsaWithdrawal) });
  rows.push({ label: 'FHSA Contribution', values: rawYears.map(y => y.fhsaContribution) });
  rows.push({ label: 'FHSA Deduction Claimed', values: rawYears.map(y => y.fhsaDeductionClaimed) });
  rows.push({ label: 'FHSA Withdrawal', values: rawYears.map(y => y.fhsaWithdrawal) });
  rows.push({ label: 'Non-Reg Contribution', values: rawYears.map(y => y.nonRegContribution) });
  rows.push({ label: 'Non-Reg Withdrawal', values: rawYears.map(y => y.nonRegWithdrawal) });
  rows.push({ label: 'Savings Deposit', values: rawYears.map(y => y.savingsDeposit) });
  rows.push({ label: 'Savings Withdrawal', values: rawYears.map(y => y.savingsWithdrawal) });
  rows.push({ label: 'LIF Withdrawal', values: rawYears.map(y => y.lifWithdrawal) });
  rows.push({ label: 'RESP Contribution', values: rawYears.map(y => y.respContribution) });
  rows.push({ label: 'RESP Withdrawal', values: rawYears.map(y => y.respWithdrawal) });

  // Tax Results
  rows.push({ label: '', values: [] });
  rows.push({ label: 'Net Taxable Income', values: years.map(y => fmt(y.tax.netTaxableIncome)) });
  rows.push({ label: 'Federal Tax', values: years.map(y => fmt(y.tax.federalTaxPayable)) });
  rows.push({ label: 'Provincial Tax', values: years.map(y => fmt(y.tax.provincialTaxPayable)) });
  rows.push({ label: 'Total Income Tax', values: years.map(y => fmt(y.tax.totalIncomeTax)) });
  rows.push({ label: 'CWB Credit', values: years.map(y => fmt(y.tax.cwbCredit)) });
  rows.push({ label: 'CPP Paid', values: years.map(y => fmt(y.cpp.totalCPPPaid)) });
  rows.push({ label: 'EI Paid', values: years.map(y => fmt(y.ei.totalEI)) });
  rows.push({ label: 'After-Tax Income', values: years.map(y => fmt(y.waterfall.afterTaxIncome)) });
  rows.push({ label: 'Net Cash Flow', values: years.map(y => fmt(y.waterfall.netCashFlow)) });

  // Marginal Rates
  rows.push({ label: '', values: [] });
  rows.push({ label: 'Marginal Federal Rate', values: years.map(y => (y.tax.marginalFederalRate * 100).toFixed(2) + '%') });
  rows.push({ label: 'Marginal Provincial Rate', values: years.map(y => (y.tax.marginalProvincialRate * 100).toFixed(2) + '%') });
  rows.push({ label: 'Marginal Combined Rate', values: years.map(y => (y.tax.marginalCombinedRate * 100).toFixed(2) + '%') });
  rows.push({ label: 'Avg Tax Rate', values: years.map(y => (y.tax.avgIncomeTaxRate * 100).toFixed(2) + '%') });
  rows.push({ label: 'Avg All-In Rate', values: years.map(y => (y.tax.avgAllInRate * 100).toFixed(2) + '%') });

  // Account Balances
  rows.push({ label: '', values: [] });
  rows.push({ label: 'RRSP EOY', values: years.map(y => fmt(y.accounts.rrspEOY)) });
  rows.push({ label: 'TFSA EOY', values: years.map(y => fmt(y.accounts.tfsaEOY)) });
  rows.push({ label: 'FHSA EOY', values: years.map(y => fmt(y.accounts.fhsaEOY)) });
  rows.push({ label: 'Non-Reg EOY', values: years.map(y => fmt(y.accounts.nonRegEOY)) });
  rows.push({ label: 'Savings EOY', values: years.map(y => fmt(y.accounts.savingsEOY)) });
  rows.push({ label: 'LIRA/LIF EOY', values: years.map(y => fmt(y.accounts.liraEOY)) });
  rows.push({ label: 'RESP EOY', values: years.map(y => fmt(y.accounts.respEOY)) });
  rows.push({ label: 'RESP CESG', values: years.map(y => fmt(y.respCESG ?? 0)) });
  rows.push({ label: 'Net Worth', values: years.map(y => fmt(y.accounts.netWorth)) });

  // Room Tracking
  rows.push({ label: '', values: [] });
  rows.push({ label: 'RRSP Unused Room', values: years.map(y => fmt(y.rrspUnusedRoom)) });
  rows.push({ label: 'TFSA Unused Room', values: years.map(y => fmt(y.tfsaUnusedRoom)) });
  rows.push({ label: 'Capital Loss C/F', values: years.map(y => fmt(y.capitalLossCF)) });

  // Retirement
  rows.push({ label: '', values: [] });
  rows.push({ label: 'Age', values: years.map(y => y.retirement.age ?? '') });
  rows.push({ label: 'CPP Benefit Income', values: years.map(y => fmt(y.retirement.cppIncome)) });
  rows.push({ label: 'OAS Income', values: years.map(y => fmt(y.retirement.oasIncome)) });

  // Real Values
  rows.push({ label: '', values: [] });
  rows.push({ label: 'Real Gross Income', values: years.map(y => fmt(y.realGrossIncome)) });
  rows.push({ label: 'Real After-Tax Income', values: years.map(y => fmt(y.realAfterTaxIncome)) });
  rows.push({ label: 'Real Net Worth', values: years.map(y => fmt(y.realNetWorth)) });
  rows.push({ label: 'Real Net Cash Flow', values: years.map(y => fmt(y.realNetCashFlow)) });

  // Liabilities
  if (years.some(y => (y.totalDebt ?? 0) > 0)) {
    rows.push({ label: '', values: [] });
    rows.push({ label: 'Total Debt', values: years.map(y => fmt(y.totalDebt ?? 0)) });
    rows.push({ label: 'Debt Payment', values: years.map(y => fmt(y.totalDebtPayment ?? 0)) });
    rows.push({ label: 'Interest Paid', values: years.map(y => fmt(y.totalInterestPaid ?? 0)) });
  }

  // Build CSV string
  const escape = (s: string) => s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
  const header = ['', ...yearLabels.map(String)].join(',');
  const dataRows = rows.map(r => {
    if (r.values.length === 0) return '';
    return [escape(r.label), ...r.values.map(v => String(v))].join(',');
  });

  return [header, ...dataRows].join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
