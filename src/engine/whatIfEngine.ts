import type { Scenario, TaxBracket, YearData, AssumptionOverrides } from '../types/scenario';
import { HISTORICAL_ASSUMPTIONS } from '../data/historicalAssumptions';

export interface WhatIfAdjustments {
  // Market & Macro (deltas)
  inflationAdj: number;
  equityReturnAdj: number;
  fixedIncomeReturnAdj: number;
  cashReturnAdj: number;
  savingsReturnAdj: number;
  bearMarketYear: number | null;      // simulate -30% equity crash in specific year
  recoveryRate: number;               // bounce-back equity return for year after crash

  // Per-income-type multipliers (default 1.0)
  employmentIncomeScale: number;
  selfEmploymentIncomeScale: number;
  dividendIncomeScale: number;
  interestIncomeScale: number;
  capitalGainsScale: number;
  rentalIncomeScale: number;
  pensionIncomeScale: number;
  retirementStartYear: number | null;  // zero employment/SE from this year onward

  // Living Expenses
  livingExpenseScale: number;          // uniform scale for all 8 expense categories
  housingExpenseAdj: number;           // flat $/yr delta on housing

  // Contributions (per-account multipliers, default 1.0)
  rrspContribScale: number;
  tfsaContribScale: number;
  nonRegContribScale: number;
  savingsDepositScale: number;
  // Withdrawals (flat $/yr deltas, default 0)
  rrspWithdrawalAdj: number;
  tfsaWithdrawalAdj: number;
  // Strategy
  contributionStrategy: 'unchanged' | 'maxRRSP' | 'maxTFSA' | 'maxFHSA';
  rrspDeductionOptimize: boolean;      // always claim full RRSP deduction

  // Asset Allocation
  allAccountsEquityPct: number | null; // null = unchanged; override equity % across all accounts

  // Retirement & CPP/OAS
  cppStartAgeOverride: number | null;  // 60–70
  oasStartAgeOverride: number | null;  // 65–70
  cppMonthlyAmountOverride: number | null;
  oasMonthlyAmountOverride: number | null;
  rrifConversionAgeOverride: number | null; // 65–71

  // Tax Brackets (existing)
  federalBracketShift: number;
  provBracketShift: number;

  // Tax Policy (new)
  capitalGainsInclusionRateOverride: number | null;  // 0.5 or 0.6667
  disableCGTiered: boolean;
  oasClawbackThresholdAdj: number;     // $/delta
  federalBPAOverride: number | null;

  // Deductions
  charitableDonationsAdj: number;      // flat $/yr delta
  medicalExpensesAdj: number;          // flat $/yr delta
}

export const DEFAULT_WHATIF: WhatIfAdjustments = {
  inflationAdj: 0,
  equityReturnAdj: 0,
  fixedIncomeReturnAdj: 0,
  cashReturnAdj: 0,
  savingsReturnAdj: 0,
  bearMarketYear: null,
  recoveryRate: 0,

  employmentIncomeScale: 1,
  selfEmploymentIncomeScale: 1,
  dividendIncomeScale: 1,
  interestIncomeScale: 1,
  capitalGainsScale: 1,
  rentalIncomeScale: 1,
  pensionIncomeScale: 1,
  retirementStartYear: null,

  livingExpenseScale: 1,
  housingExpenseAdj: 0,

  rrspContribScale: 1,
  tfsaContribScale: 1,
  nonRegContribScale: 1,
  savingsDepositScale: 1,
  rrspWithdrawalAdj: 0,
  tfsaWithdrawalAdj: 0,
  contributionStrategy: 'unchanged',
  rrspDeductionOptimize: false,

  allAccountsEquityPct: null,

  cppStartAgeOverride: null,
  oasStartAgeOverride: null,
  cppMonthlyAmountOverride: null,
  oasMonthlyAmountOverride: null,
  rrifConversionAgeOverride: null,

  federalBracketShift: 0,
  provBracketShift: 0,

  capitalGainsInclusionRateOverride: null,
  disableCGTiered: false,
  oasClawbackThresholdAdj: 0,
  federalBPAOverride: null,

  charitableDonationsAdj: 0,
  medicalExpensesAdj: 0,
};

