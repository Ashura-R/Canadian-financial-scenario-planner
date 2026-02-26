import type { Assumptions, YearData, Scenario } from '../types/scenario';

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  province: 'ON',
  startYear: 2025,
  numYears: 40,
  inflationRate: 0.025,
  capitalGainsInclusionRate: 0.5,
  dividendRates: {
    eligible: {
      grossUp: 0.38,
      federalCredit: 0.150198,
      provincialCredit: 0.100, // Ontario
    },
    nonEligible: {
      grossUp: 0.15,
      federalCredit: 0.090301,
      provincialCredit: 0.036,  // Ontario
    },
  },
  cpp: {
    basicExemption: 3500,
    ympe: 68500,
    yampe: 73200,
    employeeRate: 0.0595,
    cpp2Rate: 0.04,
    seDeductionFactor: 0.5,
  },
  ei: {
    maxInsurableEarnings: 63200,
    employeeRate: 0.0166,
    seOptIn: false,
  },
  federalBrackets: [
    { min: 0, max: 57375, rate: 0.15 },
    { min: 57375, max: 114750, rate: 0.205 },
    { min: 114750, max: 158519, rate: 0.26 },
    { min: 158519, max: 220000, rate: 0.29 },
    { min: 220000, max: null, rate: 0.33 },
  ],
  provincialBrackets: [
    // Ontario 2024
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: null, rate: 0.1316 },
  ],
  federalBPA: 15705,
  provincialBPA: 11865,
  // Asset returns default to 0 — user sets these based on their own projections
  assetReturns: {
    equity: 0,
    fixedIncome: 0,
    cash: 0,
    savings: 0,
  },
  federalEmploymentAmount: 1368,
  rrspLimit: 31560,
  rrspPctEarnedIncome: 0.18,
  tfsaAnnualLimit: 7000,
  fhsaAnnualLimit: 8000,
  fhsaLifetimeLimit: 40000,
  birthYear: 1990,
  retirement: {
    cppBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 },
    oasBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 },
    rrifConversionAge: 71,
  },
};

export function makeDefaultYear(year: number): YearData {
  return {
    year,
    // All income and contribution fields default to 0 — user enters their own values
    employmentIncome: 0,
    selfEmploymentIncome: 0,
    eligibleDividends: 0,
    nonEligibleDividends: 0,
    interestIncome: 0,
    capitalGainsRealized: 0,
    capitalLossesRealized: 0,
    otherTaxableIncome: 0,
    charitableDonations: 0,
    rrspContribution: 0,
    rrspDeductionClaimed: 0,
    tfsaContribution: 0,
    fhsaContribution: 0,
    fhsaDeductionClaimed: 0,
    nonRegContribution: 0,
    rrspWithdrawal: 0,
    tfsaWithdrawal: 0,
    fhsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    savingsDeposit: 0,
    savingsWithdrawal: 0,
    rrspEquityPct: 1,
    rrspFixedPct: 0,
    rrspCashPct: 0,
    tfsaEquityPct: 1,
    tfsaFixedPct: 0,
    tfsaCashPct: 0,
    fhsaEquityPct: 1,
    fhsaFixedPct: 0,
    fhsaCashPct: 0,
    nonRegEquityPct: 1,
    nonRegFixedPct: 0,
    nonRegCashPct: 0,
    capitalLossApplied: 0,
  };
}

export function makeDefaultScenario(name = 'Scenario 1'): Scenario {
  const ass = { ...DEFAULT_ASSUMPTIONS };
  const years: YearData[] = [];
  for (let i = 0; i < ass.numYears; i++) {
    years.push(makeDefaultYear(ass.startYear + i));
  }
  return {
    id: crypto.randomUUID(),
    name,
    assumptions: ass,
    // Opening balances default to 0 — user enters their own values
    openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0 },
    openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
    years,
  };
}

