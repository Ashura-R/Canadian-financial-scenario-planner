import { describe, it, expect } from 'vitest';
import { computeAccounts, computeWaterfall } from '../accountEngine';
import { DEFAULT_ASSUMPTIONS, makeDefaultYear } from '../../store/defaults';
import type { OpeningBalances } from '../../types/scenario';

const ass = DEFAULT_ASSUMPTIONS;
const zeroBal: OpeningBalances = { rrsp: 0, tfsa: 0, fhsa: 0, nonReg: 0, savings: 0, lira: 0, resp: 0, li: 0 };
const zeroCPP = { pensionableEarnings: 0, cppEmployee: 0, cpp2Employee: 0, cppSE: 0, cpp2SE: 0, cppSEEmployerHalfDed: 0, totalCPPForCredit: 0, totalCPPPaid: 0 };
const zeroEI = { eiEmployment: 0, eiSE: 0, totalEI: 0 };
const zeroTax = {
  grossedUpEligibleDiv: 0, grossedUpNonEligibleDiv: 0, taxableCapitalGains: 0,
  totalIncomeBeforeDeductions: 0, netTaxableIncome: 0,
  federalTaxBeforeCredits: 0, federalCredits: 0, federalTaxPayable: 0, quebecAbatement: 0,
  provincialTaxBeforeCredits: 0, provincialCredits: 0, provincialTaxPayable: 0,
  ontarioSurtax: 0, ontarioHealthPremium: 0, oasClawback: 0, foreignTaxCredit: 0, cwbCredit: 0,
  amtTax: 0, amtAdditional: 0, totalIncomeTax: 0,
  marginalFederalRate: 0, marginalProvincialRate: 0, marginalCombinedRate: 0,
  avgIncomeTaxRate: 0, avgAllInRate: 0,
};

