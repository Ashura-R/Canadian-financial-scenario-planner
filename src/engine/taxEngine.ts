import type { Assumptions, YearData, TaxBracket } from '../types/scenario';
import type { ComputedCPP, ComputedEI, ComputedTax, ComputedTaxDetail, BracketDetail } from '../types/computed';
import { PROVINCIAL_EMPLOYMENT_AMOUNT, PROVINCIAL_AGE_AMOUNT, PROVINCIAL_AGE_CLAWBACK } from '../store/defaults';

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

  // CPP1 max pensionable earnings (shared ceiling across employment + SE)
  const maxPensionable = Math.max(0, ympe - basicExemption);

  // Employee CPP1 — computed first, gets priority
  const empPensionable = empIncome > 0
    ? Math.max(0, Math.min(empIncome, ympe) - basicExemption)
    : 0;
  const cppEmployee = empPensionable * employeeRate;

  // Self-employed CPP1 — only on remaining pensionable room
  const remainingPensionable = Math.max(0, maxPensionable - empPensionable);
  const sePensionableRaw = seIncome > 0
    ? Math.max(0, Math.min(seIncome, ympe) - basicExemption)
    : 0;
  const sePensionable = Math.min(sePensionableRaw, remainingPensionable);
  const cppSE = sePensionable * employeeRate * 2; // SE pays both halves

  // CPP2: earnings between YMPE and YAMPE (also shared ceiling)
  const maxCPP2Earnings = Math.max(0, yampe - ympe);

  const empAboveYMPE = empIncome > 0 ? Math.max(0, Math.min(empIncome, yampe) - ympe) : 0;
  const cpp2Employee = empAboveYMPE * cpp2Rate;

  const remainingCPP2 = Math.max(0, maxCPP2Earnings - empAboveYMPE);
  const seAboveYMPERaw = seIncome > 0 ? Math.max(0, Math.min(seIncome, yampe) - ympe) : 0;
  const seAboveYMPE = Math.min(seAboveYMPERaw, remainingCPP2);
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
  province?: string,
  age: number | null = null,
  isRRIF: boolean = false,
): ComputedTax & { detail: ComputedTaxDetail } {
  const { capitalGainsInclusionRate, dividendRates, federalBrackets, provincialBrackets, federalBPA, provincialBPA, federalEmploymentAmount } = ass;

  // Gross-up dividends
  const grossedUpEligibleDiv = yd.eligibleDividends * (1 + dividendRates.eligible.grossUp);
  const grossedUpNonEligibleDiv = yd.nonEligibleDividends * (1 + dividendRates.nonEligible.grossUp);

  // Taxable capital gains (two-tier post-June 2024 rules if enabled)
  const netGains = yd.capitalGainsRealized - yd.capitalLossApplied;
  let taxableCapitalGains: number;
  if (ass.cgInclusionTiered) {
    const tier1Rate = ass.cgInclusionTier1Rate ?? 0.5;
    const tier2Rate = ass.cgInclusionTier2Rate ?? (2 / 3);
    const threshold = ass.cgInclusionThreshold ?? 250000;
    const gains = Math.max(0, netGains);
    const tier1Gains = Math.min(gains, threshold);
    const tier2Gains = Math.max(0, gains - threshold);
    taxableCapitalGains = tier1Gains * tier1Rate + tier2Gains * tier2Rate;
  } else {
    taxableCapitalGains = Math.max(0, netGains) * capitalGainsInclusionRate;
  }

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
  const fedEmploymentCredit = yd.employmentIncome > 0
    ? Math.min(yd.employmentIncome, federalEmploymentAmount ?? 0) * bpaCreditRate
    : 0;

  // Pension income credit: up to $2,000 of eligible pension income at lowest bracket rate
  // Eligible: RRIF withdrawals when age >= 65
  const pensionIncomeAmount = 2000;
  const eligiblePensionIncome = (isRRIF && age !== null && age >= 65) ? yd.rrspWithdrawal : 0;
  const fedPensionCredit = Math.min(eligiblePensionIncome, pensionIncomeAmount) * bpaCreditRate;

  // Age amount credit: $8,396 (2024), clawed back at 15% of net income above $42,335
  const fedAgeAmountBase = 8396;
  const ageClawbackThreshold = 42335;
  let fedAgeCredit = 0;
  if (age !== null && age >= 65) {
    const ageAmount = Math.max(0, fedAgeAmountBase - 0.15 * Math.max(0, netTaxableIncome - ageClawbackThreshold));
    fedAgeCredit = ageAmount * bpaCreditRate;
  }

  // Charitable donation credit
  // Federal: first $200 at 15%, above $200 at 29% (33% if income > top bracket threshold)
  const donations = Math.min(yd.charitableDonations ?? 0, netTaxableIncome * 0.75); // 75% of net income limit
  let fedDonationCredit = 0;
  if (donations > 0) {
    const first200 = Math.min(donations, 200) * 0.15;
    const above200 = Math.max(0, donations - 200);
    const topBracket = federalBrackets[federalBrackets.length - 1];
    const highRate = (topBracket && netTaxableIncome > (topBracket.min ?? 0)) ? 0.33 : 0.29;
    fedDonationCredit = first200 + above200 * highRate;
  }

  const eligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.federalCredit;
  const nonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.federalCredit;

  const federalCredits = bpaCredit + cppCredit + eiCredit + fedEmploymentCredit + fedPensionCredit + fedAgeCredit + fedDonationCredit + eligibleDivCredit + nonEligibleDivCredit;
  let federalTaxPayable = Math.max(0, federalTaxBeforeCredits - federalCredits);

  // --- Quebec Abatement (16.5% reduction of basic federal tax) ---
  const prov = province ?? ass.province;
  let quebecAbatement = 0;
  if (prov === 'QC') {
    quebecAbatement = federalTaxPayable * 0.165;
    federalTaxPayable = Math.max(0, federalTaxPayable - quebecAbatement);
  }
  const provincialTaxBeforeCredits = applyBrackets(netTaxableIncome, provincialBrackets);

  const provBPACredit = provincialBPA * (provincialBrackets[0]?.rate ?? 0.0505);
  const provCPPCredit = cpp.totalCPPForCredit * (provincialBrackets[0]?.rate ?? 0.0505);
  const provEICredit = ei.totalEI * (provincialBrackets[0]?.rate ?? 0.0505);
  const provEmploymentAmt = PROVINCIAL_EMPLOYMENT_AMOUNT[prov] ?? 0;
  const provEmploymentCredit = yd.employmentIncome > 0
    ? Math.min(yd.employmentIncome, provEmploymentAmt) * (provincialBrackets[0]?.rate ?? 0.0505)
    : 0;

  // Provincial pension income credit (same $2,000 eligible amount, provincial rate)
  const provPensionCredit = Math.min(eligiblePensionIncome, pensionIncomeAmount) * (provincialBrackets[0]?.rate ?? 0.0505);

  // Provincial age amount credit (varies by province, using federal amount as approximation)
  const provAgeAmountBase = PROVINCIAL_AGE_AMOUNT[prov] ?? 0;
  let provAgeCredit = 0;
  if (age !== null && age >= 65 && provAgeAmountBase > 0) {
    const provAgeClawbackThreshold = PROVINCIAL_AGE_CLAWBACK[prov] ?? ageClawbackThreshold;
    const provAgeAmount = Math.max(0, provAgeAmountBase - 0.15 * Math.max(0, netTaxableIncome - provAgeClawbackThreshold));
    provAgeCredit = provAgeAmount * (provincialBrackets[0]?.rate ?? 0.0505);
  }

  // Provincial donation credit: first $200 at lowest bracket rate, above $200 at top bracket rate
  let provDonationCredit = 0;
  if (donations > 0) {
    const provLowRate = provincialBrackets[0]?.rate ?? 0.0505;
    const provHighRate = provincialBrackets[provincialBrackets.length - 1]?.rate ?? provLowRate;
    provDonationCredit = Math.min(donations, 200) * provLowRate + Math.max(0, donations - 200) * provHighRate;
  }

  const provEligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.provincialCredit;
  const provNonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.provincialCredit;

  const provincialCredits = provBPACredit + provCPPCredit + provEICredit + provEmploymentCredit + provPensionCredit + provAgeCredit + provDonationCredit + provEligibleDivCredit + provNonEligibleDivCredit;
  let provincialTaxPayable = Math.max(0, provincialTaxBeforeCredits - provincialCredits);

  // Ontario surtax
  let ontarioSurtax = 0;
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

  // --- Alternative Minimum Tax (2024 redesigned) ---
  // AMT adjusted taxable income: net taxable income + capital gains add-back
  // Under 2024 AMT: 100% CG inclusion instead of 50% (or tiered), minus $250K exemption
  // AMT rate: 20.5%, limited credits allowed (BPA only)
  const amtExemption = 173205; // 2024 basic AMT exemption
  const netGainsForAMT = Math.max(0, yd.capitalGainsRealized - yd.capitalLossApplied);
  const cgAddBack = netGainsForAMT - taxableCapitalGains; // difference between 100% and partial inclusion
  const donationAddBack = donations * 0.50; // 50% of donation add-back for AMT
  const amtAdjustedIncome = netTaxableIncome + cgAddBack + donationAddBack;
  const amtTaxableIncome = Math.max(0, amtAdjustedIncome - amtExemption);
  const amtGross = amtTaxableIncome * 0.205;
  // AMT allows only BPA credit (at 15%)
  const amtCredits = bpaCredit;
  const amtTax = Math.max(0, amtGross - amtCredits);
  const regularFederalTax = federalTaxPayable;
  const amtAdditional = Math.max(0, amtTax - regularFederalTax);
  if (amtAdditional > 0) {
    federalTaxPayable += amtAdditional;
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
    fedEmploymentCredit: fedEmploymentCredit,
    fedPensionCredit,
    fedAgeCredit,
    fedDonationCredit,
    fedEligibleDivCredit: eligibleDivCredit,
    fedNonEligibleDivCredit: nonEligibleDivCredit,
    provBPACredit: provBPACredit,
    provCPPCredit: provCPPCredit,
    provEICredit: provEICredit,
    provEmploymentCredit: provEmploymentCredit,
    provPensionCredit,
    provAgeCredit,
    provDonationCredit,
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
    quebecAbatement,
    provincialTaxBeforeCredits,
    provincialCredits,
    provincialTaxPayable,
    ontarioSurtax,
    oasClawback,
    amtTax,
    amtAdditional,
    totalIncomeTax,
    marginalFederalRate: margFed,
    marginalProvincialRate: margProv,
    marginalCombinedRate: margFed + margProv,
    avgIncomeTaxRate,
    avgAllInRate,
    detail,
  };
}
