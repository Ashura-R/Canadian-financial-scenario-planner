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
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, incomeScaleFactor: 1.1 })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, contributionStrategy: 'maxRRSP' })).toBe(true);
      expect(isWhatIfActive({ ...DEFAULT_WHATIF, federalBracketShift: 0.1 })).toBe(true);
    });
  });

  describe('applyWhatIfAdjustments', () => {
    it('identity: default adjustments return identical assumptions', () => {
      const scenario = makeScenarioWithIncome();
      const result = applyWhatIfAdjustments(scenario, DEFAULT_WHATIF);
      // Should return same reference when no adjustments
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

    it('income scaling: 1.1 factor multiplies all income fields by 1.1', () => {
      const scenario = makeScenarioWithIncome();
      const base = compute(scenario);
      // Set income on first year directly for testing
      scenario.years[0].employmentIncome = 80000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, incomeScaleFactor: 1.1 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].employmentIncome).toBeCloseTo(88000);
    });

    it('expense scaling: 1.2 factor multiplies contribution fields', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].rrspContribution = 5000;
      scenario.years[0].tfsaContribution = 3000;
      scenario.years[0].savingsDeposit = 1000;

      const adj: WhatIfAdjustments = { ...DEFAULT_WHATIF, expenseScaleFactor: 1.2 };
      const result = applyWhatIfAdjustments(scenario, adj);
      expect(result.years[0].rrspContribution).toBeCloseTo(6000);
      expect(result.years[0].tfsaContribution).toBeCloseTo(3600);
      expect(result.years[0].savingsDeposit).toBeCloseTo(1200);
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
      expect(result.years[0].rrspContribution).toBe(10000); // 5000 + 3000 + 2000
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
      expect(result.years[0].tfsaContribution).toBe(10000); // 3000 + 5000 + 2000
      expect(result.years[0].rrspContribution).toBe(0);
      expect(result.years[0].fhsaContribution).toBe(0);
    });

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

    it('combined: multiple adjustments all take effect', () => {
      const scenario = makeScenarioWithIncome();
      scenario.years[0].employmentIncome = 80000;
      scenario.years[0].rrspContribution = 5000;

      const adj: WhatIfAdjustments = {
        ...DEFAULT_WHATIF,
        inflationAdj: 0.01,
        equityReturnAdj: 0.02,
        incomeScaleFactor: 1.1,
        expenseScaleFactor: 0.9,
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
        incomeScaleFactor: 1.2,
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
        incomeScaleFactor: 2.0,
        federalBracketShift: 0.2,
        contributionStrategy: 'maxRRSP',
      };
      applyWhatIfAdjustments(scenario, adj);

      expect(scenario.assumptions.inflationRate).toBe(origInflation);
      expect(scenario.assumptions.assetReturns.equity).toBe(origEquity);
      expect(scenario.years[0].employmentIncome).toBe(origIncome);
      expect(scenario.assumptions.federalBrackets[0].max).toBe(origBracketMax);
    });
  });
});
