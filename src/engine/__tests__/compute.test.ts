import { describe, it, expect } from 'vitest';
import { compute } from '../index';
import { makeTestScenario, makeTestSchedule } from './helpers';

describe('compute', () => {
  it('default scenario computes without throwing', () => {
    const scenario = makeTestScenario();
    expect(() => compute(scenario)).not.toThrow();
  });

  it('all-zero scenario produces valid ComputedScenario', () => {
    const scenario = makeTestScenario();
    const result = compute(scenario);

    expect(result.years.length).toBe(scenario.assumptions.numYears);
    expect(result.scenarioId).toBe(scenario.id);

    for (const yr of result.years) {
      expect(Number.isFinite(yr.tax.totalIncomeTax)).toBe(true);
      expect(Number.isFinite(yr.accounts.netWorth)).toBe(true);
      expect(Number.isFinite(yr.waterfall.grossIncome)).toBe(true);
      expect(Number.isFinite(yr.waterfall.netCashFlow)).toBe(true);
      expect(yr.tax.totalIncomeTax).toBeGreaterThanOrEqual(0);
      expect(yr.accounts.netWorth).toBeGreaterThanOrEqual(0);
    }
  });

  it('$100K employment income produces reasonable tax', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 100000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];

    // At $100K ON employment: federal + provincial tax roughly $18K-$25K
    expect(yr0.tax.totalIncomeTax).toBeGreaterThan(10000);
    expect(yr0.tax.totalIncomeTax).toBeLessThan(40000);

    // After-tax should be positive and less than gross
    expect(yr0.waterfall.afterTaxIncome).toBeGreaterThan(0);
    expect(yr0.waterfall.afterTaxIncome).toBeLessThan(100000);
  });

  it('RRSP room carries forward correctly', () => {
    const scenario = makeTestScenario({
      openingCarryForwards: { rrspUnusedRoom: 20000, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0, priorYearEarnedIncome: 60000 },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 60000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    // rrspUnusedRoom in ComputedYear = room available AT START of that year
    // Year 0: opening room = 20000 (before new room generation)
    expect(result.years[0].rrspUnusedRoom).toBe(20000);
    // Year 1: 20000 + min(60000*0.18, 31560) = 20000 + 10800 = 30800
    expect(result.years[1].rrspUnusedRoom).toBeCloseTo(30800, 0);
    // Year 2: 30800 + 10800 = 41600
    expect(result.years[2].rrspUnusedRoom).toBeCloseTo(41600, 0);
  });

  it('TFSA room carries forward correctly', () => {
    const scenario = makeTestScenario({
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 15000, capitalLossCF: 0, fhsaContribLifetime: 0 },
    });

    const result = compute(scenario);
    // Year 0: 15000 opening + 7000 annual = 22000 unused room (no contributions)
    expect(result.years[0].tfsaUnusedRoom).toBe(22000);
  });

  it('capital loss carry-forward works', () => {
    const scenario = makeTestScenario({
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 5000, fhsaContribLifetime: 0 },
    });

    const result = compute(scenario);
    expect(result.years[0].capitalLossCF).toBe(5000); // no gains to offset
  });

  it('scheduled rules integrate end-to-end with account balances', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 50000, tfsa: 30000, fhsa: 0, nonReg: 0, savings: 10000, lira: 0, resp: 0 },
      openingCarryForwards: { rrspUnusedRoom: 30000, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
        makeTestSchedule({ field: 'rrspContribution', amount: 5000, startYear: 2025 }),
        makeTestSchedule({ field: 'rrspDeductionClaimed', amount: 5000, startYear: 2025 }),
        makeTestSchedule({ field: 'savingsDeposit', amount: 3000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];

    // RRSP: 50000 + 5000 = 55000 (0% return)
    expect(yr0.accounts.rrspEOY).toBe(55000);
    // Savings: 10000 + 3000 = 13000
    expect(yr0.accounts.savingsEOY).toBe(13000);
    // Net worth should include all accounts
    expect(yr0.accounts.netWorth).toBe(55000 + 30000 + 0 + 0 + 13000 + 0 + 0);
  });

  it('analytics cumulative sums are running totals', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const { analytics } = result;

    // Verify cumulative arrays are running sums
    let runningGross = 0;
    for (let i = 0; i < result.years.length; i++) {
      runningGross += result.years[i].waterfall.grossIncome;
      expect(analytics.cumulativeGrossIncome[i]).toBeCloseTo(runningGross, 2);
    }

    // Verify lifetime values match final cumulative
    expect(analytics.lifetimeGrossIncome).toBeCloseTo(
      analytics.cumulativeGrossIncome[analytics.cumulativeGrossIncome.length - 1], 2
    );
  });
});
