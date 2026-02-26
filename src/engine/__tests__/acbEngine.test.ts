import { describe, it, expect } from 'vitest';
import { computeACB } from '../acbEngine';

describe('computeACB', () => {
  it('opening with no activity preserves ACB', () => {
    // No contributions, no withdrawals, balance grows via returns
    const acb = computeACB(0, 0, 10000, 10000, 11000);
    expect(acb.openingACB).toBe(10000);
    expect(acb.acbAdded).toBe(0);
    expect(acb.acbRemoved).toBe(0);
    expect(acb.closingACB).toBe(10000);
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('contribution increases ACB at cost', () => {
    const acb = computeACB(5000, 0, 10000, 10000, 16000);
    expect(acb.openingACB).toBe(10000);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.closingACB).toBe(15000);
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('withdrawal removes proportional ACB', () => {
    // Opening: 20000 balance, 20000 ACB. 5% return → balance before withdrawal = 21000.
    // Withdraw 10000 → fraction = 10000/21000, ACB removed = 20000 * (10000/21000) ≈ 9523.81
    // Capital gain = 10000 - 9523.81 ≈ 476.19
    const acb = computeACB(0, 10000, 20000, 20000, 11000);
    expect(acb.acbRemoved).toBeCloseTo(9523.81, 0);
    expect(acb.computedCapitalGain).toBeCloseTo(476.19, 0);
    expect(acb.closingACB).toBeCloseTo(10476.19, 0);
  });

  it('full withdrawal removes all ACB', () => {
    // Withdraw everything from account with 10000 ACB, 10500 balance (after 5% return)
    const acb = computeACB(0, 10500, 10000, 10000, 0);
    expect(acb.acbRemoved).toBeCloseTo(10000, 0);
    expect(acb.closingACB).toBeCloseTo(0, 0);
    expect(acb.computedCapitalGain).toBeCloseTo(500, 0);
  });

  it('contribution + withdrawal in same year', () => {
    // Opening: 10000 balance, 10000 ACB. Contribute 5000, withdraw 8000.
    // ACB before withdrawal = 10000 + 5000 = 15000.
    // EOY = 7500 (say returns made 500, then 10000+5000+500-8000=7500).
    // Balance before withdrawal = 10000+5000+500 = 15500.
    // Fraction = 8000/15500.
    // ACB removed = 15000 * (8000/15500) ≈ 7741.94.
    // Capital gain = 8000 - 7741.94 ≈ 258.06.
    const acb = computeACB(5000, 8000, 10000, 10000, 7500);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.closingACB).toBeCloseTo(15000 - 15000 * (8000 / 15500), 0);
    expect(acb.computedCapitalGain).toBeCloseTo(8000 - 15000 * (8000 / 15500), 0);
  });

  it('zero balance with zero ACB returns zeros', () => {
    const acb = computeACB(0, 0, 0, 0, 0);
    expect(acb.openingACB).toBe(0);
    expect(acb.closingACB).toBe(0);
    expect(acb.computedCapitalGain).toBe(0);
    expect(acb.perUnitACB).toBe(0);
  });

  it('perUnitACB is closingACB / EOY balance', () => {
    const acb = computeACB(10000, 0, 0, 0, 10500);
    expect(acb.closingACB).toBe(10000);
    expect(acb.perUnitACB).toBeCloseTo(10000 / 10500, 4);
  });

  it('negative return does not produce negative closing ACB', () => {
    // Opening: 10000 ACB, 10000 balance. -20% return, no withdrawals.
    // EOY = 8000. No withdrawal → no ACB removed.
    const acb = computeACB(0, 0, 10000, 10000, 8000);
    expect(acb.closingACB).toBe(10000);
    expect(acb.computedCapitalGain).toBe(0);
    // Per-unit ACB > 1 means unrealized loss
    expect(acb.perUnitACB).toBeCloseTo(10000 / 8000, 4);
  });
});
