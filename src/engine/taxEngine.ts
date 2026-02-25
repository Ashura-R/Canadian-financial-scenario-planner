import type { Assumptions, YearData, TaxBracket } from '../types/scenario';
import type { ComputedCPP, ComputedEI, ComputedTax, ComputedTaxDetail, BracketDetail } from '../types/computed';

function applyBrackets(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) continue;
    const upper = bracket.max !== null ? Math.min(income, bracket.max) : income;
    tax += (upper - bracket.min) * bracket.rate;
    if (bracket.max !== null && income <= bracket.max) break;
  }
  return Math.max(0, tax);
}

export function computeBracketDetail(income: number, brackets: TaxBracket[]): BracketDetail[] {
  return brackets.map(b => {
    if (income <= b.min) return { min: b.min, max: b.max, rate: b.rate, incomeInBracket: 0, taxInBracket: 0 };
    const upper = b.max !== null ? Math.min(income, b.max) : income;
    const incomeInBracket = Math.max(0, upper - b.min);
    return { min: b.min, max: b.max, rate: b.rate, incomeInBracket, taxInBracket: incomeInBracket * b.rate };
  });
}

function marginalRate(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return 0;
}

export function computeCPP(
  empIncome: number,
  seIncome: number,
  cpp: Assumptions['cpp']
): ComputedCPP {
  const { basicExemption, ympe, yampe, employeeRate, cpp2Rate } = cpp;

  // Employee CPP1
  const empPensionable = Math.max(0, Math.min(empIncome, ympe) - basicExemption);
  const cppEmployee = empIncome > 0 ? empPensionable * employeeRate : 0;

  // Employee CPP2 (on earnings between YMPE and YAMPE)
  const empAboveYMPE = empIncome > 0 ? Math.max(0, Math.min(empIncome, yampe) - ympe) : 0;
  const cpp2Employee = empAboveYMPE * cpp2Rate;

  // Self-employed CPP1 (pays both employee + employer)
  const sePensionable = Math.max(0, Math.min(seIncome, ympe) - basicExemption);
  const cppSE = seIncome > 0 ? sePensionable * employeeRate * 2 : 0;

  // Self-employed CPP2
  const seAboveYMPE = seIncome > 0 ? Math.max(0, Math.min(seIncome, yampe) - ympe) : 0;
  const cpp2SE = seAboveYMPE * cpp2Rate * 2;

  // SE employer half deduction
  const cppSEEmployerHalfDed = (cppSE + cpp2SE) * 0.5;

  // For credit purposes: employee half of CPP paid (employee pays + employee half of SE)
  const totalCPPForCredit = cppEmployee + cpp2Employee + cppSE * 0.5 + cpp2SE * 0.5;

  const totalCPPPaid = cppEmployee + cpp2Employee + cppSE + cpp2SE;

  return {
    pensionableEarnings: empPensionable + sePensionable,
    cppEmployee,
    cpp2Employee,
    cppSE,
    cpp2SE,
    cppSEEmployerHalfDed,
    totalCPPForCredit,
    totalCPPPaid,
  };
}

export function computeEI(
  empIncome: number,
  seIncome: number,
  ei: Assumptions['ei']
): ComputedEI {
  const { maxInsurableEarnings, employeeRate, seOptIn } = ei;
  const eiEmployment = empIncome > 0
    ? Math.min(empIncome, maxInsurableEarnings) * employeeRate
    : 0;
  const eiSE = (seIncome > 0 && seOptIn)
    ? Math.min(seIncome, maxInsurableEarnings) * employeeRate
    : 0;
  return {
    eiEmployment,
    eiSE,
    totalEI: eiEmployment + eiSE,
  };
}

export interface RetirementIncome {
  cppBenefitIncome: number;  // CPP pension benefit received this year
  oasIncome: number;         // OAS benefit received this year
}

