import { describe, it, expect } from 'vitest';
import { computeCPPDeferral, computeOASDeferral } from '../retirementAnalysis';

describe('computeCPPDeferral', () => {
  const monthlyAt65 = 1000;

  it('produces 11 scenarios (ages 60-70)', () => {
    const results = computeCPPDeferral(monthlyAt65);
    expect(results.length).toBe(11);
    expect(results[0].startAge).toBe(60);
    expect(results[10].startAge).toBe(70);
  });

  it('age 65 has 0% adjustment', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at65 = results.find(r => r.startAge === 65)!;
    expect(at65.adjustmentPct).toBe(0);
    expect(at65.monthlyAmount).toBe(1000);
    expect(at65.annualAmount).toBe(12000);
  });

  it('age 60 has -36% adjustment (5 years × -7.2%)', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at60 = results.find(r => r.startAge === 60)!;
    expect(at60.adjustmentPct).toBeCloseTo(-0.36, 4);
    expect(at60.monthlyAmount).toBeCloseTo(640, 0);
  });

  it('age 70 has +42% adjustment (5 years × +8.4%)', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at70 = results.find(r => r.startAge === 70)!;
    expect(at70.adjustmentPct).toBeCloseTo(0.42, 4);
    expect(at70.monthlyAmount).toBeCloseTo(1420, 0);
  });

  it('cumulative for age 60 starts accumulating at age 60', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at60 = results.find(r => r.startAge === 60)!;
    // Index 0 = age 60, should have received 1 year
    expect(at60.cumulativeByAge[0]).toBeCloseTo(at60.annualAmount, 0);
    // Before start (N/A for age 60 since it starts at index 0)
  });

  it('cumulative for age 70 is zero until age 70', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at70 = results.find(r => r.startAge === 70)!;
    // Index 0-9 (ages 60-69) should be 0
    for (let i = 0; i < 10; i++) {
      expect(at70.cumulativeByAge[i]).toBe(0);
    }
    // Index 10 (age 70) should have received 1 year
    expect(at70.cumulativeByAge[10]).toBeCloseTo(at70.annualAmount, 0);
  });

  it('break-even ages are computed for deferred scenarios', () => {
    const results = computeCPPDeferral(monthlyAt65);
    const at70 = results.find(r => r.startAge === 70)!;
    // At70 should eventually break even vs 65
    expect(at70.breakEvenVs65).not.toBeNull();
    expect(at70.breakEvenVs65!).toBeGreaterThan(70);
    expect(at70.breakEvenVs65!).toBeLessThan(90);
  });

  it('inflation increases cumulative amounts over time', () => {
    const noInflation = computeCPPDeferral(monthlyAt65, 0);
    const withInflation = computeCPPDeferral(monthlyAt65, 0.02);
    const at65_noInf = noInflation.find(r => r.startAge === 65)!;
    const at65_inf = withInflation.find(r => r.startAge === 65)!;
    // At age 90, cumulative with inflation should be higher
    const lastIdx = at65_noInf.cumulativeByAge.length - 1;
    expect(at65_inf.cumulativeByAge[lastIdx]).toBeGreaterThan(at65_noInf.cumulativeByAge[lastIdx]);
  });
});

describe('computeOASDeferral', () => {
  const monthlyAt65 = 700;

  it('produces 6 scenarios (ages 65-70)', () => {
    const results = computeOASDeferral(monthlyAt65);
    expect(results.length).toBe(6);
    expect(results[0].startAge).toBe(65);
    expect(results[5].startAge).toBe(70);
  });

  it('age 65 has 0% adjustment', () => {
    const results = computeOASDeferral(monthlyAt65);
    const at65 = results.find(r => r.startAge === 65)!;
    expect(at65.adjustmentPct).toBe(0);
    expect(at65.monthlyAmount).toBe(700);
  });

  it('age 70 has +36% adjustment (5 years × +7.2%)', () => {
    const results = computeOASDeferral(monthlyAt65);
    const at70 = results.find(r => r.startAge === 70)!;
    expect(at70.adjustmentPct).toBeCloseTo(0.36, 4);
    expect(at70.monthlyAmount).toBeCloseTo(952, 0);
  });

  it('cumulative for age 65 starts at index 0', () => {
    const results = computeOASDeferral(monthlyAt65);
    const at65 = results.find(r => r.startAge === 65)!;
    expect(at65.cumulativeByAge[0]).toBeCloseTo(at65.annualAmount, 0);
  });

  it('deferred scenarios have break-even ages', () => {
    const results = computeOASDeferral(monthlyAt65);
    const at70 = results.find(r => r.startAge === 70)!;
    expect(at70.breakEvenVs65).not.toBeNull();
    expect(at70.breakEvenVs65!).toBeGreaterThan(70);
  });
});
