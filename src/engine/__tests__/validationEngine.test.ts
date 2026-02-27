import { describe, it, expect } from 'vitest';
import { validateYear } from '../validationEngine';
import { makeDefaultYear, makeDefaultScenario } from '../../store/defaults';
import type { YearData, Assumptions, OpeningBalances } from '../../types/scenario';

function baseYd(): YearData {
  return makeDefaultYear(2025);
}

function baseAss(): Assumptions {
  return makeDefaultScenario('Test').assumptions;
}

function baseBal(): OpeningBalances {
  return { rrsp: 50000, tfsa: 30000, fhsa: 8000, nonReg: 20000, savings: 10000, lira: 0, resp: 0, li: 0 };
}

describe('validateYear', () => {
  // === Negative value checks ===
  it('flags negative employment income', () => {
    const yd = { ...baseYd(), employmentIncome: -1000 };
    const warnings = validateYear(yd, baseAss(), 10000, 0, 0);
    expect(warnings.some(w => w.field === 'employmentIncome' && w.severity === 'error')).toBe(true);
  });

  it('flags negative RRSP contribution', () => {
    const yd = { ...baseYd(), rrspContribution: -500 };
    const warnings = validateYear(yd, baseAss(), 10000, 0, 0);
    expect(warnings.some(w => w.field === 'rrspContribution' && w.severity === 'error')).toBe(true);
  });

  it('no warnings for valid zero-value year', () => {
    const warnings = validateYear(baseYd(), baseAss(), 10000, 0, 0);
    const errors = warnings.filter(w => w.severity === 'error');
    expect(errors.length).toBe(0);
  });

  // === Withdrawal exceeds balance ===
  it('flags RRSP withdrawal exceeding balance', () => {
    const yd = { ...baseYd(), rrspWithdrawal: 60000 };
    const warnings = validateYear(yd, baseAss(), 10000, 0, 0, Infinity, baseBal());
    expect(warnings.some(w => w.field === 'rrspWithdrawal' && w.severity === 'error')).toBe(true);
  });

  it('flags withdrawal from zero-balance RRSP', () => {
    const yd = { ...baseYd(), rrspWithdrawal: 1000 };
    const bal = { ...baseBal(), rrsp: 0 };
    const warnings = validateYear(yd, baseAss(), 10000, 0, 0, Infinity, bal);
    expect(warnings.some(w => w.field === 'rrspWithdrawal' && w.message.includes('$0'))).toBe(true);
  });

  it('flags TFSA withdrawal exceeding balance', () => {
    const yd = { ...baseYd(), tfsaWithdrawal: 50000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0, Infinity, baseBal());
    expect(warnings.some(w => w.field === 'tfsaWithdrawal' && w.severity === 'error')).toBe(true);
  });

  it('flags savings withdrawal exceeding balance', () => {
    const yd = { ...baseYd(), savingsWithdrawal: 20000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0, Infinity, baseBal());
    expect(warnings.some(w => w.field === 'savingsWithdrawal' && w.severity === 'error')).toBe(true);
  });

  // === RRSP room check ===
  it('flags RRSP contribution exceeding room (with $2K buffer)', () => {
    const yd = { ...baseYd(), rrspContribution: 15000, employmentIncome: 0 };
    // rrspUnusedRoom = 5000, no earned income → total room = 5000, buffer = 7000
    const warnings = validateYear(yd, baseAss(), 5000, 0, 0);
    expect(warnings.some(w => w.field === 'rrspContribution' && w.severity === 'error')).toBe(true);
  });

  it('allows RRSP contribution within $2K buffer', () => {
    const yd = { ...baseYd(), rrspContribution: 6500, employmentIncome: 0 };
    // room = 5000, buffer = 7000, contrib 6500 < 7000 → ok
    const warnings = validateYear(yd, baseAss(), 5000, 0, 0);
    const rrspErrors = warnings.filter(w => w.field === 'rrspContribution' && w.severity === 'error');
    expect(rrspErrors.length).toBe(0);
  });

  // === RRSP contribution after RRIF ===
  it('flags RRSP contribution after RRIF conversion', () => {
    const yd = { ...baseYd(), rrspContribution: 1000 };
    const warnings = validateYear(yd, baseAss(), 50000, 0, 0, Infinity, undefined, true);
    expect(warnings.some(w => w.field === 'rrspContribution' && w.message.includes('RRIF'))).toBe(true);
  });

  // === TFSA room check ===
  it('flags TFSA contribution exceeding available room', () => {
    const yd = { ...baseYd(), tfsaContribution: 10000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0, 7000);
    expect(warnings.some(w => w.field === 'tfsaContribution' && w.severity === 'error')).toBe(true);
  });

  // === FHSA checks ===
  it('flags FHSA contribution exceeding annual + carry-forward room', () => {
    const yd = { ...baseYd(), fhsaContribution: 20000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0, Infinity, undefined, false, false, 8000);
    expect(warnings.some(w => w.field === 'fhsaContribution' && w.severity === 'error')).toBe(true);
  });

  it('flags FHSA contribution exceeding lifetime limit', () => {
    const yd = { ...baseYd(), fhsaContribution: 8000 };
    // lifetime already at 35000, limit is 40000, 35000 + 8000 = 43000 > 40000
    const warnings = validateYear(yd, baseAss(), 0, 35000, 0, Infinity, undefined, false, false, 8000);
    expect(warnings.some(w => w.field === 'fhsaContribution' && w.message.includes('lifetime'))).toBe(true);
  });

  it('flags FHSA contribution after disposition', () => {
    const yd = { ...baseYd(), fhsaContribution: 1000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0, Infinity, undefined, false, true);
    expect(warnings.some(w => w.field === 'fhsaContribution' && w.message.includes('disposed'))).toBe(true);
  });

  // === Capital loss applied ===
  it('flags capital loss applied exceeding carry-forward', () => {
    const yd = { ...baseYd(), capitalLossApplied: 10000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 3000);
    expect(warnings.some(w => w.field === 'capitalLossApplied' && w.severity === 'error')).toBe(true);
  });

  // === Simultaneous contribution + withdrawal ===
  it('warns on simultaneous RRSP contribution and withdrawal', () => {
    const yd = { ...baseYd(), rrspContribution: 5000, rrspWithdrawal: 3000 };
    const warnings = validateYear(yd, baseAss(), 50000, 0, 0);
    expect(warnings.some(w => w.severity === 'warning' && w.message.includes('Contributing and withdrawing'))).toBe(true);
  });

  it('warns on simultaneous TFSA contribution and withdrawal', () => {
    const yd = { ...baseYd(), tfsaContribution: 5000, tfsaWithdrawal: 3000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0);
    expect(warnings.some(w => w.severity === 'warning' && w.message.includes('TFSA'))).toBe(true);
  });

  // === Asset allocation checks ===
  it('warns when asset allocation does not sum to 100%', () => {
    const yd = { ...baseYd(), rrspEquityPct: 0.5, rrspFixedPct: 0.3, rrspCashPct: 0.1 }; // 90%
    const warnings = validateYear(yd, baseAss(), 0, 0, 0);
    expect(warnings.some(w => w.message.includes('RRSP') && w.message.includes('100%'))).toBe(true);
  });

  it('no allocation warning when sum is 100%', () => {
    const yd = { ...baseYd(), rrspEquityPct: 0.6, rrspFixedPct: 0.3, rrspCashPct: 0.1 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0);
    const allocWarnings = warnings.filter(w => w.message.includes('RRSP') && w.message.includes('100%'));
    expect(allocWarnings.length).toBe(0);
  });

  // === EOY override indicators ===
  it('warns when EOY overrides are active', () => {
    const yd = { ...baseYd(), rrspEOYOverride: 100000 };
    const warnings = validateYear(yd, baseAss(), 0, 0, 0);
    expect(warnings.some(w => w.field === 'rrspEOYOverride' && w.severity === 'warning')).toBe(true);
  });

  // === FHSA 15-year / age-71 limit ===
  it('warns when FHSA is nearing 15-year limit', () => {
    // fhsaOpeningYear=2010, year=2025 → yearsOpen=15 >= 14 → triggers warning
    const warnings = validateYear(
      baseYd(), baseAss(), 0, 0, 0, Infinity, undefined,
      /* isRRIF */ false, /* fhsaDisposed */ false, /* fhsaUnusedRoom */ 0,
      /* fhsaOpeningYear */ 2010, /* age */ null, /* year */ 2025,
    );
    expect(warnings.some(w => w.message.includes('open') && w.message.includes('year'))).toBe(true);
  });

  it('warns when holder is age 70+', () => {
    const warnings = validateYear(
      baseYd(), baseAss(), 0, 0, 0, Infinity, undefined,
      /* isRRIF */ false, /* fhsaDisposed */ false, /* fhsaUnusedRoom */ 0,
      /* fhsaOpeningYear */ 2020, /* age */ 71, /* year */ 2025,
    );
    expect(warnings.some(w => w.message.includes('71'))).toBe(true);
  });
});
