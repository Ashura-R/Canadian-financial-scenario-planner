import { describe, it, expect } from 'vitest';
import { DEFAULT_WHATIF, isWhatIfActive, applyWhatIfAdjustments } from '../whatIfEngine';
import type { WhatIfAdjustments } from '../whatIfEngine';
import { compute } from '../index';
import { makeTestScenario, makeTestSchedule } from './helpers';

function makeScenarioWithIncome() {
  return makeTestScenario({
    scheduledItems: [
      makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
      makeTestSchedule({ field: 'rrspContribution', amount: 5000, startYear: 2025 }),
      makeTestSchedule({ field: 'rrspDeductionClaimed', amount: 5000, startYear: 2025 }),
      makeTestSchedule({ field: 'tfsaContribution', amount: 3000, startYear: 2025 }),
      makeTestSchedule({ field: 'fhsaContribution', amount: 2000, startYear: 2025 }),
      makeTestSchedule({ field: 'fhsaDeductionClaimed', amount: 2000, startYear: 2025 }),
    ],
  });
}

describe('whatIfEngine', () => {
  describe('isWhatIfActive', () => {
    it('returns false for default adjustments', () => {
      expect(isWhatIfActive(DEFAULT_WHATIF)).toBe(false);
    });

    it('returns true when any field is non-default', () => {
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, inflationAdj: 0.01 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, employmentIncomeScale: 1.1 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, contributionStrategy: 'maxRRSP' })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, federalBracketShift: 0.1 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, bearMarketYear: 2030 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, retirementStartYear: 2040 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, livingExpenseScale: 1.2 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, allAccountsEquityPct: 0.8 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, capitalGainsInclusionRateOverride: 0.5 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, charitableDonationsAdj: 1000 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, rrspDeductionOptimize: true })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, disableCGTiered: true })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, cppStartAgeOverride: 60 })).toBe(true);
    });
  });

  describe('applyWhatIfAdjustments', () => {
    it('identity: default adjustments return identical assumptions', () => {
      const scenario = makeScenarioWithIncome();
      const result = applyWhatIfAdjustments(scenario, DEFAULT_WHATIF);
      expect(result).toBe(scenario);
    });

    it('inflation: +2% increases inflationRate by 0.02', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, inflationAdj: 0.02 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.inflationRate).toBeCloseTo(
        scenario.assumptions.inflationRate + 0.02
      );
    });

    it('equity return: +3% increases equity return', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, equityReturnAdj: 0.03 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.assetReturns.equity).toBeCloseTo(
        scenario.assumptions.assetReturns.equity + 0.03
      );
    });

    it('fixed income return: +1% increases fixedIncome return', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, fixedIncomeReturnAdj: 0.01 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.assetReturns.fixedIncome).toBeCloseTo(
        scenario.assumptions.assetReturns.fixedIncome + 0.01
      );
    });

    it('cash and savings adjustments applied', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, cashReturnAdj: 0.005, savingsReturnAdj: 0.01 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.assetReturns.cash).toBeCloseTo(
        scenario.assumptions.assetReturns.cash + 0.005
      );
      expect(result.assumptions.assetReturns.savings).toBeCloseTo(
        scenario.assumptions.assetReturns.savings + 0.01
      );
    });

    // --- Per-income-type scaling ---
    it('per-income scaling: employment 1.1x multiplies only employment income', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 80000;
      scenario.years[0].interestIncome = 5000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, employmentIncomeScale: 1.1 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].employmentIncome).toBeCloseTo(88000);
      expect(result.years[0].interestIncome).toBe(5000); // unchanged
    });

    it('per-income scaling: dividends 2x scales both eligible and non-eligible', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].eligibleDividends = 3000;
      scenario.years[0].nonEligibleDividends = 1000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, dividendIncomeScale: 2 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].eligibleDividends).toBeCloseTo(6000);
      expect(result.years[0].nonEligibleDividends).toBeCloseTo(2000);
    });

    it('per-income scaling: capital gains 0.5x halves CG', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].capitalGainsRealized = 20000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, capitalGainsScale: 0.5 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].capitalGainsRealized).toBeCloseTo(10000);
    });

    // --- Retirement start year ---
    it('retirement start year: zeros employment/SE from cutoff year', () => {
      const scenario = makeScenarioWithIncome();
      const cutoff = scenario.assumptions.startYear + 2;
      scenario.years[0].employmentIncome = 80000;
      scenario.years[1].employmentIncome = 80000;
      scenario.years[2].employmentIncome = 80000;
      scenario.years[2].selfEmploymentIncome = 10000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, retirementStartYear: cutoff };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].employmentIncome).toBe(80000);
      expect(result.years[1].employmentIncome).toBe(80000);
      expect(result.years[2].employmentIncome).toBe(0);
      expect(result.years[2].selfEmploymentIncome).toBe(0);
    });

    it('retirement start year: truncates scheduled employment items', () => {
      const scenario = makeScenarioWithIncome();
      const cutoff = scenario.assumptions.startYear + 3;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, retirementStartYear: cutoff };
      const result = applyWhatIfAdjustments(scenario, adj);

      // Scheduled employment items should be truncated
      const empItems = result.scheduledItems?.filter(i => i.field === 'employmentIncome') ?? [];
      for (const item of empItems) {
        expect(item.endYear).toBeLessThan(cutoff);
      }
    });

    // --- Expense scaling ---
    it('living expense scaling: 1.2x scales all 8 expense categories', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].housingExpense = 20000;
      scenario.years[0].groceriesExpense = 6000;
      scenario.years[0].entertainmentExpense = 3000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, livingExpenseScale: 1.2 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].housingExpense).toBeCloseTo(24000);
      expect(result.years[0].groceriesExpense).toBeCloseTo(7200);
      expect(result.years[0].entertainmentExpense).toBeCloseTo(3600);
    });

    it('housing expense delta: adds flat amount', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].housingExpense = 20000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, housingExpenseAdj: 5000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].housingExpense).toBe(25000);
    });

    it('housing expense delta: clamps to 0 if negative exceeds value', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].housingExpense = 3000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, housingExpenseAdj: -5000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].housingExpense).toBe(0);
    });

    // --- Per-contribution scaling ---
    it('per-contribution scaling: RRSP 2x, TFSA 0.5x', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 5000;
      scenario.years[0].rrspDeductionClaimed = 5000;
      scenario.years[0].tfsaContribution = 3000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, rrspContribScale: 2, tfsaContribScale: 0.5 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspContribution).toBeCloseTo(10000);
      expect(result.years[0].rrspDeductionClaimed).toBeCloseTo(10000);
      expect(result.years[0].tfsaContribution).toBeCloseTo(1500);
    });

    // --- maxFHSA strategy ---
    it('maxFHSA strategy: redirects RRSP+TFSA to FHSA', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 5000;
      scenario.years[0].rrspDeductionClaimed = 5000;
      scenario.years[0].tfsaContribution = 3000;
      scenario.years[0].fhsaContribution = 2000;
      scenario.years[0].fhsaDeductionClaimed = 2000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, contributionStrategy: 'maxFHSA' };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].fhsaContribution).toBe(10000); // 2000 + 5000 + 3000
      expect(result.years[0].rrspContribution).toBe(0);
      expect(result.years[0].tfsaContribution).toBe(0);
    });

    it('maxRRSP strategy: TFSA+FHSA contributions redirect to RRSP', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 5000;
      scenario.years[0].rrspDeductionClaimed = 5000;
      scenario.years[0].tfsaContribution = 3000;
      scenario.years[0].fhsaContribution = 2000;
      scenario.years[0].fhsaDeductionClaimed = 2000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, contributionStrategy: 'maxRRSP' };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspContribution).toBe(10000);
      expect(result.years[0].tfsaContribution).toBe(0);
      expect(result.years[0].fhsaContribution).toBe(0);
    });

    it('maxTFSA strategy: RRSP+FHSA contributions redirect to TFSA', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 5000;
      scenario.years[0].rrspDeductionClaimed = 5000;
      scenario.years[0].tfsaContribution = 3000;
      scenario.years[0].fhsaContribution = 2000;
      scenario.years[0].fhsaDeductionClaimed = 2000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, contributionStrategy: 'maxTFSA' };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].tfsaContribution).toBe(10000);
      expect(result.years[0].rrspContribution).toBe(0);
      expect(result.years[0].fhsaContribution).toBe(0);
    });

    // --- Withdrawal deltas ---
    it('withdrawal deltas: adds amount, clamps to 0', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspWithdrawal = 2000;
      scenario.years[0].tfsaWithdrawal = 1000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, rrspWithdrawalAdj: 5000, tfsaWithdrawalAdj: -2000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspWithdrawal).toBe(7000);
      expect(result.years[0].tfsaWithdrawal).toBe(0); // clamped from -1000 to 0
    });

    // --- Asset allocation override ---
    it('asset allocation: 90% equity sets all accounts', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspEquityPct = 0.6;
      scenario.years[0].rrspFixedPct = 0.3;
      scenario.years[0].rrspCashPct = 0.1;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, allAccountsEquityPct: 0.9 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspEquityPct).toBe(0.9);
      expect(result.years[0].rrspFixedPct).toBeCloseTo(0.1);
      expect(result.years[0].rrspCashPct).toBe(0);
      expect(result.years[0].tfsaEquityPct).toBe(0.9);
      expect(result.years[0].nonRegEquityPct).toBe(0.9);
    });

    // --- Retirement overrides ---
    it('retirement overrides: CPP/OAS age and amount', () => {
      const scenario = makeScenarioWithIncome();
      scenario.assumptions.retirement = {
        cppBenefit: { enabled: false, startAge: 65, monthlyAmount: 1000 },
        oasBenefit: { enabled: false, startAge: 65, monthlyAmount: 700 },
        rrifConversionAge: 71,
      };

      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        cppStartAgeOverride: 60,
        oasStartAgeOverride: 67,
        cppMonthlyAmountOverride: 800,
        rrifConversionAgeOverride: 65,
      };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.retirement!.cppBenefit.startAge).toBe(60);
      expect(result.assumptions.retirement!.cppBenefit.monthlyAmount).toBe(800);
      expect(result.assumptions.retirement!.cppBenefit.enabled).toBe(true);
      expect(result.assumptions.retirement!.oasBenefit.startAge).toBe(67);
      expect(result.assumptions.retirement!.oasBenefit.enabled).toBe(true);
      expect(result.assumptions.retirement!.rrifConversionAge).toBe(65);
    });

    // --- Bear market year ---
    it('bear market year: sets -30% equity on specified year', () => {
      const scenario = makeScenarioWithIncome();
      const targetYear = scenario.assumptions.startYear + 2;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, bearMarketYear: targetYear };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[2].equityReturnOverride).toBeCloseTo(-0.30);
    });

    it('bear market year with recovery: sets recovery rate on next year', () => {
      const scenario = makeScenarioWithIncome();
      const targetYear = scenario.assumptions.startYear + 2;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, bearMarketYear: targetYear, recoveryRate: 0.20 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[2].equityReturnOverride).toBeCloseTo(-0.30);
      expect(result.years[3].equityReturnOverride).toBeCloseTo(0.20);
    });

    it('bear market year out of bounds: no crash', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, bearMarketYear: 1990 };
      expect(() => applyWhatIfAdjustments(scenario, adj)).not.toThrow();
    });

    // --- CG inclusion rate override ---
    it('CG inclusion rate override: sets rate to 0.5', () => {
      const scenario = makeScenarioWithIncome();
      scenario.assumptions.capitalGainsInclusionRate = 0.6667;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, capitalGainsInclusionRateOverride: 0.5 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.capitalGainsInclusionRate).toBe(0.5);
    });

    it('disable CG tiered: sets cgInclusionTiered to false', () => {
      const scenario = makeScenarioWithIncome();
      scenario.assumptions.cgInclusionTiered = true;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, disableCGTiered: true };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.cgInclusionTiered).toBe(false);
    });

    // --- OAS clawback threshold ---
    it('OAS clawback threshold delta: adjusts threshold', () => {
      const scenario = makeScenarioWithIncome();
      scenario.assumptions.oasClawbackThreshold = 86912;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, oasClawbackThresholdAdj: -10000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.oasClawbackThreshold).toBe(76912);
    });

    // --- Federal BPA override ---
    it('federal BPA override: overrides BPA', () => {
      const scenario = makeScenarioWithIncome();

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, federalBPAOverride: 20000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.federalBPA).toBe(20000);
    });

    // --- Deduction deltas ---
    it('deduction deltas: adds amount and clamps to 0', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].charitableDonations = 1000;
      scenario.years[0].medicalExpenses = 500;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, charitableDonationsAdj: 5000, medicalExpensesAdj: -1000 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].charitableDonations).toBe(6000);
      expect(result.years[0].medicalExpenses).toBe(0); // clamped
    });

    // --- RRSP deduction optimize ---
    it('RRSP deduction optimize: claims full contribution as deduction', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 10000;
      scenario.years[0].rrspDeductionClaimed = 5000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, rrspDeductionOptimize: true };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspDeductionClaimed).toBe(10000);
    });

    // --- Bracket shifts (existing) ---
    it('federal bracket shift: +10% multiplies bracket thresholds by 1.1', () => {
      const scenario = makeScenarioWithIncome();
      const origFirst = scenario.assumptions.federalBrackets[0].max!;
      const origBPA = scenario.assumptions.federalBPA;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, federalBracketShift: 0.1 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.federalBrackets[0].max).toBe(Math.round(origFirst * 1.1));
      expect(result.assumptions.federalBPA).toBe(Math.round(origBPA * 1.1));
    });

    it('provincial bracket shift: +10% multiplies provincial bracket thresholds', () => {
      const scenario = makeScenarioWithIncome();
      const origFirst = scenario.assumptions.provincialBrackets[0].max!;
      const origBPA = scenario.assumptions.provincialBPA;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, provBracketShift: 0.1 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.provincialBrackets[0].max).toBe(Math.round(origFirst * 1.1));
      expect(result.assumptions.provincialBPA).toBe(Math.round(origBPA * 1.1));
    });

    // --- Combined ---
    it('combined: multiple adjustments all take effect', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 80000;
      scenario.years[0].rrspContribution = 5000;

      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        inflationAdj: 0.01,
        equityReturnAdj: 0.02,
        employmentIncomeScale: 1.1,
        rrspContribScale: 0.9,
      };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.assumptions.inflationRate).toBeCloseTo(scenario.assumptions.inflationRate + 0.01);
      expect(result.assumptions.assetReturns.equity).toBeCloseTo(scenario.assumptions.assetReturns.equity + 0.02);
      expect(result.years[0].employmentIncome).toBeCloseTo(88000);
      expect(result.years[0].rrspContribution).toBeCloseTo(4500);
    });

    it('integration: compute(applyWhatIfAdjustments(scenario, adj)) runs without error', () => {
      const scenario = makeScenarioWithIncome();
      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        inflationAdj: 0.02,
        equityReturnAdj: 0.03,
        employmentIncomeScale: 1.2,
        federalBracketShift: 0.05,
      };
      const modified = applyWhatIfAdjustments(scenario, adj);
      expect(() => compute(modified)).not.toThrow();

      const result = compute(modified);
      expect(result.years.length).toBe(modified.assumptions.numYears);
      for (const yr of result.years) {
        expect(Number.isFinite(yr.accounts.netWorth)).toBe(true);
      }
    });

    it('integration: complex whatif with many adjustments computes', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 80000;
      scenario.years[0].housingExpense = 20000;
      scenario.years[0].charitableDonations = 1000;

      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        employmentIncomeScale: 1.5,
        dividendIncomeScale: 2,
        livingExpenseScale: 0.8,
        rrspContribScale: 2,
        allAccountsEquityPct: 0.8,
        charitableDonationsAdj: 5000,
        capitalGainsInclusionRateOverride: 0.5,
        disableCGTiered: true,
      };
      const modified = applyWhatIfAdjustments(scenario, adj);
      expect(() => compute(modified)).not.toThrow();
    });

    it('no mutation: original scenario unchanged after adjustment', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 80000;
      const origInflation = scenario.assumptions.inflationRate;
      const origEquity = scenario.assumptions.assetReturns.equity;
      const origIncome = scenario.years[0].employmentIncome;
      const origBracketMax = scenario.assumptions.federalBrackets[0].max;

      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        inflationAdj: 0.05,
        equityReturnAdj: 0.03,
        employmentIncomeScale: 2.0,
        federalBracketShift: 0.2,
        contributionStrategy: 'maxRRSP',
      };
      applyWhatIfAdjustments(scenario, adj);

      expect(scenario.assumptions.inflationRate).toBe(origInflation);
      expect(scenario.assumptions.assetReturns.equity).toBe(origEquity);
      expect(scenario.years[0].employmentIncome).toBe(origIncome);
      expect(scenario.assumptions.federalBrackets[0].max).toBe(origBracketMax);
    });

    it('bracket shift changes computed tax (not overwritten by historical)', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 93000;
      scenario.years[0].selfEmploymentIncome = 0;

      const baseline = compute(scenario);
      const baseTax = baseline.years[0].tax.totalIncomeTax;

      // Shift brackets up 10% — more income falls in lower brackets → less tax
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, federalBracketShift: 0.1, provBracketShift: 0.1 };
      const modified = applyWhatIfAdjustments(scenario, adj);
      const shifted = compute(modified);
      const shiftedTax = shifted.years[0].tax.totalIncomeTax;

      // Wider brackets should produce lower tax
      expect(shiftedTax).toBeLessThan(baseTax);
      // Sanity: difference should be meaningful (not just rounding)
      expect(baseTax - shiftedTax).toBeGreaterThan(100);
    });

    it('bracket shift down increases computed tax', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 93000;

      const baseline = compute(scenario);
      const baseTax = baseline.years[0].tax.totalIncomeTax;

      // Shift brackets down 10% — more income in higher brackets → more tax
      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, federalBracketShift: -0.1, provBracketShift: -0.1 };
      const modified = applyWhatIfAdjustments(scenario, adj);
      const shifted = compute(modified);
      const shiftedTax = shifted.years[0].tax.totalIncomeTax;

      expect(shiftedTax).toBeGreaterThan(baseTax);
      expect(shiftedTax - baseTax).toBeGreaterThan(100);
    });

    it('deep clones scheduledItems and liabilities', () => {
      const scenario = makeScenarioWithIncome();
      scenario.liabilities = [{ id: '1', label: 'Mortgage', type: 'mortgage', openingBalance: 500000, annualRate: 0.05, monthlyPayment: 3000 }];

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, inflationAdj: 0.01 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.scheduledItems).not.toBe(scenario.scheduledItems);
      expect(result.liabilities).not.toBe(scenario.liabilities);
      expect(result.liabilities).toEqual(scenario.liabilities);
    });
  });
});
