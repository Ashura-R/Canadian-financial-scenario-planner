export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

// Conditional scheduling
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'between';
export type ConditionField =
  | 'grossIncome' | 'netTaxableIncome' | 'afterTaxIncome' | 'netCashFlow'
  | 'netWorth' | 'totalIncomeTax' | 'employmentIncome' | 'selfEmploymentIncome'
  | 'rrspEOY' | 'tfsaEOY' | 'fhsaEOY' | 'nonRegEOY' | 'savingsEOY'
  | 'rrspUnusedRoom' | 'tfsaUnusedRoom'
  | 'capitalGainsRealized' | 'capitalLossCF'
  | 'age';

// Reference fields for percentage-based scheduled amounts
export type AmountReference = ConditionField;

// Dynamic max cap references — cap amount to a computed limit
export type AmountMaxReference =
  | 'rrspRoom'        // available RRSP contribution room
  | 'tfsaRoom'        // available TFSA contribution room
  | 'fhsaRoom'        // available FHSA contribution room (annual + carry-forward)
  | 'fhsaLifetimeRoom' // remaining FHSA lifetime room
  | 'rrspBalance'     // current RRSP balance (for withdrawals)
  | 'tfsaBalance'     // current TFSA balance (for withdrawals)
  | 'fhsaBalance'     // current FHSA balance (for withdrawals)
  | 'nonRegBalance'   // current Non-Reg balance (for withdrawals)
  | 'savingsBalance'  // current Savings balance (for withdrawals)
  | 'capitalLossCF';  // available capital loss carry-forward

export interface ScheduleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number;
  value2?: number; // for 'between'
}

// FHSA disposition
export type FHSADisposition = 'active' | 'home-purchase' | 'transfer-rrsp' | 'taxable-close';

export interface TaxBracket {
  min: number;
  max: number | null; // null = no upper limit
  rate: number;       // e.g. 0.15 for 15%
}

export interface DivRate {
  grossUp: number;        // e.g. 0.38 for eligible
  federalCredit: number;  // as % of grossed-up amount, e.g. 0.150198
  provincialCredit: number;
}

export interface CPPParams {
  basicExemption: number;
  ympe: number;
  yampe: number;
  employeeRate: number;   // CPP1 employee rate, e.g. 0.0595
  cpp2Rate: number;       // CPP2 rate on YAMPE excess, e.g. 0.04
  seDeductionFactor: number; // typically 0.5 (employer half deductible)
}

export interface EIParams {
  maxInsurableEarnings: number;
  employeeRate: number;   // e.g. 0.0166
  seOptIn: boolean;
}

export interface RetirementBenefit {
  enabled: boolean;
  monthlyAmount: number;  // in today's dollars
  startAge: number;       // age to begin receiving benefit
}

export interface Assumptions {
  province: Province;
  startYear: number;
  numYears: number;
  inflationRate: number;
  capitalGainsInclusionRate: number;
  cgInclusionTiered?: boolean;           // enable post-June 2024 two-tier system
  cgInclusionTier1Rate?: number;         // rate on first tranche (default 0.5)
  cgInclusionTier2Rate?: number;         // rate above threshold (default 2/3)
  cgInclusionThreshold?: number;         // individual threshold (default 250000)
  dividendRates: {
    eligible: DivRate;
    nonEligible: DivRate;
  };
  cpp: CPPParams;
  ei: EIParams;
  federalBrackets: TaxBracket[];
  provincialBrackets: TaxBracket[];
  federalBPA: number;
  provincialBPA: number;
  federalEmploymentAmount: number;
  assetReturns: {
    equity: number;
    fixedIncome: number;
    cash: number;
    savings: number;
  };
  rrspLimit: number;
  rrspPctEarnedIncome: number;
  tfsaAnnualLimit: number;
  fhsaAnnualLimit: number;
  fhsaLifetimeLimit: number;
  // Retirement settings
  birthYear?: number;       // e.g. 1985, used to compute age per year
  retirement?: {
    cppBenefit: RetirementBenefit;
    oasBenefit: RetirementBenefit;
    rrifConversionAge: number;  // default 71; RRSP must convert to RRIF by year-end of this age
  };
  // FHSA disposition
  fhsa?: {
    disposition: FHSADisposition;
    dispositionYear?: number;
  };
  // OAS clawback
  oasClawbackThreshold?: number; // default 86912
}

