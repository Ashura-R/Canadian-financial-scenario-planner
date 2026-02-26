export interface BracketDetail {
  min: number;
  max: number | null;
  rate: number;
  incomeInBracket: number;
  taxInBracket: number;
}

export interface ComputedTaxDetail {
  fedBPACredit: number;
  fedCPPCredit: number;
  fedEICredit: number;
  fedEmploymentCredit: number;
  fedPensionCredit: number;
  fedAgeCredit: number;
  fedDonationCredit: number;
  fedEligibleDivCredit: number;
  fedNonEligibleDivCredit: number;
  provBPACredit: number;
  provCPPCredit: number;
  provEICredit: number;
  provEmploymentCredit: number;
  provPensionCredit: number;
  provAgeCredit: number;
  provDonationCredit: number;
  provEligibleDivCredit: number;
  provNonEligibleDivCredit: number;
  fedForeignTaxCredit: number;
  provForeignTaxCredit: number;
  federalBracketDetail: BracketDetail[];
  provincialBracketDetail: BracketDetail[];
}

export interface ComputedCPP {
  pensionableEarnings: number;
  cppEmployee: number;
  cpp2Employee: number;
  cppSE: number;
  cpp2SE: number;
  cppSEEmployerHalfDed: number;
  totalCPPForCredit: number;
  totalCPPPaid: number;
}

export interface ComputedEI {
  eiEmployment: number;
  eiSE: number;
  totalEI: number;
}

export interface ComputedTax {
  grossedUpEligibleDiv: number;
  grossedUpNonEligibleDiv: number;
  taxableCapitalGains: number;
  totalIncomeBeforeDeductions: number;
  netTaxableIncome: number;
  federalTaxBeforeCredits: number;
  federalCredits: number;
  federalTaxPayable: number;
  quebecAbatement: number;
  provincialTaxBeforeCredits: number;
  provincialCredits: number;
  provincialTaxPayable: number;
  ontarioSurtax: number;
  oasClawback: number;
  foreignTaxCredit: number;          // total FTC claimed (federal + provincial)
  amtTax: number;                  // AMT computed tax (0 if AMT doesn't apply)
  amtAdditional: number;           // AMT amount added (AMT - regular tax, if positive)
  totalIncomeTax: number;
  marginalFederalRate: number;
  marginalProvincialRate: number;
  marginalCombinedRate: number;
  avgIncomeTaxRate: number;
  avgAllInRate: number;
}

export interface ComputedAccounts {
  rrspReturn: number;
  tfsaReturn: number;
  fhsaReturn: number;
  nonRegReturn: number;
  savingsReturn: number;
  liraReturn: number;
  respReturn: number;
  rrspEOY: number;
  tfsaEOY: number;
  fhsaEOY: number;
  nonRegEOY: number;
  savingsEOY: number;
  liraEOY: number;
  respEOY: number;
  netWorth: number;
}

export interface ComputedWaterfall {
  grossIncome: number;
  afterRRSPDed: number;
  afterFHSADed: number;
  afterCPPSEHalf: number;
  afterCapLoss: number;
  netTaxableIncome: number;
  afterFederalTax: number;
  afterProvincialTax: number;
  afterCPPEI: number;
  afterTaxIncome: number;
  netCashFlow: number;
}

export interface ComputedRetirement {
  age: number | null;       // null if birthYear not set
  cppIncome: number;        // CPP pension benefit this year (0 if not yet receiving)
  oasIncome: number;        // OAS benefit this year (0 if not yet receiving)
  isRRIF: boolean;          // true once RRSP has converted to RRIF
  rrifMinWithdrawal: number; // CRA minimum withdrawal amount (0 if not RRIF yet)
  isLIF: boolean;            // true once LIRA has converted to LIF
  lifMinWithdrawal: number;  // minimum withdrawal (same as RRIF factors)
  lifMaxWithdrawal: number;  // maximum withdrawal (federal formula)
}

export interface ComputedACB {
  openingACB: number;
  acbAdded: number;              // contributions (purchases at cost)
  acbRemoved: number;            // proportional ACB on withdrawals
  closingACB: number;
  perUnitACB: number;            // closingACB / nonRegEOY (0 if no balance)
  computedCapitalGain: number;   // proceeds - proportional ACB
  dispositionProceeds: number;
}

export interface ComputedLiability {
  id: string;
  label: string;
  openingBalance: number;
  interestPaid: number;
  principalPaid: number;
  totalPayment: number;
  closingBalance: number;
}

export interface ComputedYear {
  year: number;
  cpp: ComputedCPP;
  ei: ComputedEI;
  tax: ComputedTax;
  taxDetail: ComputedTaxDetail;
  accounts: ComputedAccounts;
  waterfall: ComputedWaterfall;
  retirement: ComputedRetirement;
  // Inflation-adjusted (real) values
  inflationFactor: number;
  realGrossIncome: number;
  realAfterTaxIncome: number;
  realNetWorth: number;
  realNetCashFlow: number;
  // TFSA room tracking
  tfsaUnusedRoom: number;
  tfsaRoomGenerated: number;
  // Carry-forward state (end of year)
  capitalLossCF: number;
  rrspUnusedRoom: number;
  fhsaContribLifetime: number;
  fhsaUnusedRoom: number;
  // ACB tracking (optional)
  acb?: ComputedACB;
  // Liability tracking (optional)
  liabilities?: ComputedLiability[];
  totalDebt?: number;             // sum of all closing balances
  totalDebtPayment?: number;      // sum of all payments this year
  totalInterestPaid?: number;     // sum of all interest this year
  deductibleInterest?: number;    // interest on investment loans (tax-deductible)
  // HBP tracking (optional)
  hbpBalance?: number;           // remaining HBP repayment balance (0 if no HBP)
  hbpRepaymentRequired?: number; // annual required repayment (1/15 of original)
  hbpRepaymentMade?: number;     // actual repayment (from RRSP contribution)
  hbpTaxableShortfall?: number;  // shortfall added to taxable income
  // RESP CESG tracking
  respCESG?: number;              // CESG grant received this year
  respGrantsLifetime?: number;    // cumulative lifetime CESG
  // Warnings
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ComputedAnalytics {
  lifetimeGrossIncome: number;
  lifetimeTotalTax: number;
  lifetimeCPPEI: number;
  lifetimeAfterTaxIncome: number;
  lifetimeAvgTaxRate: number;
  lifetimeAvgAllInRate: number;
  lifetimeCashFlow: number;
  cumulativeCashFlow: number[];
  annualCashFlow: number[];
  cumulativeGrossIncome: number[];
  cumulativeAfterTaxIncome: number[];
  cumulativeTotalTax: number[];
  cumulativeRealCashFlow: number[];
}

export interface ComputedScenario {
  scenarioId: string;
  years: ComputedYear[];
  analytics: ComputedAnalytics;
}