describe('computeAccounts', () => {
  it('deposits only (RRSP contribution)', () => {
    const yd = { ...makeDefaultYear(2025), rrspContribution: 10000 };
    const prev: OpeningBalances = { ...zeroBal, rrsp: 50000 };
    const result = computeAccounts(yd, ass, prev);
    // (50000 + 10000 - 0) * (1 + 0) = 60000
    expect(result.rrspEOY).toBe(60000);
  });

  it('accounts with return rate', () => {
    const assWithReturns = { ...ass, assetReturns: { equity: 0.07, fixedIncome: 0.03, cash: 0.01, savings: 0.02 } };
    const yd = { ...makeDefaultYear(2025), rrspContribution: 5000 };
    // Default allocation: 100% equity
    const prev: OpeningBalances = { ...zeroBal, rrsp: 100000 };
    const result = computeAccounts(yd, assWithReturns, prev);
    // (100000 + 5000) * (1 + 0.07) = 112350
    expect(result.rrspEOY).toBeCloseTo(112350, 2);
    expect(result.rrspReturn).toBeCloseTo(0.07, 4);
  });

  it('savings balance: (opening + deposit - withdrawal) * (1 + return)', () => {
    const assWithReturns = { ...ass, assetReturns: { ...ass.assetReturns, savings: 0.03 } };
    const yd = { ...makeDefaultYear(2025), savingsDeposit: 5000, savingsWithdrawal: 1000 };
    const prev: OpeningBalances = { ...zeroBal, savings: 20000 };
    const result = computeAccounts(yd, assWithReturns, prev);
    // (20000 + 5000 - 1000) * 1.03 = 24720
    expect(result.savingsEOY).toBeCloseTo(24720, 2);
  });

  it('net worth = sum of all accounts', () => {
    const prev: OpeningBalances = { rrsp: 10000, tfsa: 5000, fhsa: 3000, nonReg: 2000, savings: 1000, lira: 500, resp: 200, li: 0 };
    const yd = makeDefaultYear(2025);
    const result = computeAccounts(yd, ass, prev);
    const expected = result.rrspEOY + result.tfsaEOY + result.fhsaEOY + result.nonRegEOY + result.savingsEOY + result.liraEOY + result.respEOY + result.liCashValueEOY;
    expect(result.netWorth).toBeCloseTo(expected, 2);
  });

  it('EOY override bypasses calculation', () => {
    const yd = { ...makeDefaultYear(2025), rrspEOYOverride: 99999 };
    const prev: OpeningBalances = { ...zeroBal, rrsp: 50000 };
    const result = computeAccounts(yd, ass, prev);
    expect(result.rrspEOY).toBe(99999);
  });

  it('life insurance cash value: (prev + premium - COI) * (1 + return) - withdrawal', () => {
    const assWithReturns = { ...ass, assetReturns: { equity: 0.07, fixedIncome: 0.04, cash: 0.01, savings: 0.02 } };
    const yd = { ...makeDefaultYear(2025), liPremium: 6000, liCOI: 1000, liWithdrawal: 0, liEquityPct: 0, liFixedPct: 1, liCashPct: 0 };
    const prev: OpeningBalances = { ...zeroBal, li: 50000 };
    const result = computeAccounts(yd, assWithReturns, prev);
    // (50000 + 6000 - 1000) * (1 + 0.04) = 55000 * 1.04 = 57200
    expect(result.liCashValueEOY).toBeCloseTo(57200, 2);
    expect(result.liReturn).toBeCloseTo(0.04, 4);
  });

  it('life insurance with withdrawal', () => {
    const yd = { ...makeDefaultYear(2025), liPremium: 3000, liCOI: 500, liWithdrawal: 10000, liEquityPct: 0, liFixedPct: 1, liCashPct: 0 };
    const prev: OpeningBalances = { ...zeroBal, li: 40000 };
    const result = computeAccounts(yd, ass, prev);
    // (40000 + 3000 - 500) * (1 + 0) - 10000 = 42500 - 10000 = 32500
    expect(result.liCashValueEOY).toBe(32500);
  });

  it('life insurance included in net worth', () => {
    const prev: OpeningBalances = { ...zeroBal, li: 25000 };
    const yd = makeDefaultYear(2025);
    const result = computeAccounts(yd, ass, prev);
    expect(result.netWorth).toBe(result.rrspEOY + result.tfsaEOY + result.fhsaEOY + result.nonRegEOY + result.savingsEOY + result.liraEOY + result.respEOY + result.liCashValueEOY);
    expect(result.liCashValueEOY).toBe(25000);
  });
});

describe('computeWaterfall', () => {
  it('netCashFlow = afterTaxIncome - totalContributions + totalWithdrawals', () => {
    const yd = {
      ...makeDefaultYear(2025),
      employmentIncome: 80000,
      rrspContribution: 5000,
      savingsDeposit: 3000,
      tfsaWithdrawal: 1000,
    };
    const accounts = computeAccounts(yd, ass, zeroBal);
    const tax = { ...zeroTax, totalIncomeTax: 15000, netTaxableIncome: 80000, federalTaxPayable: 10000, provincialTaxPayable: 5000 };
    const result = computeWaterfall(yd, zeroCPP, zeroEI, tax, accounts);

    const totalContrib = 5000 + 0 + 0 + 0 + 3000 + 0; // rrsp + tfsa + fhsa + nonReg + savings + resp
    const totalWithdraw = 0 + 1000 + 0 + 0 + 0 + 0 + 0; // rrsp + tfsa + fhsa + nonReg + savings + lif + resp
    expect(result.netCashFlow).toBeCloseTo(result.afterTaxIncome - totalContrib + totalWithdraw, 2);
  });

  it('gross income includes all income sources', () => {
    const yd = {
      ...makeDefaultYear(2025),
      employmentIncome: 50000,
      eligibleDividends: 5000,
      interestIncome: 2000,
    };
    const accounts = computeAccounts(yd, ass, zeroBal);
    const result = computeWaterfall(yd, zeroCPP, zeroEI, zeroTax, accounts);
    expect(result.grossIncome).toBe(57000);
  });
});