export function isWhatIfActive(adj: WhatIfAdjustments): boolean {
  return (
    adj.inflationAdj !== 0 ||
    adj.equityReturnAdj !== 0 ||
    adj.fixedIncomeReturnAdj !== 0 ||
    adj.cashReturnAdj !== 0 ||
    adj.savingsReturnAdj !== 0 ||
    adj.bearMarketYear !== null ||
    adj.recoveryRate !== 0 ||
    adj.employmentIncomeScale !== 1 ||
    adj.selfEmploymentIncomeScale !== 1 ||
    adj.dividendIncomeScale !== 1 ||
    adj.interestIncomeScale !== 1 ||
    adj.capitalGainsScale !== 1 ||
    adj.rentalIncomeScale !== 1 ||
    adj.pensionIncomeScale !== 1 ||
    adj.retirementStartYear !== null ||
    adj.livingExpenseScale !== 1 ||
    adj.housingExpenseAdj !== 0 ||
    adj.rrspContribScale !== 1 ||
    adj.tfsaContribScale !== 1 ||
    adj.nonRegContribScale !== 1 ||
    adj.savingsDepositScale !== 1 ||
    adj.rrspWithdrawalAdj !== 0 ||
    adj.tfsaWithdrawalAdj !== 0 ||
    adj.contributionStrategy !== 'unchanged' ||
    adj.rrspDeductionOptimize !== false ||
    adj.allAccountsEquityPct !== null ||
    adj.cppStartAgeOverride !== null ||
    adj.oasStartAgeOverride !== null ||
    adj.cppMonthlyAmountOverride !== null ||
    adj.oasMonthlyAmountOverride !== null ||
    adj.rrifConversionAgeOverride !== null ||
    adj.federalBracketShift !== 0 ||
    adj.provBracketShift !== 0 ||
    adj.capitalGainsInclusionRateOverride !== null ||
    adj.disableCGTiered !== false ||
    adj.oasClawbackThresholdAdj !== 0 ||
    adj.federalBPAOverride !== null ||
    adj.charitableDonationsAdj !== 0 ||
    adj.medicalExpensesAdj !== 0
  );
}

function shiftBrackets(brackets: TaxBracket[], shift: number): TaxBracket[] {
  if (shift === 0) return brackets;
  const multiplier = 1 + shift;
  return brackets.map(b => ({
    ...b,
    min: Math.round(b.min * multiplier),
    max: b.max !== null ? Math.round(b.max * multiplier) : null,
  }));
}

/**
 * Apply what-if policy adjustments (bracket shift, BPA override, OAS threshold, CG rate)
 * to a single AssumptionOverrides entry. Returns a patched copy, or undefined if no changes.
 */
function patchOverride(ov: AssumptionOverrides, adj: WhatIfAdjustments): AssumptionOverrides {
  const patched = { ...ov };
  if (adj.federalBracketShift !== 0 && patched.federalBrackets) {
    patched.federalBrackets = shiftBrackets(patched.federalBrackets, adj.federalBracketShift);
  }
  if (adj.federalBracketShift !== 0 && patched.federalBPA !== undefined) {
    patched.federalBPA = Math.round(patched.federalBPA * (1 + adj.federalBracketShift));
  }
  if (adj.provBracketShift !== 0 && patched.provincialBrackets) {
    patched.provincialBrackets = shiftBrackets(patched.provincialBrackets, adj.provBracketShift);
  }
  if (adj.provBracketShift !== 0 && patched.provincialBPA !== undefined) {
    patched.provincialBPA = Math.round(patched.provincialBPA * (1 + adj.provBracketShift));
  }
  if (adj.federalBPAOverride !== null && patched.federalBPA !== undefined) {
    patched.federalBPA = adj.federalBPAOverride;
  }
  if (adj.oasClawbackThresholdAdj !== 0 && patched.oasClawbackThreshold !== undefined) {
    patched.oasClawbackThreshold = Math.max(0, patched.oasClawbackThreshold + adj.oasClawbackThresholdAdj);
  }
  if (adj.capitalGainsInclusionRateOverride !== null && patched.capitalGainsInclusionRate !== undefined) {
    patched.capitalGainsInclusionRate = adj.capitalGainsInclusionRateOverride;
  }
  return patched;
}

