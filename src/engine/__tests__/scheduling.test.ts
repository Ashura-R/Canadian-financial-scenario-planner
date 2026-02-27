import { describe, it, expect } from 'vitest';
import { compute, getScheduledAmount } from '../index';
import { makeTestScenario, makeTestSchedule, getYear } from './helpers';
import type { ScheduledItem } from '../../types/scenario';

describe('getScheduledAmount', () => {
  it('returns base amount in start year', () => {
    const item = makeTestSchedule({ amount: 1000, startYear: 2025 });
    expect(getScheduledAmount(item, 2025, 0.025)).toBe(1000);
  });

  it('applies fixed growth rate', () => {
    const item = makeTestSchedule({ amount: 1000, startYear: 2025, growthRate: 0.03, growthType: 'fixed' });
    // Year 2: 1000 * 1.03 = 1030
    expect(getScheduledAmount(item, 2026, 0.025)).toBeCloseTo(1030, 2);
    // Year 3: 1000 * 1.03^2 ≈ 1060.90
    expect(getScheduledAmount(item, 2027, 0.025)).toBeCloseTo(1060.90, 2);
  });

  it('applies inflation growth rate', () => {
    const item = makeTestSchedule({ amount: 1000, startYear: 2025, growthType: 'inflation' });
    // inflation = 0.025: 1000 * 1.025 = 1025
    expect(getScheduledAmount(item, 2026, 0.025)).toBeCloseTo(1025, 2);
  });

  it('returns base amount for years before start (negative elapsed)', () => {
    const item = makeTestSchedule({ amount: 1000, startYear: 2027 });
    // yearsElapsed = 2025 - 2027 = -2, which is <= 0
    expect(getScheduledAmount(item, 2025, 0.025)).toBe(1000);
  });
});

describe('scheduling integration', () => {
  it('savingsDeposit schedule applies and updates savingsEOY', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'savingsDeposit', amount: 5000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    expect(yr0).toBeDefined();
    // savingsDeposit should be applied (was 0, schedule sets to 5000)
    // savingsEOY = (0 + 5000 - 0) * (1 + 0) = 5000 (savings return is 0 by default)
    expect(yr0.accounts.savingsEOY).toBe(5000);
  });

  it('savingsWithdrawal schedule applies', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 10000, lira: 0, resp: 0, li: 0 },
      scheduledItems: [
        makeTestSchedule({ field: 'savingsWithdrawal', amount: 2000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    // savingsEOY = (10000 + 0 - 2000) * (1 + 0) = 8000
    expect(yr0.accounts.savingsEOY).toBe(8000);
  });

  it('respects start/end year boundaries', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'savingsDeposit', amount: 5000, startYear: 2026, endYear: 2030 }),
      ],
    });

    const result = compute(scenario);
    // Year 2025: outside range, no deposit
    expect(getYear(result.years, 2025)!.accounts.savingsEOY).toBe(0);
    // Year 2026: in range
    expect(getYear(result.years, 2026)!.accounts.savingsEOY).toBeGreaterThan(0);
    // Year 2030: last year in range
    expect(getYear(result.years, 2030)!.accounts.savingsEOY).toBeGreaterThan(0);
  });

  it('schedule with growth rate compounds correctly', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({
          field: 'savingsDeposit',
          amount: 1000,
          startYear: 2025,
          growthRate: 0.03,
          growthType: 'fixed',
        }),
      ],
    });

    const result = compute(scenario);
    // Year 0 (2025): deposit = 1000
    // Year 1 (2026): deposit = 1000 * 1.03 = 1030
    // Year 2 (2027): deposit = 1000 * 1.03^2 ≈ 1060.90
    // With 0% savings return, EOY cumulates
    const yr2 = getYear(result.years, 2027)!;
    // Total deposited by year 2 = 1000 + 1030 + 1060.90 = 3090.90
    expect(yr2.accounts.savingsEOY).toBeCloseTo(3090.90, 0);
  });

  it('schedule skipped when user has manual (non-zero) value', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'savingsDeposit', amount: 5000, startYear: 2025 }),
      ],
    });
    // Set year 0 savingsDeposit to 500 manually
    scenario.years[0].savingsDeposit = 500;

    const result = compute(scenario);
    // Should use 500, not 5000
    expect(result.years[0].accounts.savingsEOY).toBe(500);
  });

  it('multiple fields scheduled together', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 100000, startYear: 2025 }),
        makeTestSchedule({ field: 'rrspContribution', amount: 10000, startYear: 2025 }),
        makeTestSchedule({ field: 'savingsDeposit', amount: 2000, startYear: 2025 }),
      ],
      openingCarryForwards: { rrspUnusedRoom: 50000, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    // Employment income should drive tax calculations
    expect(yr0.waterfall.grossIncome).toBeGreaterThan(0);
    // RRSP should have a balance
    expect(yr0.accounts.rrspEOY).toBeGreaterThan(0);
    // Savings should have a balance
    expect(yr0.accounts.savingsEOY).toBe(2000);
  });

  it('employment income schedule produces tax liability', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    expect(yr0.tax.totalIncomeTax).toBeGreaterThan(0);
    expect(yr0.cpp.totalCPPPaid).toBeGreaterThan(0);
    expect(yr0.ei.totalEI).toBeGreaterThan(0);
  });
});
