import type { Assumptions, YearData, Scenario } from '../types/scenario';

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  province: 'ON',
  startYear: 2026,
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
      provincialCredit: 0.029863,  // Ontario 2026 (corrected from 0.036)
    },
  },
  cpp: {
    basicExemption: 3500,
    ympe: 74600,
    yampe: 85000,
    employeeRate: 0.0595,
    cpp2Rate: 0.04,
    seDeductionFactor: 0.5,
  },
  ei: {
    maxInsurableEarnings: 68900,
    employeeRate: 0.0163,
    seOptIn: false,
  },
  federalBrackets: [
    { min: 0, max: 58523, rate: 0.14 },
    { min: 58523, max: 117045, rate: 0.205 },
    { min: 117045, max: 181440, rate: 0.26 },
    { min: 181440, max: 258482, rate: 0.29 },
    { min: 258482, max: null, rate: 0.33 },
  ],
  provincialBrackets: [
    // Ontario 2026
    { min: 0, max: 53891, rate: 0.0505 },
    { min: 53891, max: 107785, rate: 0.0915 },
    { min: 107785, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: null, rate: 0.1316 },
  ],
  federalBPA: 16452,
  provincialBPA: 12989,
  // Asset returns default to 0 — user sets these based on their own projections
  assetReturns: {
    equity: 0,
    fixedIncome: 0,
    cash: 0,
    savings: 0,
  },
  federalEmploymentAmount: 1501,
  rrspLimit: 33810,
  rrspPctEarnedIncome: 0.18,
  tfsaAnnualLimit: 7000,
  fhsaAnnualLimit: 8000,
  fhsaLifetimeLimit: 40000,
  autoIndexAssumptions: true,
  birthYear: 1990,
  oasClawbackThreshold: 93454,
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
    rentalGrossIncome: 0,
    rentalExpenses: 0,
    pensionIncome: 0,
    foreignIncome: 0,
    foreignTaxPaid: 0,
    selfEmploymentExpenses: 0,
    childCareExpenses: 0,
    medicalExpenses: 0,
    unionDues: 0,
    studentLoanInterest: 0,
    movingExpenses: 0,
    disabilityTaxCredit: false,
    otherDeductions: 0,
    otherNonRefundableCredits: 0,
    homeBuyersPurchaseYear: false,
    lcgeClaimAmount: 0,
    housingExpense: 0,
    groceriesExpense: 0,
    transportationExpense: 0,
    utilitiesExpense: 0,
    insuranceExpense: 0,
    entertainmentExpense: 0,
    personalExpense: 0,
    otherLivingExpense: 0,
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
    lifWithdrawal: 0,
    respContribution: 0,
    respWithdrawal: 0,
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
    liraEquityPct: 1,
    liraFixedPct: 0,
    liraCashPct: 0,
    respEquityPct: 1,
    respFixedPct: 0,
    respCashPct: 0,
    liPremium: 0,
    liCOI: 0,
    liWithdrawal: 0,
    liDeathBenefit: 0,
    liEquityPct: 0,
    liFixedPct: 1,
    liCashPct: 0,
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
    openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
    openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
    years,
  };
}

