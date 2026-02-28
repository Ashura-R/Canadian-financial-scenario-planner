import { describe, it, expect } from 'vitest';
import { computeACB, computeInsuranceACB } from '../acbEngine';

describe('computeACB', () => {
  it('opening with no activity preserves ACB', () => {
    // No contributions, no withdrawals, balance grows via returns
    const acb = computeACB(0, 0, 0, 0, 10000, 10000, 11000);
    expect(acb.openingACB).toBe(10000);
    expect(acb.acbAdded).toBe(0);
    expect(acb.acbRemoved).toBe(0);
    expect(acb.closingACB).toBe(10000);
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('contribution increases ACB at cost', () => {
    const acb = computeACB(5000, 0, 0, 0, 10000, 10000, 16000);
    expect(acb.openingACB).toBe(10000);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.closingACB).toBe(15000);
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('withdrawal removes proportional ACB', () => {
    // Opening: 20000 balance, 20000 ACB. 5% return → balance before withdrawal = 21000.
    // Withdraw 10000 → fraction = 10000/21000, ACB removed = 20000 * (10000/21000) ≈ 9523.81
    const acb = computeACB(0, 10000, 0, 0, 20000, 20000, 11000);
    expect(acb.acbRemoved).toBeCloseTo(9523.81, 0);
    // No realized gains specified → computedCapitalGain = 0
    expect(acb.computedCapitalGain).toBe(0);
    expect(acb.closingACB).toBeCloseTo(10476.19, 0);
  });

  it('full withdrawal removes all ACB', () => {
    // Withdraw everything from account with 10000 ACB, 10500 balance (after 5% return)
    const acb = computeACB(0, 10500, 0, 0, 10000, 10000, 0);
    expect(acb.acbRemoved).toBeCloseTo(10000, 0);
    expect(acb.closingACB).toBeCloseTo(0, 0);
    // No realized gains specified
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('contribution + withdrawal in same year', () => {
    // Opening: 10000 balance, 10000 ACB. Contribute 5000, withdraw 8000.
    // ACB before withdrawal = 10000 + 5000 = 15000.
    // EOY = 7500 (say returns made 500, then 10000+5000+500-8000=7500).
    // Balance before withdrawal = 10000+5000+500 = 15500.
    // Fraction = 8000/15500.
    // ACB removed = 15000 * (8000/15500) ≈ 7741.94.
    const acb = computeACB(5000, 8000, 0, 0, 10000, 10000, 7500);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.closingACB).toBeCloseTo(15000 - 15000 * (8000 / 15500), 0);
    // No realized gains specified
    expect(acb.computedCapitalGain).toBe(0);
  });

  it('zero balance with zero ACB returns zeros', () => {
    const acb = computeACB(0, 0, 0, 0, 0, 0, 0);
    expect(acb.openingACB).toBe(0);
    expect(acb.closingACB).toBe(0);
    expect(acb.computedCapitalGain).toBe(0);
    expect(acb.perUnitACB).toBe(0);
  });

  it('perUnitACB is closingACB / EOY balance', () => {
    const acb = computeACB(10000, 0, 0, 0, 0, 0, 10500);
    expect(acb.closingACB).toBe(10000);
    expect(acb.perUnitACB).toBeCloseTo(10000 / 10500, 4);
  });

  it('negative return does not produce negative closing ACB', () => {
    // Opening: 10000 ACB, 10000 balance. -20% return, no withdrawals.
    // EOY = 8000. No withdrawal → no ACB removed.
    const acb = computeACB(0, 0, 0, 0, 10000, 10000, 8000);
    expect(acb.closingACB).toBe(10000);
    expect(acb.computedCapitalGain).toBe(0);
    // Per-unit ACB > 1 means unrealized loss
    expect(acb.perUnitACB).toBeCloseTo(10000 / 8000, 4);
  });

  // New tests for decoupled realized gains/losses

  it('realized gain specified without withdrawal (sold inside account, cash stays)', () => {
    // Opening: 20000 balance, 15000 ACB. Sold some holdings at a $3000 gain but kept cash in account.
    const acb = computeACB(0, 0, 3000, 0, 15000, 20000, 20000);
    expect(acb.computedCapitalGain).toBe(3000);
    expect(acb.acbRemoved).toBe(0); // no withdrawal → no ACB removed
    expect(acb.closingACB).toBe(15000);
  });

  it('realized loss specified without withdrawal', () => {
    // Sold some holdings at a $2000 loss but kept cash in account.
    const acb = computeACB(0, 0, 0, 2000, 15000, 20000, 18000);
    expect(acb.computedCapitalGain).toBe(-2000);
    expect(acb.acbRemoved).toBe(0);
    expect(acb.closingACB).toBe(15000);
  });

  it('withdrawal with no realized gain (just taking cash out)', () => {
    // Withdraw $5000 cash, no investment sale — just moving cash out.
    // Opening: 20000 balance, 15000 ACB. Balance before withdrawal = 20000 (no returns).
    // Fraction = 5000/20000 = 0.25. ACB removed = 15000 * 0.25 = 3750.
    const acb = computeACB(0, 5000, 0, 0, 15000, 20000, 15000);
    expect(acb.computedCapitalGain).toBe(0);
    expect(acb.acbRemoved).toBeCloseTo(3750, 0);
    expect(acb.closingACB).toBeCloseTo(11250, 0);
  });

  it('combined: withdrawal + realized gain in same year', () => {
    // Sold investments at $4000 gain AND withdrew $10000.
    // Opening: 50000 balance, 40000 ACB. Returns = 2000. Balance before withdrawal = 52000.
    // Fraction = 10000/52000. ACB removed = 40000 * (10000/52000) ≈ 7692.31.
    const acb = computeACB(0, 10000, 4000, 0, 40000, 50000, 42000);
    expect(acb.computedCapitalGain).toBe(4000);
    expect(acb.acbRemoved).toBeCloseTo(7692.31, 0);
    expect(acb.closingACB).toBeCloseTo(40000 - 7692.31, 0);
  });

  it('realized gains and losses in same year net out', () => {
    const acb = computeACB(0, 0, 5000, 2000, 20000, 50000, 50000);
    expect(acb.computedCapitalGain).toBe(3000);
  });
});

describe('computeInsuranceACB', () => {
  it('premium adds to ACB', () => {
    const acb = computeInsuranceACB(5000, 0, 0, 10000, 50000, 55000);
    expect(acb.openingACB).toBe(10000);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.coiDeducted).toBe(0);
    expect(acb.closingACB).toBe(15000);
    expect(acb.computedSurrenderGain).toBe(0);
  });

  it('COI reduces ACB', () => {
    const acb = computeInsuranceACB(5000, 2000, 0, 10000, 50000, 53000);
    expect(acb.acbAdded).toBe(5000);
    expect(acb.coiDeducted).toBe(2000);
    // ACB before withdrawal = 10000 + 5000 - 2000 = 13000
    expect(acb.closingACB).toBe(13000);
  });

  it('withdrawal removes proportional ACB and computes surrender gain', () => {
    // Opening: ACB 20000, cash value 50000. Premium 5000, COI 1000, withdraw 10000.
    // ACB before withdrawal = 20000 + 5000 - 1000 = 24000
    // Cash value before withdrawal = 50000 + 5000 - 1000 = 54000
    // Fraction = 10000 / 54000
    // ACB removed = 24000 * (10000/54000) ≈ 4444.44
    // Surrender gain = 10000 - 4444.44 ≈ 5555.56
    const acb = computeInsuranceACB(5000, 1000, 10000, 20000, 50000, 44000);
    expect(acb.acbRemoved).toBeCloseTo(4444.44, 0);
    expect(acb.computedSurrenderGain).toBeCloseTo(5555.56, 0);
    expect(acb.closingACB).toBeCloseTo(24000 - 4444.44, 0);
  });

  it('full surrender removes all ACB', () => {
    // Opening ACB 10000, cash value 20000. Premium 0, COI 0, withdraw all 20000.
    const acb = computeInsuranceACB(0, 0, 20000, 10000, 20000, 0);
    expect(acb.acbRemoved).toBeCloseTo(10000, 0);
    expect(acb.closingACB).toBeCloseTo(0, 0);
    expect(acb.computedSurrenderGain).toBeCloseTo(10000, 0);
  });

  it('no activity preserves ACB', () => {
    const acb = computeInsuranceACB(0, 0, 0, 15000, 50000, 52000);
    expect(acb.openingACB).toBe(15000);
    expect(acb.closingACB).toBe(15000);
    expect(acb.computedSurrenderGain).toBe(0);
  });

  it('COI cannot reduce ACB below zero', () => {
    // Opening ACB 1000, COI 5000 (exceeds ACB)
    const acb = computeInsuranceACB(0, 5000, 0, 1000, 50000, 45000);
    expect(acb.closingACB).toBe(0); // max(0, 1000 - 5000)
  });
});