const EXPENSE_FIELDS = [
  'housingExpense', 'groceriesExpense', 'transportationExpense', 'utilitiesExpense',
  'insuranceExpense', 'entertainmentExpense', 'personalExpense', 'otherLivingExpense',
] as const;

const EQUITY_PCT_FIELDS = [
  'rrspEquityPct', 'tfsaEquityPct', 'fhsaEquityPct', 'nonRegEquityPct',
] as const;
const FIXED_PCT_FIELDS = [
  'rrspFixedPct', 'tfsaFixedPct', 'fhsaFixedPct', 'nonRegFixedPct',
] as const;
const CASH_PCT_FIELDS = [
  'rrspCashPct', 'tfsaCashPct', 'fhsaCashPct', 'nonRegCashPct',
] as const;

export function applyWhatIfAdjustments(scenario: Scenario, adj: WhatIfAdjustments): Scenario {
  if (!isWhatIfActive(adj)) return scenario;

  // Deep-clone mutable parts
  const assumptions = JSON.parse(JSON.stringify(scenario.assumptions));
  const years: YearData[] = JSON.parse(JSON.stringify(scenario.years));
  const scheduledItems = scenario.scheduledItems
    ? JSON.parse(JSON.stringify(scenario.scheduledItems))
    : undefined;
  const liabilities = scenario.liabilities
    ? JSON.parse(JSON.stringify(scenario.liabilities))
    : undefined;

  // --- Macro adjustments ---
  assumptions.inflationRate += adj.inflationAdj;
  assumptions.assetReturns.equity += adj.equityReturnAdj;
  assumptions.assetReturns.fixedIncome += adj.fixedIncomeReturnAdj;
  assumptions.assetReturns.cash += adj.cashReturnAdj;
  assumptions.assetReturns.savings += adj.savingsReturnAdj;

  // --- Bracket shifts on base assumptions (affects future/auto-indexed years) ---
  if (adj.federalBracketShift !== 0) {
    assumptions.federalBrackets = shiftBrackets(assumptions.federalBrackets, adj.federalBracketShift);
    assumptions.federalBPA = Math.round(assumptions.federalBPA * (1 + adj.federalBracketShift));
  }
  if (adj.provBracketShift !== 0) {
    assumptions.provincialBrackets = shiftBrackets(assumptions.provincialBrackets, adj.provBracketShift);
    assumptions.provincialBPA = Math.round(assumptions.provincialBPA * (1 + adj.provBracketShift));
  }

  // --- Patch per-year assumption overrides (historical + user) ---
  // compute() merges: { ...HISTORICAL_ASSUMPTIONS, ...scenario.assumptionOverrides }
  // Historical overrides have exact brackets for each year (1990-2025) that would overwrite
  // our base bracket shift. We need to shift those too. We do this by building the full
  // merged override map, patching it, and passing it as the scenario's assumptionOverrides
  // (user overrides take precedence over historical in compute).
  const needsOverridePatch =
    adj.federalBracketShift !== 0 || adj.provBracketShift !== 0 ||
    adj.federalBPAOverride !== null || adj.oasClawbackThresholdAdj !== 0 ||
    adj.capitalGainsInclusionRateOverride !== null;

  let assumptionOverrides = scenario.assumptionOverrides
    ? JSON.parse(JSON.stringify(scenario.assumptionOverrides)) as Record<number, AssumptionOverrides>
    : undefined;

  if (needsOverridePatch) {
    // Start from historical, overlay user overrides
    const merged: Record<number, AssumptionOverrides> = {};
    for (const [yrStr, ov] of Object.entries(HISTORICAL_ASSUMPTIONS)) {
      merged[Number(yrStr)] = { ...ov };
    }
    if (assumptionOverrides) {
      for (const [yrStr, ov] of Object.entries(assumptionOverrides)) {
        const yr = Number(yrStr);
        merged[yr] = { ...(merged[yr] ?? {}), ...ov };
      }
    }
    // Patch every entry
    for (const [yrStr, ov] of Object.entries(merged)) {
      merged[Number(yrStr)] = patchOverride(ov, adj);
    }
    // Use the patched merged map as the scenario's overrides —
    // since user overrides take precedence in compute, this works
    assumptionOverrides = merged;
  }

  // --- Tax Policy overrides on base assumptions (affects future years without overrides) ---
  if (adj.capitalGainsInclusionRateOverride !== null) {
    assumptions.capitalGainsInclusionRate = adj.capitalGainsInclusionRateOverride;
    if (assumptions.cgInclusionTiered) {
      assumptions.cgInclusionTier1Rate = adj.capitalGainsInclusionRateOverride;
      assumptions.cgInclusionTier2Rate = adj.capitalGainsInclusionRateOverride;
    }
  }
  if (adj.disableCGTiered) {
    assumptions.cgInclusionTiered = false;
  }
  if (adj.oasClawbackThresholdAdj !== 0 && assumptions.oasClawbackThreshold != null) {
    assumptions.oasClawbackThreshold = Math.max(0, assumptions.oasClawbackThreshold + adj.oasClawbackThresholdAdj);
  }
  if (adj.federalBPAOverride !== null) {
    assumptions.federalBPA = adj.federalBPAOverride;
  }

  // --- Retirement overrides ---
  if (assumptions.retirement) {
    if (adj.cppStartAgeOverride !== null) {
      assumptions.retirement.cppBenefit.startAge = adj.cppStartAgeOverride;
      assumptions.retirement.cppBenefit.enabled = true;
    }
    if (adj.oasStartAgeOverride !== null) {
      assumptions.retirement.oasBenefit.startAge = adj.oasStartAgeOverride;
      assumptions.retirement.oasBenefit.enabled = true;
    }
    if (adj.cppMonthlyAmountOverride !== null) {
      assumptions.retirement.cppBenefit.monthlyAmount = adj.cppMonthlyAmountOverride;
      assumptions.retirement.cppBenefit.enabled = true;
    }
    if (adj.oasMonthlyAmountOverride !== null) {
      assumptions.retirement.oasBenefit.monthlyAmount = adj.oasMonthlyAmountOverride;
      assumptions.retirement.oasBenefit.enabled = true;
    }
    if (adj.rrifConversionAgeOverride !== null) {
      assumptions.retirement.rrifConversionAge = adj.rrifConversionAgeOverride;
    }
  }

  // --- Bear market year ---
  if (adj.bearMarketYear !== null) {
    const yearIdx = adj.bearMarketYear - assumptions.startYear;
    if (yearIdx >= 0 && yearIdx < years.length) {
      years[yearIdx].equityReturnOverride = -0.30;
      if (adj.recoveryRate !== 0 && yearIdx + 1 < years.length) {
        years[yearIdx + 1].equityReturnOverride = adj.recoveryRate;
      }
    }
  }

  // --- Retirement start year: filter scheduled items ---
  if (adj.retirementStartYear !== null && scheduledItems) {
    for (let i = scheduledItems.length - 1; i >= 0; i--) {
      const item = scheduledItems[i];
      if (item.field === 'employmentIncome' || item.field === 'selfEmploymentIncome') {
        if (item.startYear >= adj.retirementStartYear) {
          scheduledItems.splice(i, 1);
        } else if (!item.endYear || item.endYear >= adj.retirementStartYear) {
          item.endYear = adj.retirementStartYear - 1;
        }
      }
    }
  }

  // --- Per-year adjustments ---
  for (const yd of years) {
    // Per-income-type scaling
    yd.employmentIncome *= adj.employmentIncomeScale;
    yd.selfEmploymentIncome *= adj.selfEmploymentIncomeScale;
    yd.eligibleDividends *= adj.dividendIncomeScale;
    yd.nonEligibleDividends *= adj.dividendIncomeScale;
    yd.interestIncome *= adj.interestIncomeScale;
    yd.capitalGainsRealized *= adj.capitalGainsScale;
    yd.rentalGrossIncome *= adj.rentalIncomeScale;
    yd.pensionIncome *= adj.pensionIncomeScale;

    // Retirement start year: zero out employment/SE income
    if (adj.retirementStartYear !== null && yd.year >= adj.retirementStartYear) {
      yd.employmentIncome = 0;
      yd.selfEmploymentIncome = 0;
      yd.selfEmploymentExpenses = 0;
    }

    // Living expense scaling
    if (adj.livingExpenseScale !== 1) {
      for (const f of EXPENSE_FIELDS) {
        yd[f] *= adj.livingExpenseScale;
      }
    }
    // Housing delta
    if (adj.housingExpenseAdj !== 0) {
      yd.housingExpense = Math.max(0, yd.housingExpense + adj.housingExpenseAdj);
    }

    // Per-contribution scaling
    yd.rrspContribution *= adj.rrspContribScale;
    yd.rrspDeductionClaimed *= adj.rrspContribScale;
    yd.tfsaContribution *= adj.tfsaContribScale;
    yd.nonRegContribution *= adj.nonRegContribScale;
    yd.savingsDeposit *= adj.savingsDepositScale;

    // Withdrawal deltas (clamped >= 0)
    if (adj.rrspWithdrawalAdj !== 0) {
      yd.rrspWithdrawal = Math.max(0, yd.rrspWithdrawal + adj.rrspWithdrawalAdj);
    }
    if (adj.tfsaWithdrawalAdj !== 0) {
      yd.tfsaWithdrawal = Math.max(0, yd.tfsaWithdrawal + adj.tfsaWithdrawalAdj);
    }

    // RRSP deduction optimize: always claim full contribution as deduction
    if (adj.rrspDeductionOptimize) {
      yd.rrspDeductionClaimed = yd.rrspContribution;
    }

    // Contribution strategy redirects
    if (adj.contributionStrategy === 'maxRRSP') {
      const tfsaAmt = yd.tfsaContribution;
      const fhsaAmt = yd.fhsaContribution;
      yd.rrspContribution += tfsaAmt + fhsaAmt;
      yd.rrspDeductionClaimed += tfsaAmt + fhsaAmt;
      yd.tfsaContribution = 0;
      yd.fhsaContribution = 0;
      yd.fhsaDeductionClaimed = 0;
    } else if (adj.contributionStrategy === 'maxTFSA') {
      const rrspAmt = yd.rrspContribution;
      const fhsaAmt = yd.fhsaContribution;
      yd.tfsaContribution += rrspAmt + fhsaAmt;
      yd.rrspContribution = 0;
      yd.rrspDeductionClaimed = 0;
      yd.fhsaContribution = 0;
      yd.fhsaDeductionClaimed = 0;
    } else if (adj.contributionStrategy === 'maxFHSA') {
      const rrspAmt = yd.rrspContribution;
      const tfsaAmt = yd.tfsaContribution;
      yd.fhsaContribution += rrspAmt + tfsaAmt;
      yd.fhsaDeductionClaimed += rrspAmt + tfsaAmt;
      yd.rrspContribution = 0;
      yd.rrspDeductionClaimed = 0;
      yd.tfsaContribution = 0;
    }

    // Asset allocation override
    if (adj.allAccountsEquityPct !== null) {
      const eq = adj.allAccountsEquityPct;
      const fi = 1 - eq;
      for (let i = 0; i < EQUITY_PCT_FIELDS.length; i++) {
        yd[EQUITY_PCT_FIELDS[i]] = eq;
        yd[FIXED_PCT_FIELDS[i]] = fi;
        yd[CASH_PCT_FIELDS[i]] = 0;
      }
    }

    // Deduction deltas (clamped >= 0)
    if (adj.charitableDonationsAdj !== 0) {
      yd.charitableDonations = Math.max(0, yd.charitableDonations + adj.charitableDonationsAdj);
    }
    if (adj.medicalExpensesAdj !== 0) {
      yd.medicalExpenses = Math.max(0, yd.medicalExpenses + adj.medicalExpensesAdj);
    }
  }

  return {
    ...scenario,
    assumptions,
    years,
    scheduledItems,
    liabilities,
    assumptionOverrides,
  };
}