// Province-specific bracket presets (2026 values)
export const PROVINCIAL_BRACKETS: Record<string, Assumptions['provincialBrackets']> = {
  ON: [
    { min: 0, max: 53891, rate: 0.0505 },
    { min: 53891, max: 107785, rate: 0.0915 },
    { min: 107785, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: null, rate: 0.1316 },
  ],
  BC: [
    { min: 0, max: 50363, rate: 0.056 },
    { min: 50363, max: 100728, rate: 0.077 },
    { min: 100728, max: 115648, rate: 0.105 },
    { min: 115648, max: 140430, rate: 0.1229 },
    { min: 140430, max: 190405, rate: 0.147 },
    { min: 190405, max: 265545, rate: 0.168 },
    { min: 265545, max: null, rate: 0.205 },
  ],
  AB: [
    { min: 0, max: 61200, rate: 0.08 },
    { min: 61200, max: 154259, rate: 0.10 },
    { min: 154259, max: 185111, rate: 0.12 },
    { min: 185111, max: 246813, rate: 0.13 },
    { min: 246813, max: 370220, rate: 0.14 },
    { min: 370220, max: null, rate: 0.15 },
  ],
  QC: [
    { min: 0, max: 54345, rate: 0.14 },
    { min: 54345, max: 108680, rate: 0.19 },
    { min: 108680, max: 132245, rate: 0.24 },
    { min: 132245, max: null, rate: 0.2575 },
  ],
  MB: [
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: null, rate: 0.174 },
  ],
  SK: [
    { min: 0, max: 54532, rate: 0.105 },
    { min: 54532, max: 155805, rate: 0.125 },
    { min: 155805, max: null, rate: 0.145 },
  ],
  NS: [
    { min: 0, max: 30995, rate: 0.0879 },
    { min: 30995, max: 61991, rate: 0.1495 },
    { min: 61991, max: 97417, rate: 0.1667 },
    { min: 97417, max: 157124, rate: 0.175 },
    { min: 157124, max: null, rate: 0.21 },
  ],
  NB: [
    { min: 0, max: 52333, rate: 0.094 },
    { min: 52333, max: 104666, rate: 0.14 },
    { min: 104666, max: 193861, rate: 0.16 },
    { min: 193861, max: null, rate: 0.195 },
  ],
  NL: [
    { min: 0, max: 44678, rate: 0.087 },
    { min: 44678, max: 89354, rate: 0.145 },
    { min: 89354, max: 159528, rate: 0.158 },
    { min: 159528, max: 223340, rate: 0.178 },
    { min: 223340, max: 285319, rate: 0.198 },
    { min: 285319, max: 570638, rate: 0.208 },
    { min: 570638, max: 1141275, rate: 0.213 },
    { min: 1141275, max: null, rate: 0.218 },
  ],
  PE: [
    { min: 0, max: 33928, rate: 0.095 },
    { min: 33928, max: 65820, rate: 0.1347 },
    { min: 65820, max: 106890, rate: 0.166 },
    { min: 106890, max: 142250, rate: 0.1762 },
    { min: 142250, max: null, rate: 0.19 },
  ],
  NT: [
    { min: 0, max: 53003, rate: 0.059 },
    { min: 53003, max: 106009, rate: 0.086 },
    { min: 106009, max: 172346, rate: 0.122 },
    { min: 172346, max: null, rate: 0.1405 },
  ],
  NU: [
    { min: 0, max: 55801, rate: 0.04 },
    { min: 55801, max: 111602, rate: 0.07 },
    { min: 111602, max: 181439, rate: 0.09 },
    { min: 181439, max: null, rate: 0.115 },
  ],
  YT: [
    { min: 0, max: 58523, rate: 0.064 },
    { min: 58523, max: 117045, rate: 0.09 },
    { min: 117045, max: 181440, rate: 0.109 },
    { min: 181440, max: 258482, rate: 0.1293 },
    { min: 258482, max: 500000, rate: 0.128 },
    { min: 500000, max: null, rate: 0.15 },
  ],
};

// Provincial BPA (2026 values)
export const PROVINCIAL_BPA: Record<string, number> = {
  ON: 12989, BC: 13216, AB: 22769, QC: 18952, MB: 15780,
  SK: 20381, NS: 11932, NB: 13664, NL: 11188, PE: 15000,
  NT: 18198, NU: 19659, YT: 16452,
};

// Provincial employment amount (federal-only credit; only YT mirrors it)
export const PROVINCIAL_EMPLOYMENT_AMOUNT: Record<string, number> = {
  ON: 0, BC: 0, AB: 0, QC: 0, MB: 0, SK: 0,
  NS: 0, NB: 0, NL: 0, PE: 0, NT: 0, NU: 0, YT: 1501,
};

// Provincial age amount (2026 values)
export const PROVINCIAL_AGE_AMOUNT: Record<string, number> = {
  ON: 6342, BC: 5927, AB: 6345, QC: 3986, MB: 3728,
  SK: 5901, NS: 5826, NB: 6158, NL: 7142, PE: 6510,
  NT: 8902, NU: 12550, YT: 9208,
};

// Provincial age amount clawback threshold (2026 values)
export const PROVINCIAL_AGE_CLAWBACK: Record<string, number> = {
  ON: 47210, BC: 44119, AB: 47234, QC: 42955, MB: 27749,
  SK: 43927, NS: 30828, NB: 45844, NL: 39138, PE: 36600,
  NT: 46432, NU: 46432, YT: 46432,
};

// Provincial dividend credits (2026 values)
export const PROVINCIAL_DIV_CREDITS: Record<string, { eligibleProvCredit: number; nonEligibleProvCredit: number }> = {
  ON: { eligibleProvCredit: 0.100, nonEligibleProvCredit: 0.029863 },
  BC: { eligibleProvCredit: 0.12, nonEligibleProvCredit: 0.0196 },
  AB: { eligibleProvCredit: 0.0812, nonEligibleProvCredit: 0.0218 },
  QC: { eligibleProvCredit: 0.117, nonEligibleProvCredit: 0.0342 },
  MB: { eligibleProvCredit: 0.08, nonEligibleProvCredit: 0.007835 },
  SK: { eligibleProvCredit: 0.11, nonEligibleProvCredit: 0.02519 },
  NS: { eligibleProvCredit: 0.0885, nonEligibleProvCredit: 0.015 },
  NB: { eligibleProvCredit: 0.14, nonEligibleProvCredit: 0.0275 },
  NL: { eligibleProvCredit: 0.063, nonEligibleProvCredit: 0.032 },
  PE: { eligibleProvCredit: 0.105, nonEligibleProvCredit: 0.013 },
  NT: { eligibleProvCredit: 0.115, nonEligibleProvCredit: 0.06 },
  NU: { eligibleProvCredit: 0.0551, nonEligibleProvCredit: 0.0261 },
  YT: { eligibleProvCredit: 0.1202, nonEligibleProvCredit: 0.0067 },
};
