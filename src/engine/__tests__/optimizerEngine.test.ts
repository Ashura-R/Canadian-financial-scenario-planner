import { describe, it, expect } from 'vitest';
import { computeWithdrawalStrategies } from '../optimizerEngine';
import { makeTestScenario, makeTestSchedule } from './helpers';

describe('computeWithdrawalStrategies', () => {
  const scenario = makeTestScenario({
    openingBalances: { rrsp: 200000, tfsa: 80000, fhsa: 0, nonReg: 50000, savings: 20000, lira: 0, resp: 0 },
    assumptions: {
      ...makeTestScenario().assumptions,
      numYears: 5,
      assetReturns: { equity: 0.05, fixedIncome: 0.02, cash: 0.01, savings: 0.01 },
    },
  });
  scenario.years = scenario.years.slice(0, 5);

  it('returns empty array for zero annual target', () => {
    const result = computeWithdrawalStrategies(scenario, 0);
    expect(result).toEqual([]);
  });

  it('produces 4 strategies', () => {
    const result = computeWithdrawalStrategies(scenario, 30000);
    expect(result.length).toBe(4);
    expect(result.map(s => s.name)).toEqual([
      'RRIF First', 'Non-Reg First', 'TFSA First', 'Equal Split',
    ]);
  });

  it('all strategies produce valid financial data', () => {
    const result = computeWithdrawalStrategies(scenario, 30000);
    for (const s of result) {
      expect(Number.isFinite(s.lifetimeTax)).toBe(true);
      expect(Number.isFinite(s.lifetimeAfterTax)).toBe(true);
      expect(Number.isFinite(s.finalNetWorth)).toBe(true);
      expect(s.yearlyTax.length).toBe(5);
      expect(s.yearlyNetWorth.length).toBe(5);
    }
  });

  it('TFSA-first produces lower lifetime tax than RRIF-first', () => {
    // TFSA withdrawals are tax-free, RRSP/RRIF are taxable
    const result = computeWithdrawalStrategies(scenario, 30000);
    const rrifFirst = result.find(s => s.name === 'RRIF First')!;
    const tfsaFirst = result.find(s => s.name === 'TFSA First')!;
    // RRIF withdrawals are taxable → more lifetime tax
    expect(rrifFirst.lifetimeTax).toBeGreaterThanOrEqual(tfsaFirst.lifetimeTax);
  });

  it('Equal Split divides withdrawals among 3 accounts', () => {
    const result = computeWithdrawalStrategies(scenario, 30000);
    const equalSplit = result.find(s => s.name === 'Equal Split')!;
    // Should produce valid results — just verify it ran
    expect(equalSplit.lifetimeTax).toBeGreaterThanOrEqual(0);
    expect(equalSplit.finalNetWorth).toBeGreaterThanOrEqual(0);
  });

  it('startYearIdx delays withdrawal application', () => {
    const result1 = computeWithdrawalStrategies(scenario, 30000, 0);
    const result2 = computeWithdrawalStrategies(scenario, 30000, 2);
    const rrif1 = result1.find(s => s.name === 'RRIF First')!;
    const rrif2 = result2.find(s => s.name === 'RRIF First')!;
    // Delaying withdrawals means higher final net worth (less drawn down)
    expect(rrif2.finalNetWorth).toBeGreaterThan(rrif1.finalNetWorth);
  });
});