export function computeTax(
  yd: YearData,
  ass: Assumptions,
  cpp: ComputedCPP,
  ei: ComputedEI,
  retirementIncome: RetirementIncome = { cppBenefitIncome: 0, oasIncome: 0 },
  province?: string
): ComputedTax & { detail: ComputedTaxDetail } {
  const { capitalGainsInclusionRate, dividendRates, federalBrackets, provincialBrackets, federalBPA, provincialBPA } = ass;

  // Gross-up dividends
  const grossedUpEligibleDiv = yd.eligibleDividends * (1 + dividendRates.eligible.grossUp);
  const grossedUpNonEligibleDiv = yd.nonEligibleDividends * (1 + dividendRates.nonEligible.grossUp);

  // Taxable capital gains
  const netGains = yd.capitalGainsRealized - yd.capitalLossApplied;
  const taxableCapitalGains = Math.max(0, netGains) * capitalGainsInclusionRate;

  // Total income before deductions
  // Note: rrspWithdrawal (and RRIF withdrawals) are fully taxable
  // CPP pension benefit and OAS are also taxable income
  const totalIncomeBeforeDeductions =
    yd.employmentIncome +
    yd.selfEmploymentIncome +
    yd.rrspWithdrawal +
    retirementIncome.cppBenefitIncome +
    retirementIncome.oasIncome +
    grossedUpEligibleDiv +
    grossedUpNonEligibleDiv +
    yd.interestIncome +
    taxableCapitalGains +
    yd.otherTaxableIncome;

  // Net taxable income
  const netTaxableIncome = Math.max(
    0,
    totalIncomeBeforeDeductions
      - yd.rrspDeductionClaimed
      - yd.fhsaDeductionClaimed
      - cpp.cppSEEmployerHalfDed
  );

  // --- Federal Tax ---
  const federalTaxBeforeCredits = applyBrackets(netTaxableIncome, federalBrackets);

  // Credits
  const bpaCreditRate = federalBrackets[0]?.rate ?? 0.15;
  const bpaCredit = federalBPA * bpaCreditRate;
  const cppCredit = cpp.totalCPPForCredit * bpaCreditRate;
  const eiCredit = ei.totalEI * bpaCreditRate;
  const eligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.federalCredit;
  const nonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.federalCredit;

  const federalCredits = bpaCredit + cppCredit + eiCredit + eligibleDivCredit + nonEligibleDivCredit;
  const federalTaxPayable = Math.max(0, federalTaxBeforeCredits - federalCredits);

  // --- Provincial Tax ---
  const provincialTaxBeforeCredits = applyBrackets(netTaxableIncome, provincialBrackets);

  const provBPACredit = provincialBPA * (provincialBrackets[0]?.rate ?? 0.0505);
  const provCPPCredit = cpp.totalCPPForCredit * (provincialBrackets[0]?.rate ?? 0.0505);
  const provEICredit = ei.totalEI * (provincialBrackets[0]?.rate ?? 0.0505);
  const provEligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.provincialCredit;
  const provNonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.provincialCredit;

  const provincialCredits = provBPACredit + provCPPCredit + provEICredit + provEligibleDivCredit + provNonEligibleDivCredit;
  let provincialTaxPayable = Math.max(0, provincialTaxBeforeCredits - provincialCredits);

  // Ontario surtax
  let ontarioSurtax = 0;
  const prov = province ?? ass.province;
  if (prov === 'ON') {
    ontarioSurtax = 0.20 * Math.max(0, provincialTaxPayable - 4991) + 0.36 * Math.max(0, provincialTaxPayable - 6387);
    provincialTaxPayable += ontarioSurtax;
  }

  // OAS clawback (15% recovery tax on net income above threshold)
  const oasClawbackThreshold = ass.oasClawbackThreshold ?? 86912;
  let oasClawback = 0;
  if (retirementIncome.oasIncome > 0 && netTaxableIncome > oasClawbackThreshold) {
    oasClawback = Math.min(retirementIncome.oasIncome, 0.15 * (netTaxableIncome - oasClawbackThreshold));
  }

  const totalIncomeTax = federalTaxPayable + provincialTaxPayable;

  // Gross income for rate calculations (pre-gross-up, pre-deductions)
  const grossIncome =
    yd.employmentIncome + yd.selfEmploymentIncome +
    yd.rrspWithdrawal +
    retirementIncome.cppBenefitIncome + retirementIncome.oasIncome +
    yd.eligibleDividends + yd.nonEligibleDividends +
    yd.interestIncome + yd.capitalGainsRealized + yd.otherTaxableIncome;

  const margFed = marginalRate(netTaxableIncome, federalBrackets);
  const margProv = marginalRate(netTaxableIncome, provincialBrackets);

  const avgIncomeTaxRate = grossIncome > 0 ? totalIncomeTax / grossIncome : 0;
  const avgAllInRate = grossIncome > 0
    ? (totalIncomeTax + cpp.totalCPPPaid + ei.totalEI) / grossIncome
    : 0;

  const detail: ComputedTaxDetail = {
    fedBPACredit: bpaCredit,
    fedCPPCredit: cppCredit,
    fedEICredit: eiCredit,
    fedEligibleDivCredit: eligibleDivCredit,
    fedNonEligibleDivCredit: nonEligibleDivCredit,
    provBPACredit: provBPACredit,
    provCPPCredit: provCPPCredit,
    provEICredit: provEICredit,
    provEligibleDivCredit: provEligibleDivCredit,
    provNonEligibleDivCredit: provNonEligibleDivCredit,
    federalBracketDetail: computeBracketDetail(netTaxableIncome, federalBrackets),
    provincialBracketDetail: computeBracketDetail(netTaxableIncome, provincialBrackets),
  };

  return {
    grossedUpEligibleDiv,
    grossedUpNonEligibleDiv,
    taxableCapitalGains,
    totalIncomeBeforeDeductions,
    netTaxableIncome,
    federalTaxBeforeCredits,
    federalCredits,
    federalTaxPayable,
    provincialTaxBeforeCredits,
    provincialCredits,
    provincialTaxPayable,
    ontarioSurtax,
    oasClawback,
    totalIncomeTax,
    marginalFederalRate: margFed,
    marginalProvincialRate: margProv,
    marginalCombinedRate: margFed + margProv,
    avgIncomeTaxRate,
    avgAllInRate,
    detail,
  };
}
