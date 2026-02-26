import { describe, it, expect } from 'vitest';
import { computeSensitivity } from '../sensitivityEngine';
import { makeTestScenario, makeTestSchedule } from './helpers';

describe('computeSensitivity', () => {
  const scenario = makeTestScenario({
    openingBalances: { rrsp: 100000, tfsa: 50000, fhsa: 0, nonReg: 30000, savings: 0, lira: 0, resp: 0 },
    assumptions: {
      ...makeTestScenario().assumptions,
      numYears: 5,
      assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0.02, savings: 0.015 },
    },
    scheduledItems: [
      makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
    ],
  });
  scenario.years = scenario.years.slice(0, 5);

  it('produces correct number of scenarios with default offsets', () => {
    const result = computeSensitivity(scenario);
    expect(result.scenarios.length).toBe(5); // -4%, -2%, 0%, +2%, +4%
    expect(result.base.equityOffset).toBe(0);
    expect(result.base.label).toBe('Base');
  });

  it('base scenario has the same results as the 0-offset scenario', () => {
    const result = computeSensitivity(scenario);
    const zeroOffset = result.scenarios.find(s => s.equityOffset === 0)!;
    expect(result.base.finalNetWorth).toBe(zeroOffset.finalNetWorth);
    expect(result.base.lifetimeAfterTax).toBe(zeroOffset.lifetimeAfterTax);
  });

  it('higher equity returns produce higher final net worth', () => {
    const result = computeSensitivity(scenario);
    const neg4 = result.scenarios.find(s => s.equityOffset === -0.04)!;
    const pos4 = result.scenarios.find(s => s.equityOffset === 0.04)!;
    expect(pos4.finalNetWorth).toBeGreaterThan(neg4.finalNetWorth);
  });

  it('yearly net worth arrays have correct length', () => {
    const result = computeSensitivity(scenario);
    for (const s of result.scenarios) {
      expect(s.yearlyNetWorth.length).toBe(5);
    }
  });

  it('works with custom offsets', () => {
    const result = computeSensitivity(scenario, [-0.10, 0, 0.10]);
    expect(result.scenarios.length).toBe(3);
    expect(result.scenarios[0].label).toBe('-10%');
    expect(result.scenarios[2].label).toBe('+10%');
  });

  it('all scenarios have valid financial values', () => {
    const result = computeSensitivity(scenario);
    for (const s of result.scenarios) {
      expect(Number.isFinite(s.finalNetWorth)).toBe(true);
      expect(Number.isFinite(s.lifetimeAfterTax)).toBe(true);
      expect(Number.isFinite(s.lifetimeTax)).toBe(true);
      expect(s.lifetimeTax).toBeGreaterThanOrEqual(0);
    }
  });
});
