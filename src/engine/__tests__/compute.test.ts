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
      openingBalances: { rrsp: 50000, tfsa: 30000, fhsa: 0, nonReg: 0, savings: 10000, lira: 0, resp: 0, li: 0 },
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
    expect(yr0.accounts.netWorth).toBe(55000 + 30000 + 0 + 0 + 13000 + 0 + 0 + 0);
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

  it('auto-indexed assumptions produce higher RRSP room over time', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        autoIndexAssumptions: true,
        inflationRate: 0.025,
        numYears: 10,
      },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0, priorYearEarnedIncome: 200000 },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 200000, startYear: 2025 }),
      ],
    });
    // Adjust years array to match numYears
    scenario.years = scenario.years.slice(0, 10);

    const result = compute(scenario);
    // RRSP room generated in year 0 should use base rrspLimit
    // RRSP room in later years should use indexed limit (higher)
    // Since income is 200K > rrspLimit, room = rrspLimit each year
    // With indexing, year 5 limit should be higher than year 0 limit
    const yr0Room = result.years[0].rrspUnusedRoom;
    // By year 5, accumulated room should reflect indexed limits
    const yr5Room = result.years[5].rrspUnusedRoom;
    // Room grows each year because indexed limit increases
    expect(yr5Room).toBeGreaterThan(yr0Room);
  });

  it('per-year assumption override changes tax for that year', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 100000, startYear: 2026 }),
      ],
      assumptionOverrides: {
        2028: { federalBPA: 25000 }, // Much higher BPA → lower tax
      },
    });

    const result = compute(scenario);
    const yr2026 = result.years.find(y => y.year === 2026)!;
    const yr2028 = result.years.find(y => y.year === 2028)!;

    // Year 2028 should have lower tax due to higher BPA
    expect(yr2028.tax.totalIncomeTax).toBeLessThan(yr2026.tax.totalIncomeTax);
  });

  it('living expenses reduce net cash flow', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 100000, startYear: 2025 }),
        makeTestSchedule({ field: 'housingExpense', amount: 24000, startYear: 2025 }),
        makeTestSchedule({ field: 'groceriesExpense', amount: 6000, startYear: 2025 }),
        makeTestSchedule({ field: 'transportationExpense', amount: 3000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];

    // Total living expenses should be 33000
    expect(yr0.waterfall.totalLivingExpenses).toBe(33000);
    // afterExpenses = afterTaxIncome - 33000
    expect(yr0.waterfall.afterExpenses).toBeCloseTo(yr0.waterfall.afterTaxIncome - 33000, 2);
    // netCashFlow should be less than afterTaxIncome by at least 33000
    expect(yr0.waterfall.netCashFlow).toBeLessThan(yr0.waterfall.afterTaxIncome - 30000);
  });

  it('zero expenses produce afterExpenses === afterTaxIncome', () => {
    const scenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    expect(yr0.waterfall.totalLivingExpenses).toBe(0);
    expect(yr0.waterfall.afterExpenses).toBe(yr0.waterfall.afterTaxIncome);
  });

  it('PnL tracks book value and unrealized gains', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 10000, tfsa: 5000, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        assetReturns: { equity: 0.10, fixedIncome: 0, cash: 0, savings: 0 },
      },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 80000, startYear: 2025 }),
        makeTestSchedule({ field: 'rrspContribution', amount: 5000, startYear: 2025 }),
        makeTestSchedule({ field: 'rrspDeductionClaimed', amount: 5000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];

    expect(yr0.pnl).toBeDefined();
    const pnl = yr0.pnl!;

    // RRSP: opened with 10000, contributed 5000, no withdrawals, 10% return
    // Book value = 10000 + 5000 = 15000
    expect(pnl.rrsp.bookValue).toBe(15000);
    // Market value = (10000 + 5000) * 1.10 = 16500
    expect(pnl.rrsp.marketValue).toBe(16500);
    // Gain = 1500
    expect(pnl.rrsp.gain).toBe(1500);
    expect(pnl.rrsp.returnPct).toBeCloseTo(0.10, 2);

    // TFSA: opened with 5000, no contributions, 10% return
    expect(pnl.tfsa.bookValue).toBe(5000);
    expect(pnl.tfsa.marketValue).toBe(5500);
    expect(pnl.tfsa.gain).toBe(500);

    // Totals
    expect(pnl.totalBookValue).toBe(20000);
    expect(pnl.totalMarketValue).toBe(22000);
    expect(pnl.totalGain).toBe(2000);
  });

  it('PnL proportional withdrawal reduces book value correctly', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 0, tfsa: 20000, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        assetReturns: { equity: 0.10, fixedIncome: 0, cash: 0, savings: 0 },
      },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2026 }),
        makeTestSchedule({ field: 'tfsaWithdrawal', amount: 10000, startYear: 2026, endYear: 2026 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];
    const pnl = yr0.pnl!;

    // TFSA: opening 20000, withdraw 10000, 10% return on (20000-10000)=10000 → EOY = 11000
    // Balance before withdrawal = 20000 + (11000 - 20000 + 10000) = 21000
    // Withdrawal fraction = 10000/21000
    // Book removed = 20000 * (10000/21000) ≈ 9523.81
    // Book value = 20000 - 9523.81 ≈ 10476.19
    expect(pnl.tfsa.bookValue).toBeCloseTo(10476.19, 0);
    expect(pnl.tfsa.marketValue).toBe(11000);
    expect(pnl.tfsa.gain).toBeCloseTo(11000 - 10476.19, 0);
  });

  it('return sequence overrides global asset returns', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 100000, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 3,
        assetReturns: { equity: 0.05, fixedIncome: 0, cash: 0, savings: 0 },
      },
      returnSequence: {
        enabled: true,
        equity: [0.10, -0.05, 0.15],    // override: 10%, -5%, 15%
        fixedIncome: [0, 0, 0],
        cash: [0, 0, 0],
        savings: [0, 0, 0],
      },
    });
    scenario.years = scenario.years.slice(0, 3);

    const result = compute(scenario);
    // Year 0: RRSP = 100000 * 1.10 = 110000
    expect(result.years[0].accounts.rrspEOY).toBeCloseTo(110000, 0);
    // Year 1: RRSP = 110000 * 0.95 = 104500
    expect(result.years[1].accounts.rrspEOY).toBeCloseTo(104500, 0);
    // Year 2: RRSP = 104500 * 1.15 = 120175
    expect(result.years[2].accounts.rrspEOY).toBeCloseTo(120175, 0);
  });

  it('auto-indexing disabled keeps all years at base values', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        autoIndexAssumptions: false,
        inflationRate: 0.05, // high inflation to make difference obvious
        numYears: 10,
      },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0, priorYearEarnedIncome: 200000 },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 200000, startYear: 2025 }),
      ],
    });
    scenario.years = scenario.years.slice(0, 10);

    const result = compute(scenario);
    // With auto-index off and same income, RRSP room generated each year should be the same (base limit)
    // Room accumulates linearly since limit doesn't change
    const baseLimit = scenario.assumptions.rrspLimit;
    // Year 1 room = baseLimit (from priorYearEarnedIncome 200K * 18% = 36K capped at baseLimit)
    const yr1Room = result.years[1].rrspUnusedRoom;
    expect(yr1Room).toBeCloseTo(baseLimit, 0);
    // Year 2 should be 2 * baseLimit
    const yr2Room = result.years[2].rrspUnusedRoom;
    expect(yr2Room).toBeCloseTo(2 * baseLimit, 0);
  });

  it('life insurance cash value tracks across years', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 50000 },
      assumptions: {
        ...makeTestScenario().assumptions,
        numYears: 3,
      },
      scheduledItems: [
        makeTestSchedule({ field: 'liPremium', amount: 5000, startYear: 2025 }),
        makeTestSchedule({ field: 'liCOI', amount: 1000, startYear: 2025 }),
      ],
    });
    scenario.years = scenario.years.slice(0, 3);

    const result = compute(scenario);
    // Year 0: (50000 + 5000 - 1000) * 1.0 = 54000 (0% returns by default)
    expect(result.years[0].accounts.liCashValueEOY).toBe(54000);
    // Year 1: (54000 + 5000 - 1000) * 1.0 = 58000
    expect(result.years[1].accounts.liCashValueEOY).toBe(58000);
    // Year 2: (58000 + 5000 - 1000) * 1.0 = 62000
    expect(result.years[2].accounts.liCashValueEOY).toBe(62000);
  });

  it('insurance surrender gain flows into taxable income with ACB', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 50000 },
      acbConfig: { autoComputeGains: true, openingACB: 0, liOpeningACB: 20000 },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2026 }),
        makeTestSchedule({ field: 'liWithdrawal', amount: 10000, startYear: 2026, endYear: 2026 }),
      ],
    });

    const result = compute(scenario);
    const yr0 = result.years[0];

    // ACB should be computed
    expect(yr0.acb).toBeDefined();
    expect(yr0.acb!.insurance).toBeDefined();

    // Withdrawal 10000 from cash value 50000, ACB 20000
    // Fraction = 10000/50000 = 0.2
    // ACB removed = 20000 * 0.2 = 4000
    // Surrender gain = 10000 - 4000 = 6000
    expect(yr0.acb!.insurance!.computedSurrenderGain).toBeCloseTo(6000, 0);

    // Surrender gain flows into tax computation (via ydForTax.otherTaxableIncome)
    // so total tax should be higher than if there were no surrender gain
    const baseScenario = makeTestScenario({
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2026 }),
      ],
    });
    const baseResult = compute(baseScenario);
    expect(yr0.tax.totalIncomeTax).toBeGreaterThan(baseResult.years[0].tax.totalIncomeTax);
  });

  it('PnL includes life insurance account', () => {
    const scenario = makeTestScenario({
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 30000 },
      assumptions: {
        ...makeTestScenario().assumptions,
        assetReturns: { equity: 0.10, fixedIncome: 0.05, cash: 0, savings: 0 },
      },
      scheduledItems: [
        makeTestSchedule({ field: 'employmentIncome', amount: 50000, startYear: 2025 }),
        makeTestSchedule({ field: 'liPremium', amount: 5000, startYear: 2025 }),
      ],
    });

    const result = compute(scenario);
    const pnl = result.years[0].pnl!;

    expect(pnl.li).toBeDefined();
    // Book value = 30000 + 5000 = 35000 (opening + premium)
    expect(pnl.li.bookValue).toBe(35000);
    // Market value = (30000 + 5000) * (1 + 0.05) = 36750 (default liFixedPct = 1)
    expect(pnl.li.marketValue).toBeCloseTo(36750, 0);
    expect(pnl.li.gain).toBeCloseTo(1750, 0);
  });
});