// Province-specific bracket presets
export const PROVINCIAL_BRACKETS: Record<string, Assumptions['provincialBrackets']> = {
  ON: [
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: null, rate: 0.1316 },
  ],
  BC: [
    { min: 0, max: 45654, rate: 0.0506 },
    { min: 45654, max: 91310, rate: 0.077 },
    { min: 91310, max: 104835, rate: 0.105 },
    { min: 104835, max: 127299, rate: 0.1229 },
    { min: 127299, max: null, rate: 0.205 },
  ],
  AB: [
    { min: 0, max: 148269, rate: 0.10 },
    { min: 148269, max: 177922, rate: 0.12 },
    { min: 177922, max: 237230, rate: 0.13 },
    { min: 237230, max: 355845, rate: 0.14 },
    { min: 355845, max: null, rate: 0.15 },
  ],
  QC: [
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, max: 200000, rate: 0.2575 },
    { min: 200000, max: null, rate: 0.2575 },
  ],
  MB: [
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: 200000, rate: 0.174 },
    { min: 200000, max: null, rate: 0.174 },
  ],
  SK: [
    { min: 0, max: 49720, rate: 0.105 },
    { min: 49720, max: 142058, rate: 0.125 },
    { min: 142058, max: null, rate: 0.145 },
  ],
  NS: [
    { min: 0, max: 29590, rate: 0.0879 },
    { min: 29590, max: 59180, rate: 0.1495 },
    { min: 59180, max: 93000, rate: 0.1667 },
    { min: 93000, max: 150000, rate: 0.175 },
    { min: 150000, max: null, rate: 0.21 },
  ],
  NB: [
    { min: 0, max: 49958, rate: 0.094 },
    { min: 49958, max: 99916, rate: 0.14 },
    { min: 99916, max: 185064, rate: 0.16 },
    { min: 185064, max: null, rate: 0.195 },
  ],
  NL: [
    { min: 0, max: 43198, rate: 0.087 },
    { min: 43198, max: 86395, rate: 0.145 },
    { min: 86395, max: 154244, rate: 0.158 },
    { min: 154244, max: 215943, rate: 0.178 },
    { min: 215943, max: null, rate: 0.198 },
  ],
  PE: [
    { min: 0, max: 32656, rate: 0.0965 },
    { min: 32656, max: 64313, rate: 0.1363 },
    { min: 64313, max: 105000, rate: 0.1665 },
    { min: 105000, max: 140000, rate: 0.18 },
    { min: 140000, max: null, rate: 0.1875 },
  ],
  NT: [
    { min: 0, max: 50597, rate: 0.059 },
    { min: 50597, max: 101198, rate: 0.086 },
    { min: 101198, max: 164525, rate: 0.122 },
    { min: 164525, max: null, rate: 0.1405 },
  ],
  NU: [
    { min: 0, max: 53268, rate: 0.04 },
    { min: 53268, max: 106537, rate: 0.07 },
    { min: 106537, max: 173205, rate: 0.09 },
    { min: 173205, max: null, rate: 0.115 },
  ],
  YT: [
    { min: 0, max: 57375, rate: 0.064 },
    { min: 57375, max: 114750, rate: 0.09 },
    { min: 114750, max: 158519, rate: 0.109 },
    { min: 158519, max: 500000, rate: 0.128 },
    { min: 500000, max: null, rate: 0.15 },
  ],
};

export const PROVINCIAL_BPA: Record<string, number> = {
  ON: 11865, BC: 11981, AB: 21003, QC: 17183, MB: 15780,
  SK: 17661, NS: 8481, NB: 12458, NL: 10818, PE: 12000,
  NT: 16593, NU: 17925, YT: 15705,
};

export const PROVINCIAL_EMPLOYMENT_AMOUNT: Record<string, number> = {
  ON: 1368, BC: 1000, AB: 1368, QC: 0, MB: 1368, SK: 1368,
  NS: 1368, NB: 1368, NL: 1368, PE: 1368, NT: 1368, NU: 1368, YT: 1368,
};

// Provincial age amount (2024 values)
export const PROVINCIAL_AGE_AMOUNT: Record<string, number> = {
  ON: 5610, BC: 5591, AB: 5397, QC: 3574, MB: 3728,
  SK: 5397, NS: 4141, NB: 5397, NL: 5397, PE: 4141,
  NT: 7898, NU: 13555, YT: 8396,
};

// Provincial age amount clawback threshold (2024 values)
export const PROVINCIAL_AGE_CLAWBACK: Record<string, number> = {
  ON: 42335, BC: 39784, AB: 42335, QC: 37680, MB: 27749,
  SK: 42335, NS: 24950, NB: 42335, NL: 42335, PE: 27749,
  NT: 42335, NU: 42335, YT: 42335,
};

export const PROVINCIAL_DIV_CREDITS: Record<string, { eligibleProvCredit: number; nonEligibleProvCredit: number }> = {
  ON: { eligibleProvCredit: 0.100, nonEligibleProvCredit: 0.036 },
  BC: { eligibleProvCredit: 0.12, nonEligibleProvCredit: 0.02 },
  AB: { eligibleProvCredit: 0.10, nonEligibleProvCredit: 0.0234 },
  QC: { eligibleProvCredit: 0.0977, nonEligibleProvCredit: 0.055 },
  MB: { eligibleProvCredit: 0.08, nonEligibleProvCredit: 0.0263 },
  SK: { eligibleProvCredit: 0.11, nonEligibleProvCredit: 0.0334 },
  NS: { eligibleProvCredit: 0.0885, nonEligibleProvCredit: 0.035 },
  NB: { eligibleProvCredit: 0.105, nonEligibleProvCredit: 0.04 },
  NL: { eligibleProvCredit: 0.05, nonEligibleProvCredit: 0.03 },
  PE: { eligibleProvCredit: 0.105, nonEligibleProvCredit: 0.04 },
  NT: { eligibleProvCredit: 0.06, nonEligibleProvCredit: 0.02 },
  NU: { eligibleProvCredit: 0.04, nonEligibleProvCredit: 0.02 },
  YT: { eligibleProvCredit: 0.064, nonEligibleProvCredit: 0.02 },
};
