import { describe, it, expect } from 'vitest';
import { resolveAssumptions } from '../assumptionResolver';
import { DEFAULT_ASSUMPTIONS } from '../../store/defaults';
import type { AssumptionOverrides } from '../../types/scenario';

describe('resolveAssumptions', () => {
  const base = { ...DEFAULT_ASSUMPTIONS };

  it('returns base assumptions unchanged for year 0 (factor=1)', () => {
    const resolved = resolveAssumptions(base, base.startYear, 1);
    expect(resolved.federalBPA).toBe(base.federalBPA);
    expect(resolved.cpp.ympe).toBe(base.cpp.ympe);
    expect(resolved.tfsaAnnualLimit).toBe(base.tfsaAnnualLimit);
    expect(resolved.rrspLimit).toBe(base.rrspLimit);
  });

  it('auto-indexes dollar thresholds by inflation factor', () => {
    // 10 years at 2.5% inflation => factor ~1.28
    const factor = Math.pow(1.025, 10);
    const resolved = resolveAssumptions(base, base.startYear + 10, factor);

    expect(resolved.federalBPA).toBe(Math.round(base.federalBPA * factor));
    expect(resolved.provincialBPA).toBe(Math.round(base.provincialBPA * factor));
    expect(resolved.cpp.ympe).toBe(Math.round(base.cpp.ympe * factor));
    expect(resolved.cpp.yampe).toBe(Math.round(base.cpp.yampe * factor));
    expect(resolved.cpp.basicExemption).toBe(Math.round(base.cpp.basicExemption * factor));
    expect(resolved.ei.maxInsurableEarnings).toBe(Math.round(base.ei.maxInsurableEarnings * factor));
    expect(resolved.rrspLimit).toBe(Math.round(base.rrspLimit * factor));
    // FHSA limits are legislatively fixed — NOT auto-indexed
    expect(resolved.fhsaAnnualLimit).toBe(base.fhsaAnnualLimit);
    expect(resolved.fhsaLifetimeLimit).toBe(base.fhsaLifetimeLimit);
  });

  it('indexes bracket thresholds but keeps rates unchanged', () => {
    const factor = 1.5;
    const resolved = resolveAssumptions(base, base.startYear + 10, factor);

    // Rates should be identical
    for (let i = 0; i < base.federalBrackets.length; i++) {
      expect(resolved.federalBrackets[i].rate).toBe(base.federalBrackets[i].rate);
    }
    // Thresholds should be scaled
    expect(resolved.federalBrackets[0].max).toBe(Math.round(base.federalBrackets[0].max! * factor));
    expect(resolved.federalBrackets[1].min).toBe(Math.round(base.federalBrackets[1].min * factor));
  });

  it('rounds TFSA to nearest $500', () => {
    // base TFSA = 7000, factor = 1.1 => 7700, round to nearest 500 = 7500
    const resolved = resolveAssumptions(base, base.startYear + 5, 1.1);
    expect(resolved.tfsaAnnualLimit % 500).toBe(0);
    expect(resolved.tfsaAnnualLimit).toBe(7500); // 7000 * 1.1 = 7700 → round to 7500

    // factor = 1.15 => 8050 → round to 8000
    const resolved2 = resolveAssumptions(base, base.startYear + 5, 1.15);
    expect(resolved2.tfsaAnnualLimit).toBe(8000);
  });

  it('does not index rates (CPP rate, EI rate, etc.)', () => {
    const factor = 1.5;
    const resolved = resolveAssumptions(base, base.startYear + 10, factor);
    // CPP/EI rates should remain unchanged (they're not dollar thresholds)
    expect(resolved.cpp.employeeRate).toBe(base.cpp.employeeRate);
    expect(resolved.cpp.cpp2Rate).toBe(base.cpp.cpp2Rate);
    expect(resolved.ei.employeeRate).toBe(base.ei.employeeRate);
  });

  it('applies manual overrides on top of auto-indexed values', () => {
    const factor = 1.25;
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear + 5]: {
        rrspLimit: 35000,
        federalBPA: 18000,
      },
    };
    const resolved = resolveAssumptions(base, base.startYear + 5, factor, overrides);

    // Overridden values should use manual values
    expect(resolved.rrspLimit).toBe(35000);
    expect(resolved.federalBPA).toBe(18000);
    // Non-overridden values should still be auto-indexed
    expect(resolved.cpp.ympe).toBe(Math.round(base.cpp.ympe * factor));
  });

  it('manual override for different year does not affect this year', () => {
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear + 3]: { rrspLimit: 35000 },
    };
    const resolved = resolveAssumptions(base, base.startYear + 5, 1.25, overrides);
    // Should be auto-indexed, not 35000
    expect(resolved.rrspLimit).toBe(Math.round(base.rrspLimit * 1.25));
  });

  it('disables auto-indexing when autoIndexAssumptions is false', () => {
    const noIndex = { ...base, autoIndexAssumptions: false };
    const factor = 1.5;
    const resolved = resolveAssumptions(noIndex, noIndex.startYear + 10, factor);

    expect(resolved.federalBPA).toBe(base.federalBPA);
    expect(resolved.cpp.ympe).toBe(base.cpp.ympe);
    expect(resolved.tfsaAnnualLimit).toBe(base.tfsaAnnualLimit);
    expect(resolved.rrspLimit).toBe(base.rrspLimit);
  });

  it('manual overrides still apply when auto-index is off', () => {
    const noIndex = { ...base, autoIndexAssumptions: false };
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear + 5]: { rrspLimit: 40000 },
    };
    const resolved = resolveAssumptions(noIndex, noIndex.startYear + 5, 1.5, overrides);
    expect(resolved.rrspLimit).toBe(40000);
  });

  it('overrides CPP sub-fields individually', () => {
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear + 2]: {
        cppYmpe: 75000,
        cppEmployeeRate: 0.06,
      },
    };
    const resolved = resolveAssumptions(base, base.startYear + 2, 1.05, overrides);
    expect(resolved.cpp.ympe).toBe(75000);
    expect(resolved.cpp.employeeRate).toBe(0.06);
    // Other CPP fields should be auto-indexed
    expect(resolved.cpp.basicExemption).toBe(Math.round(base.cpp.basicExemption * 1.05));
  });

  it('overrides dividend rates', () => {
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear]: {
        dividendEligibleGrossUp: 0.40,
        dividendNonEligibleFederalCredit: 0.10,
      },
    };
    const resolved = resolveAssumptions(base, base.startYear, 1, overrides);
    expect(resolved.dividendRates.eligible.grossUp).toBe(0.40);
    expect(resolved.dividendRates.nonEligible.federalCredit).toBe(0.10);
    // Non-overridden should be unchanged
    expect(resolved.dividendRates.eligible.federalCredit).toBe(base.dividendRates.eligible.federalCredit);
  });

  it('overrides inflation rate for a specific year', () => {
    const overrides: Record<number, AssumptionOverrides> = {
      [base.startYear + 3]: { inflationRate: 0.05 },
    };
    const resolved = resolveAssumptions(base, base.startYear + 3, 1.1, overrides);
    expect(resolved.inflationRate).toBe(0.05);
  });
});
