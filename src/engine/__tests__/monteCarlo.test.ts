import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../monteCarloEngine';
import { makeTestScenario, makeTestSchedule } from './helpers';
import type { MonteCarloConfig } from '../../types/scenario';

function makeConfig(overrides: Partial<MonteCarloConfig> = {}): MonteCarloConfig {
  return {
    enabled: true,
    numTrials: overrides.numTrials ?? 50,
    seed: overrides.seed ?? 42,
    equity: overrides.equity ?? { mean: 0.07, stdDev: 0.15 },
    fixedIncome: overrides.fixedIncome ?? { mean: 0.03, stdDev: 0.05 },
    cash: overrides.cash ?? { mean: 0.02, stdDev: 0.01 },
    savings: overrides.savings ?? { mean: 0.015, stdDev: 0.005 },
  };
}

describe('Monte Carlo Engine', () => {
  it('produces correct structure with expected number of years', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 5,
        assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0.02, savings: 0.015 },
      },
    });
    scenario.years = scenario.years.slice(0, 5);

    const result = runMonteCarlo(scenario, makeConfig({ numTrials: 20 }));

    expect(result.numTrials).toBe(20);
    expect(result.years.length).toBe(5);
    expect(result.netWorth.p10.length).toBe(5);
    expect(result.netWorth.p50.length).toBe(5);
    expect(result.netWorth.p90.length).toBe(5);
    expect(result.afterTaxIncome.p50.length).toBe(5);
    expect(result.finalNetWorthDistribution.length).toBe(20);
  });

  it('seeded runs are reproducible', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 50000, tfsa: 20000, fhsa: 0, nonReg: 10000, savings: 5000, lira: 0, resp: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 5,
        assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0.02, savings: 0.015 },
      },
    });
    scenario.years = scenario.years.slice(0, 5);

    const config = makeConfig({ numTrials: 30, seed: 12345 });
    const run1 = runMonteCarlo(scenario, config);
    const run2 = runMonteCarlo(scenario, config);

    expect(run1.finalNetWorthStats.median).toBe(run2.finalNetWorthStats.median);
    expect(run1.netWorth.p50).toEqual(run2.netWorth.p50);
  });

  it('percentile bands are ordered correctly (p10 <= p25 <= p50 <= p75 <= p90)', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 100000, tfsa: 50000, fhsa: 0, nonReg: 30000, savings: 10000, lira: 0, resp: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 10,
        assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0.02, savings: 0.015 },
      },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
      ],
    });
    scenario.years = scenario.years.slice(0, 10);

    const result = runMonteCarlo(scenario, makeConfig({ numTrials: 100 }));

    for (let i = 0; i < result.years.length; i++) {
      expect(result.netWorth.p10[i]).toBeLessThanOrEqual(result.netWorth.p25[i]);
      expect(result.netWorth.p25[i]).toBeLessThanOrEqual(result.netWorth.p50[i]);
      expect(result.netWorth.p50[i]).toBeLessThanOrEqual(result.netWorth.p75[i]);
      expect(result.netWorth.p75[i]).toBeLessThanOrEqual(result.netWorth.p90[i]);
    }
  });

  it('zero stdDev produces deterministic results (all percentiles equal)', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 50000, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 3,
        assetReturns: { equity: 0.05, fixedIncome: 0, cash: 0, savings: 0 },
      },
    });
    scenario.years = scenario.years.slice(0, 3);

    const config = makeConfig({
      numTrials: 20,
      equity: { mean: 0.05, stdDev: 0 },
      fixedIncome: { mean: 0, stdDev: 0 },
      cash: { mean: 0, stdDev: 0 },
      savings: { mean: 0, stdDev: 0 },
    });

    const result = runMonteCarlo(scenario, config);

    // With zero variance, all trials produce identical results
    for (let i = 0; i < result.years.length; i++) {
      expect(result.netWorth.p10[i]).toBeCloseTo(result.netWorth.p90[i], 2);
      expect(result.netWorth.p25[i]).toBeCloseTo(result.netWorth.p75[i], 2);
    }
  });

  it('higher stdDev produces wider bands', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 100000, tfsa: 50000, fhsa: 0, nonReg: 50000, savings: 0, lira: 0, resp: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 10,
        assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0, savings: 0 },
      },
    });
    scenario.years = scenario.years.slice(0, 10);

    const narrow = runMonteCarlo(scenario, makeConfig({
      numTrials: 100, seed: 42,
      equity: { mean: 0.07, stdDev: 0.05 },
      fixedIncome: { mean: 0.03, stdDev: 0.02 },
    }));

    const wide = runMonteCarlo(scenario, makeConfig({
      numTrials: 100, seed: 42,
      equity: { mean: 0.07, stdDev: 0.25 },
      fixedIncome: { mean: 0.03, stdDev: 0.10 },
    }));

    // At the last year, the wider distribution should have a larger spread
    const lastIdx = 9;
    const narrowSpread = narrow.netWorth.p90[lastIdx] - narrow.netWorth.p10[lastIdx];
    const wideSpread = wide.netWorth.p90[lastIdx] - wide.netWorth.p10[lastIdx];
    expect(wideSpread).toBeGreaterThan(narrowSpread);
  });

  it('caps numTrials at 2000', () => {
    const scenario = makeTestScenario({
      assumptions: { ...makeTestScenario().assumptions, numYears: 2 },
    });
    scenario.years = scenario.years.slice(0, 2);

    const result = runMonteCarlo(scenario, makeConfig({ numTrials: 5000 }));
    expect(result.numTrials).toBe(2000);
  });
});
