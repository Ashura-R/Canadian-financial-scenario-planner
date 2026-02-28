import { describe, it, expect } from 'vitest';
import { compute } from '../index';
import { computeAccumulatedTfsaRoom } from '../tfsaRoom';
import { makeTestScenario, makeTestSchedule } from './helpers';

describe('TFSA auto-room calculation', () => {
  it('born 2005, start 2026 → accumulated room = $20,500', () => {
    // Eligible from 2023 (age 18): 2023=$6500, 2024=$7000, 2025=$7000 = $20,500
    const room = computeAccumulatedTfsaRoom(2005, 2026, 7000);
    expect(room).toBe(20500);
  });

  it('born 1990, start 2026 → accumulated room = $102,000 (all years since 2009)', () => {
    // Eligible from 2009 (age 19, but 2009 is first TFSA year and 1990+18=2008 < 2009)
    // 2009-2012: 4×$5000 = $20,000
    // 2013-2014: 2×$5500 = $11,000
    // 2015: $10,000
    // 2016-2018: 3×$5500 = $16,500
    // 2019-2022: 4×$6000 = $24,000
    // 2023: $6,500
    // 2024-2025: 2×$7000 = $14,000
    // Total = 20000+11000+10000+16500+24000+6500+14000 = $102,000
    const room = computeAccumulatedTfsaRoom(1990, 2026, 7000);
    expect(room).toBe(102000);
  });

  it('engine auto-calculates TFSA room when birthYear set and both room/balance are 0', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        birthYear: 2005,
        startYear: 2026,
      },
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
    });
    // Regenerate years for startYear 2026
    scenario.years = [];
    for (let i = 0; i < scenario.assumptions.numYears; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
      });
    }

    const result = compute(scenario);
    // Year 0: opening accumulated room = $20,500, + $7,000 new = $27,500 available
    // No contributions made → tfsaUnusedRoom = 20500 + 7000 - 0 = 27500
    expect(result.years[0].tfsaUnusedRoom).toBe(27500);
  });

  it('TFSA auto-room skipped when tfsaUnusedRoom manually set', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        birthYear: 1990,
        startYear: 2026,
      },
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 5000, capitalLossCF: 0, fhsaContribLifetime: 0 },
    });
    scenario.years = [];
    for (let i = 0; i < scenario.assumptions.numYears; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
      });
    }

    const result = compute(scenario);
    // Manual tfsaUnusedRoom=5000 → auto-calc skipped → room = 5000 + 7000 = 12000
    expect(result.years[0].tfsaUnusedRoom).toBe(12000);
  });

  it('TFSA auto-room skipped when TFSA balance > 0', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        birthYear: 1990,
        startYear: 2026,
      },
      openingBalances: { rrsp: 0, tfsa: 10000, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 0 },
    });
    scenario.years = [];
    for (let i = 0; i < scenario.assumptions.numYears; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
      });
    }

    const result = compute(scenario);
    // tfsa=10000, room=0 → auto-calc skipped → room = 0 + 7000 = 7000
    expect(result.years[0].tfsaUnusedRoom).toBe(7000);
  });
});

describe('FHSA carry-forward', () => {
  it('carry-forward caps at $8k (one year of unused room)', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        startYear: 2026,
        autoIndexAssumptions: false,
      },
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 100, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 100 },
    });
    scenario.years = [];
    for (let i = 0; i < 5; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
        fhsaContribution: 0,
        fhsaDeductionClaimed: 0,
      });
    }

    const result = compute(scenario);
    // Values are end-of-year (after contributions applied):
    // Year 0: unused = min(0 + 8000 - 0, 8000) = 8000
    // Year 1: unused = min(8000 + 8000 - 0, 8000) = 8000 (capped!)
    // Year 2: unused = min(8000 + 8000 - 0, 8000) = 8000 (capped!)
    expect(result.years[0].fhsaUnusedRoom).toBe(8000); // end-of-year unused room
    expect(result.years[1].fhsaUnusedRoom).toBe(8000);
    expect(result.years[2].fhsaUnusedRoom).toBe(8000); // capped at $8k
  });

  it('max single-year FHSA contribution = $16k with $8k carry-forward', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        startYear: 2026,
        autoIndexAssumptions: false,
      },
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 100, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 100 },
    });
    scenario.years = [];
    for (let i = 0; i < 3; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
        // Year 0: no contribution (build carry-forward)
        // Year 1: contribute $16k (annual $8k + carry $8k)
        fhsaContribution: i === 1 ? 16000 : 0,
        fhsaDeductionClaimed: i === 1 ? 16000 : 0,
      });
    }

    const result = compute(scenario);
    // Values are end-of-year:
    // Year 0: unused = min(0+8000-0, 8000) = 8000, lifetime = 100+0 = 100
    // Year 1: unused = min(8000+8000-16000, 8000) = 0, lifetime = 100+16000 = 16100
    expect(result.years[0].fhsaUnusedRoom).toBe(8000);
    expect(result.years[1].fhsaUnusedRoom).toBe(0);
    // Lifetime contribs end-of-year 1: 100 + 16000 = 16100
    expect(result.years[1].fhsaContribLifetime).toBe(16100);
    // Year 2 end-of-year lifetime: 16100 + 0 = 16100
    expect(result.years[2].fhsaContribLifetime).toBe(16100);
  });

  it('FHSA lifetime cap respected', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        startYear: 2026,
        autoIndexAssumptions: false,
      },
      openingBalances: { rrsp: 0, tfsa: 0, fhsa: 30000, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 },
      openingCarryForwards: { rrspUnusedRoom: 0, tfsaUnusedRoom: 0, capitalLossCF: 0, fhsaContribLifetime: 32000 },
    });
    scenario.years = [];
    for (let i = 0; i < 3; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
        fhsaContribution: 8000,
        fhsaDeductionClaimed: 8000,
      });
    }

    const result = compute(scenario);
    // End-of-year values: lifetime starts at 32000, each year contributes 8000
    // Year 0 end-of-year: 32000 + 8000 = 40000
    // Year 1 end-of-year: 40000 + 8000 = 48000 (over limit → warning)
    expect(result.years[0].fhsaContribLifetime).toBe(40000);
    expect(result.years[1].fhsaContribLifetime).toBe(48000);
  });
});

describe('resolved assumptions stored on ComputedYear', () => {
  it('2026 brackets accessible from computed year', () => {
    const scenario = makeTestScenario({
      assumptions: {
        ...makeTestScenario().assumptions,
        startYear: 2026,
      },
    });
    scenario.years = [];
    for (let i = 0; i < 3; i++) {
      scenario.years.push({
        ...makeTestScenario().years[0],
        year: 2026 + i,
      });
    }

    const result = compute(scenario);
    const yr0 = result.years[0];
    expect(yr0.resolvedAssumptions).toBeDefined();
    expect(yr0.resolvedAssumptions!.federalBrackets.length).toBe(5);
    expect(yr0.resolvedAssumptions!.federalBrackets[0].rate).toBe(0.14);
    expect(yr0.resolvedAssumptions!.federalBPA).toBeGreaterThan(16000);
    expect(yr0.resolvedAssumptions!.cppYmpe).toBeGreaterThan(74000);
    expect(yr0.resolvedAssumptions!.eiRate).toBeGreaterThan(0);
    expect(yr0.resolvedAssumptions!.inflationRate).toBe(0.025);
  });
});
