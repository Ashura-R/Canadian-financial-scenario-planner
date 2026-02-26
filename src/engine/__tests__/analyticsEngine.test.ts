import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../analyticsEngine';
import { compute } from '../index';
import { makeTestScenario, makeTestSchedule } from './helpers';

describe('computeAnalytics', () => {
  it('cumulative sums are running totals', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 60000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const { analytics, years } = result;

    let runningCF = 0;
    let runningTax = 0;
    let runningAfterTax = 0;
    for (let i = 0; i < years.length; i++) {
      runningCF += years[i].waterfall.netCashFlow;
      runningTax += years[i].tax.totalIncomeTax;
      runningAfterTax += years[i].waterfall.afterTaxIncome;

      expect(analytics.cumulativeCashFlow[i]).toBeCloseTo(runningCF, 2);
      expect(analytics.cumulativeTotalTax[i]).toBeCloseTo(runningTax, 2);
      expect(analytics.cumulativeAfterTaxIncome[i]).toBeCloseTo(runningAfterTax, 2);
    }
  });

  it('lifetime averages divide by total gross income', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const { analytics } = result;

    expect(analytics.lifetimeAvgTaxRate).toBeCloseTo(
      analytics.lifetimeTotalTax / analytics.lifetimeGrossIncome, 6
    );
    expect(analytics.lifetimeAvgAllInRate).toBeCloseTo(
      (analytics.lifetimeTotalTax + analytics.lifetimeCPPEI) / analytics.lifetimeGrossIncome, 6
    );
  });

  it('real cumulative cash flow uses inflation factor', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const { analytics, years } = result;

    let runningRealCF = 0;
    for (let i = 0; i < years.length; i++) {
      runningRealCF += years[i].realNetCashFlow;
      expect(analytics.cumulativeRealCashFlow[i]).toBeCloseTo(runningRealCF, 2);
    }

    // Real values should be smaller than nominal for positive cash flows (inflation erodes)
    const lastNominal = analytics.cumulativeCashFlow[analytics.cumulativeCashFlow.length - 1];
    const lastReal = analytics.cumulativeRealCashFlow[analytics.cumulativeRealCashFlow.length - 1];
    if (lastNominal > 0) {
      expect(lastReal).toBeLessThan(lastNominal);
    }
  });

  it('zero-income scenario has zero analytics', () => {
    const scenario = makeTestScenario();
    const result = compute(scenario);
    const { analytics } = result;

    expect(analytics.lifetimeGrossIncome).toBe(0);
    expect(analytics.lifetimeTotalTax).toBe(0);
    expect(analytics.lifetimeAvgTaxRate).toBe(0);
  });
});
