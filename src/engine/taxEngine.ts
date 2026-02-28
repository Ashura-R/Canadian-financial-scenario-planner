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
  // LCGE: subtract qualifying small business / farm / fishing CG exemption (up to $1,016,602 in 2024)
  const lcgeClaim = yd.lcgeClaimAmount ?? 0;
  const netGains = Math.max(0, yd.capitalGainsRealized - yd.capitalLossApplied - lcgeClaim);
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

  // Net rental income (can be negative — loss reduces other income)
  const rentalNet = yd.rentalGrossIncome - yd.rentalExpenses;

  // SE net income (after expenses)
  const seNetIncome = Math.max(0, yd.selfEmploymentIncome - (yd.selfEmploymentExpenses ?? 0));

  // Total income before deductions
  // Note: rrspWithdrawal (and RRIF withdrawals), LIF withdrawals are fully taxable
  // CPP pension benefit, OAS, pension income, foreign income, rental net are also taxable
  const totalIncomeBeforeDeductions =
    yd.employmentIncome +
    seNetIncome +
    yd.rrspWithdrawal +
    yd.lifWithdrawal +
    retirementIncome.cppBenefitIncome +
    retirementIncome.oasIncome +
    grossedUpEligibleDiv +
    grossedUpNonEligibleDiv +
    yd.interestIncome +
    taxableCapitalGains +
    yd.otherTaxableIncome +
    yd.pensionIncome +
    yd.foreignIncome +
    rentalNet;

  // Net taxable income: deductions reduce taxable income
  // Union dues (line 21200), child care (line 21400), moving expenses (line 21900),
  // other deductions are all line deductions
  const unionDues = yd.unionDues ?? 0;
  const childCare = yd.childCareExpenses ?? 0;
  const movingExp = yd.movingExpenses ?? 0;
  const otherDed = yd.otherDeductions ?? 0;

  const netTaxableIncome = Math.max(
    0,
    totalIncomeBeforeDeductions
      - yd.rrspDeductionClaimed
      - yd.fhsaDeductionClaimed
      - cpp.cppSEEmployerHalfDed
      - unionDues
      - childCare
      - movingExp
      - otherDed
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
  // Eligible: RRIF withdrawals when age >= 65, LIF withdrawals when age >= 65, DB pension/annuity income
  const pensionIncomeAmount = 2000;
  let eligiblePensionIncome = yd.pensionIncome; // DB pension is always eligible
  if (age !== null && age >= 65) {
    if (isRRIF) eligiblePensionIncome += yd.rrspWithdrawal;
    eligiblePensionIncome += yd.lifWithdrawal; // LIF withdrawals eligible at 65+
  }
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

  // Disability Tax Credit (DTC) — ~$9,428 federal base (2024)
  const dtcBase = 9428;
  const fedDTCCredit = yd.disabilityTaxCredit ? dtcBase * bpaCreditRate : 0;

  // Medical expense credit: expenses above 3% of net income or $2,759 (whichever is lower)
  const medExpenses = yd.medicalExpenses ?? 0;
  let fedMedicalCredit = 0;
  if (medExpenses > 0) {
    const medThreshold = Math.min(netTaxableIncome * 0.03, 2759);
    fedMedicalCredit = Math.max(0, medExpenses - medThreshold) * bpaCreditRate;
  }

  // Student loan interest credit: 15% federal credit on interest paid on govt student loans
  const studentLoanInt = yd.studentLoanInterest ?? 0;
  const fedStudentLoanCredit = studentLoanInt * bpaCreditRate;

  // Home Buyers' Amount: $10,000 non-refundable credit ($1,500 federal credit) in purchase year
  const homeBuyersAmount = 10000;
  const fedHomeBuyersCredit = yd.homeBuyersPurchaseYear ? homeBuyersAmount * bpaCreditRate : 0;

  // Other non-refundable credits (user-entered catch-all)
  const fedOtherCredits = yd.otherNonRefundableCredits ?? 0;

  const eligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.federalCredit;
  const nonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.federalCredit;

  const federalCredits = bpaCredit + cppCredit + eiCredit + fedEmploymentCredit + fedPensionCredit + fedAgeCredit + fedDonationCredit
    + fedDTCCredit + fedMedicalCredit + fedStudentLoanCredit + fedHomeBuyersCredit + fedOtherCredits
    + eligibleDivCredit + nonEligibleDivCredit;
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

  // Provincial DTC credit (same base, provincial rate)
  const provDTCCredit = yd.disabilityTaxCredit ? dtcBase * (provincialBrackets[0]?.rate ?? 0.0505) : 0;

  // Provincial medical expense credit
  let provMedicalCredit = 0;
  if (medExpenses > 0) {
    const medThreshold = Math.min(netTaxableIncome * 0.03, 2759);
    provMedicalCredit = Math.max(0, medExpenses - medThreshold) * (provincialBrackets[0]?.rate ?? 0.0505);
  }

  // Provincial student loan interest credit
  const provStudentLoanCredit = studentLoanInt * (provincialBrackets[0]?.rate ?? 0.0505);

  // Provincial other credits
  const provOtherCredits = yd.otherNonRefundableCredits ?? 0;

  const provEligibleDivCredit = grossedUpEligibleDiv * dividendRates.eligible.provincialCredit;
  const provNonEligibleDivCredit = grossedUpNonEligibleDiv * dividendRates.nonEligible.provincialCredit;

  const provincialCredits = provBPACredit + provCPPCredit + provEICredit + provEmploymentCredit + provPensionCredit + provAgeCredit + provDonationCredit
    + provDTCCredit + provMedicalCredit + provStudentLoanCredit + provOtherCredits
    + provEligibleDivCredit + provNonEligibleDivCredit;
  let provincialTaxPayable = Math.max(0, provincialTaxBeforeCredits - provincialCredits);

  // Ontario surtax
  let ontarioSurtax = 0;
  if (prov === 'ON') {
    ontarioSurtax = 0.20 * Math.max(0, provincialTaxPayable - 4991) + 0.36 * Math.max(0, provincialTaxPayable - 6387);
    provincialTaxPayable += ontarioSurtax;
  }

  // Ontario Health Premium (introduced 2004, thresholds NOT indexed)
  let ontarioHealthPremium = 0;
  if (prov === 'ON') {
    const ti = netTaxableIncome;
    if (ti <= 20000) {
      ontarioHealthPremium = 0;
    } else if (ti <= 25000) {
      ontarioHealthPremium = 0.06 * (ti - 20000);
    } else if (ti <= 36000) {
      ontarioHealthPremium = 300;
    } else if (ti <= 38500) {
      ontarioHealthPremium = 300 + 0.06 * (ti - 36000);
    } else if (ti <= 48000) {
      ontarioHealthPremium = 450;
    } else if (ti <= 48600) {
      ontarioHealthPremium = 450 + 0.25 * (ti - 48000);
    } else if (ti <= 72000) {
      ontarioHealthPremium = 600;
    } else if (ti <= 72600) {
      ontarioHealthPremium = 600 + 0.25 * (ti - 72000);
    } else if (ti <= 200000) {
      ontarioHealthPremium = 750;
    } else if (ti <= 200600) {
      ontarioHealthPremium = 750 + 0.25 * (ti - 200000);
    } else {
      ontarioHealthPremium = 900;
    }
    ontarioHealthPremium = Math.round(ontarioHealthPremium);
    provincialTaxPayable += ontarioHealthPremium;
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

  // --- Foreign Tax Credit (FTC) ---
  let fedForeignTaxCredit = 0;
  let provForeignTaxCredit = 0;
  if (yd.foreignTaxPaid > 0 && yd.foreignIncome > 0 && netTaxableIncome > 0) {
    const foreignIncomeRatio = Math.min(1, yd.foreignIncome / netTaxableIncome);
    fedForeignTaxCredit = Math.min(yd.foreignTaxPaid, federalTaxPayable * foreignIncomeRatio);
    federalTaxPayable = Math.max(0, federalTaxPayable - fedForeignTaxCredit);
    provForeignTaxCredit = Math.min(
      Math.max(0, yd.foreignTaxPaid - fedForeignTaxCredit),
      provincialTaxPayable * foreignIncomeRatio
    );
    provincialTaxPayable = Math.max(0, provincialTaxPayable - provForeignTaxCredit);
  }
  const foreignTaxCredit = fedForeignTaxCredit + provForeignTaxCredit;

  // --- Canada Workers Benefit (CWB) — refundable credit ---
  // Single: phase-in from $3,000 earned income at 27%, phase-out from $23,495 at 15%
  // Max CWB ~$1,518 for singles (2024). We use single rates; spousal would need task 6.1
  let cwbCredit = 0;
  const earnedIncome = yd.employmentIncome + seNetIncome;
  if (earnedIncome > 3000 && netTaxableIncome < 33015) {
    const cwbPhaseIn = (earnedIncome - 3000) * 0.27;
    const cwbMax = 1518;
    const cwbBase = Math.min(cwbPhaseIn, cwbMax);
    const cwbPhaseOut = netTaxableIncome > 23495 ? (netTaxableIncome - 23495) * 0.15 : 0;
    cwbCredit = Math.max(0, cwbBase - cwbPhaseOut);
  }

  const totalIncomeTax = Math.max(0, federalTaxPayable + provincialTaxPayable - cwbCredit);

  // Gross income for rate calculations (pre-gross-up, pre-deductions)
  const rentalNetForGross = yd.rentalGrossIncome - yd.rentalExpenses;
  const grossIncome =
    yd.employmentIncome + seNetIncome +
    yd.rrspWithdrawal + yd.lifWithdrawal +
    retirementIncome.cppBenefitIncome + retirementIncome.oasIncome +
    yd.eligibleDividends + yd.nonEligibleDividends +
    yd.interestIncome + yd.capitalGainsRealized + yd.otherTaxableIncome +
    yd.pensionIncome + yd.foreignIncome + rentalNetForGross;

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
    fedForeignTaxCredit,
    provForeignTaxCredit,
    fedDTCCredit,
    provDTCCredit,
    fedMedicalCredit,
    provMedicalCredit,
    fedStudentLoanCredit,
    provStudentLoanCredit,
    fedHomeBuyersCredit,
    fedOtherCredits,
    provOtherCredits,
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
    ontarioHealthPremium,
    oasClawback,
    foreignTaxCredit,
    cwbCredit,
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