// Fields that can be targeted by a scheduled item
export type ScheduledField =
  | 'employmentIncome'
  | 'selfEmploymentIncome'
  | 'eligibleDividends'
  | 'nonEligibleDividends'
  | 'interestIncome'
  | 'capitalGainsRealized'
  | 'capitalLossesRealized'
  | 'otherTaxableIncome'
  | 'charitableDonations'
  | 'rrspContribution'
  | 'rrspDeductionClaimed'
  | 'tfsaContribution'
  | 'fhsaContribution'
  | 'fhsaDeductionClaimed'
  | 'nonRegContribution'
  | 'rrspWithdrawal'
  | 'tfsaWithdrawal'
  | 'fhsaWithdrawal'
  | 'nonRegWithdrawal'
  | 'savingsDeposit'
  | 'savingsWithdrawal'
  | 'capitalLossApplied'
  | 'rrspEquityPct' | 'rrspFixedPct' | 'rrspCashPct'
  | 'tfsaEquityPct' | 'tfsaFixedPct' | 'tfsaCashPct'
  | 'fhsaEquityPct' | 'fhsaFixedPct' | 'fhsaCashPct'
  | 'nonRegEquityPct' | 'nonRegFixedPct' | 'nonRegCashPct';

export interface ScheduledItem {
  id: string;
  label: string;
  field: ScheduledField;
  startYear: number;
  endYear?: number;   // undefined = indefinite
  amount: number;     // dollar amount when 'fixed', decimal percentage when 'percentage' (0.10 = 10%)
  amountType?: 'fixed' | 'percentage';    // default 'fixed'
  amountReference?: AmountReference;       // reference field for percentage mode
  amountMin?: number;                      // floor on computed amount (optional)
  amountMax?: number;                      // cap on computed amount (optional)
  amountMaxRef?: AmountMaxReference;       // dynamic cap from computed limit (optional)
  conditions?: ScheduleCondition[];
  growthRate?: number;             // annual % increase on base amount (or on the percentage itself)
  growthType?: 'fixed' | 'inflation'; // grow by growthRate or by assumption's inflation rate
}

export interface YearData {
  year: number;
  // Income
  employmentIncome: number;
  selfEmploymentIncome: number;
  eligibleDividends: number;
  nonEligibleDividends: number;
  interestIncome: number;
  capitalGainsRealized: number;
  capitalLossesRealized: number;
  otherTaxableIncome: number;
  charitableDonations: number;
  // Account contributions
  rrspContribution: number;
  rrspDeductionClaimed: number;
  tfsaContribution: number;
  fhsaContribution: number;
  fhsaDeductionClaimed: number;
  nonRegContribution: number;
  // Account withdrawals
  rrspWithdrawal: number;
  tfsaWithdrawal: number;
  fhsaWithdrawal: number;
  nonRegWithdrawal: number;
  savingsDeposit: number;
  savingsWithdrawal: number;
  // Asset allocation (each group sums to 1.0)
  rrspEquityPct: number;
  rrspFixedPct: number;
  rrspCashPct: number;
  tfsaEquityPct: number;
  tfsaFixedPct: number;
  tfsaCashPct: number;
  fhsaEquityPct: number;
  fhsaFixedPct: number;
  fhsaCashPct: number;
  nonRegEquityPct: number;
  nonRegFixedPct: number;
  nonRegCashPct: number;
  // Optional decisions
  capitalLossApplied: number;
  // EOY overrides (optional)
  rrspEOYOverride?: number;
  tfsaEOYOverride?: number;
  fhsaEOYOverride?: number;
  nonRegEOYOverride?: number;
  savingsEOYOverride?: number;
  // Per-year rate overrides (optional)
  inflationRateOverride?: number;
  equityReturnOverride?: number;
  fixedIncomeReturnOverride?: number;
  cashReturnOverride?: number;
  savingsReturnOverride?: number;
}

export interface OpeningBalances {
  rrsp: number;
  tfsa: number;
  fhsa: number;
  nonReg: number;
  savings: number;
}

export interface OpeningCarryForwards {
  rrspUnusedRoom: number;    // carry-forward from prior years
  tfsaUnusedRoom: number;    // cumulative unused TFSA room
  capitalLossCF: number;     // net capital losses from prior years
  fhsaContribLifetime: number; // lifetime FHSA contributions made before start year
  priorYearEarnedIncome?: number; // prior-year earned income for year-1 RRSP room calculation
}

export interface ACBConfig {
  openingACB?: number;           // defaults to opening nonReg balance
  autoComputeGains?: boolean;    // replace manual CG with ACB-computed
}

export interface Scenario {
  id: string;
  name: string;
  assumptions: Assumptions;
  openingBalances: OpeningBalances;
  openingCarryForwards?: OpeningCarryForwards;
  years: YearData[];
  scheduledItems?: ScheduledItem[];
  acbConfig?: ACBConfig;
}
