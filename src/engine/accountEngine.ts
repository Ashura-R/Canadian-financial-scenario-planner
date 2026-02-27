import type { YearData, Assumptions, OpeningBalances } from '../types/scenario';
import type { ComputedCPP, ComputedEI, ComputedTax, ComputedAccounts, ComputedWaterfall, AccountPnL, AccountPnLEntry } from '../types/computed';
import type { RetirementIncome } from './taxEngine';

function calcReturn(
  equityPct: number,
  fixedPct: number,
  cashPct: number,
  returns: Assumptions['assetReturns']
): number {
  return equityPct * returns.equity + fixedPct * returns.fixedIncome + cashPct * returns.cash;
}

export interface ReturnOverrides {
  equity?: number;
  fixedIncome?: number;
  cash?: number;
  savings?: number;
}

export function computeAccounts(
  yd: YearData,
  ass: Assumptions,
  prevBalances: OpeningBalances,
  returnOverrides?: ReturnOverrides,
  respCESG: number = 0,
): ComputedAccounts {
  const r = {
    equity: returnOverrides?.equity ?? ass.assetReturns.equity,
    fixedIncome: returnOverrides?.fixedIncome ?? ass.assetReturns.fixedIncome,
    cash: returnOverrides?.cash ?? ass.assetReturns.cash,
    savings: returnOverrides?.savings ?? ass.assetReturns.savings,
  };

  const rrspReturn = calcReturn(yd.rrspEquityPct, yd.rrspFixedPct, yd.rrspCashPct, r);
  const tfsaReturn = calcReturn(yd.tfsaEquityPct, yd.tfsaFixedPct, yd.tfsaCashPct, r);
  const fhsaReturn = calcReturn(yd.fhsaEquityPct, yd.fhsaFixedPct, yd.fhsaCashPct, r);
  const nonRegReturn = calcReturn(yd.nonRegEquityPct, yd.nonRegFixedPct, yd.nonRegCashPct, r);
  const savingsReturn = r.savings;

  const rrspEOY = yd.rrspEOYOverride !== undefined
    ? yd.rrspEOYOverride
    : (prevBalances.rrsp + yd.rrspContribution - yd.rrspWithdrawal) * (1 + rrspReturn);

  const tfsaEOY = yd.tfsaEOYOverride !== undefined
    ? yd.tfsaEOYOverride
    : (prevBalances.tfsa + yd.tfsaContribution - yd.tfsaWithdrawal) * (1 + tfsaReturn);

  const fhsaEOY = yd.fhsaEOYOverride !== undefined
    ? yd.fhsaEOYOverride
    : (prevBalances.fhsa + yd.fhsaContribution - yd.fhsaWithdrawal) * (1 + fhsaReturn);

  const nonRegEOY = yd.nonRegEOYOverride !== undefined
    ? yd.nonRegEOYOverride
    : (prevBalances.nonReg + yd.nonRegContribution - yd.nonRegWithdrawal) * (1 + nonRegReturn);

  const savingsEOY = yd.savingsEOYOverride !== undefined
    ? yd.savingsEOYOverride
    : (prevBalances.savings + yd.savingsDeposit - yd.savingsWithdrawal) * (1 + savingsReturn);

  // LIRA/LIF
  const liraReturn = calcReturn(yd.liraEquityPct, yd.liraFixedPct, yd.liraCashPct, r);
  const liraEOY = yd.liraEOYOverride !== undefined
    ? yd.liraEOYOverride
    : (prevBalances.lira - yd.lifWithdrawal) * (1 + liraReturn);

  // RESP (contributions + CESG grant - withdrawals)
  const respReturn = calcReturn(yd.respEquityPct, yd.respFixedPct, yd.respCashPct, r);
  const respEOY = yd.respEOYOverride !== undefined
    ? yd.respEOYOverride
    : (prevBalances.resp + yd.respContribution + respCESG - yd.respWithdrawal) * (1 + respReturn);

  // Life Insurance (whole/universal life)
  const liReturn = calcReturn(yd.liEquityPct ?? 0, yd.liFixedPct ?? 1, yd.liCashPct ?? 0, r);
  const liCashValueEOY = yd.liEOYOverride !== undefined
    ? yd.liEOYOverride
    : Math.max(0, (prevBalances.li + (yd.liPremium ?? 0) - (yd.liCOI ?? 0)) * (1 + liReturn) - (yd.liWithdrawal ?? 0));

  return {
    rrspReturn,
    tfsaReturn,
    fhsaReturn,
    nonRegReturn,
    savingsReturn,
    liraReturn,
    respReturn,
    liReturn,
    liCashValueEOY: Math.max(0, liCashValueEOY),
    rrspEOY: Math.max(0, rrspEOY),
    tfsaEOY: Math.max(0, tfsaEOY),
    fhsaEOY: Math.max(0, fhsaEOY),
    nonRegEOY: Math.max(0, nonRegEOY),
    savingsEOY: Math.max(0, savingsEOY),
    liraEOY: Math.max(0, liraEOY),
    respEOY: Math.max(0, respEOY),
    netWorth: Math.max(0, rrspEOY) + Math.max(0, tfsaEOY) + Math.max(0, fhsaEOY) + Math.max(0, nonRegEOY) + Math.max(0, savingsEOY) + Math.max(0, liraEOY) + Math.max(0, respEOY) + Math.max(0, liCashValueEOY),
  };
}

export function computeWaterfall(
  yd: YearData,
  cpp: ComputedCPP,
  ei: ComputedEI,
  tax: ComputedTax,
  accounts: ComputedAccounts,
  retirementIncome: RetirementIncome = { cppBenefitIncome: 0, oasIncome: 0 },
  gisIncome: number = 0,
): ComputedWaterfall {
  // Gross income includes RRSP/RRIF withdrawals, LIF withdrawals, and CPP/OAS benefits
  const rentalNet = yd.rentalGrossIncome - yd.rentalExpenses;
  const seNet = Math.max(0, yd.selfEmploymentIncome - (yd.selfEmploymentExpenses ?? 0));
  const grossIncome =
    yd.employmentIncome + seNet +
    yd.rrspWithdrawal + yd.lifWithdrawal +
    retirementIncome.cppBenefitIncome + retirementIncome.oasIncome +
    yd.eligibleDividends + yd.nonEligibleDividends +
    yd.interestIncome + yd.capitalGainsRealized + yd.otherTaxableIncome +
    yd.pensionIncome + yd.foreignIncome + rentalNet;

  const afterRRSPDed = grossIncome - yd.rrspDeductionClaimed;
  const afterFHSADed = afterRRSPDed - yd.fhsaDeductionClaimed;
  const afterCPPSEHalf = afterFHSADed - cpp.cppSEEmployerHalfDed;
  const capLossDeduction = Math.max(0, yd.capitalLossApplied) * (1 - 0); // shown net
  const afterCapLoss = afterCPPSEHalf - capLossDeduction;
  const netTaxableIncome = tax.netTaxableIncome;
  const afterFederalTax = netTaxableIncome - tax.federalTaxPayable;
  const afterProvincialTax = afterFederalTax - tax.provincialTaxPayable;
  const afterCPPEI = afterProvincialTax - cpp.totalCPPPaid - ei.totalEI;
  const afterTaxIncome = afterCPPEI + gisIncome; // GIS is tax-free, added after tax

  // Living expenses (non-deductible, reduce cash flow)
  const totalLivingExpenses =
    (yd.housingExpense ?? 0) + (yd.groceriesExpense ?? 0) + (yd.transportationExpense ?? 0) +
    (yd.utilitiesExpense ?? 0) + (yd.insuranceExpense ?? 0) + (yd.entertainmentExpense ?? 0) +
    (yd.personalExpense ?? 0) + (yd.otherLivingExpense ?? 0);
  const afterExpenses = afterTaxIncome - totalLivingExpenses;

  const totalContributions =
    yd.rrspContribution + yd.tfsaContribution + yd.fhsaContribution +
    yd.nonRegContribution + yd.savingsDeposit + yd.respContribution +
    (yd.liPremium ?? 0);
  const totalWithdrawals =
    yd.rrspWithdrawal + yd.tfsaWithdrawal + yd.fhsaWithdrawal +
    yd.nonRegWithdrawal + yd.savingsWithdrawal + yd.lifWithdrawal + yd.respWithdrawal +
    (yd.liWithdrawal ?? 0);

  const netCashFlow = afterExpenses - totalContributions + totalWithdrawals;

  return {
    grossIncome,
    afterRRSPDed,
    afterFHSADed,
    afterCPPSEHalf,
    afterCapLoss,
    netTaxableIncome,
    afterFederalTax,
    afterProvincialTax,
    afterCPPEI,
    afterTaxIncome,
    totalLivingExpenses,
    afterExpenses,
    netCashFlow,
  };
}

/** Book values per account — tracked across years */
export interface BookValues {
  rrsp: number;
  tfsa: number;
  fhsa: number;
  nonReg: number;
  savings: number;
  lira: number;
  resp: number;
  li: number;
}

function makePnLEntry(bookValue: number, marketValue: number): AccountPnLEntry {
  const gain = marketValue - bookValue;
  return {
    bookValue,
    marketValue,
    gain,
    returnPct: bookValue > 0 ? gain / bookValue : 0,
  };
}

/**
 * Compute per-account book values using proportional method.
 * Book value = cost basis. On withdrawal, proportional book value is removed.
 */
export function computeAccountPnL(
  yd: YearData,
  accounts: ComputedAccounts,
  prevBookValues: BookValues,
  prevBalances: OpeningBalances,
  respCESG: number = 0,
): { pnl: AccountPnL; newBookValues: BookValues } {
  function updateBookValue(
    prevBook: number,
    prevBalance: number,
    contribution: number,
    withdrawal: number,
    eoy: number,
  ): { bookValue: number; entry: AccountPnLEntry } {
    const bookBeforeWithdrawal = prevBook + contribution;
    let bookRemoved = 0;
    if (withdrawal > 0 && prevBalance + contribution > 0) {
      // Balance before withdrawal includes growth
      const balBeforeW = prevBalance + contribution + (eoy - prevBalance - contribution + withdrawal);
      const fraction = balBeforeW > 0 ? Math.min(1, withdrawal / balBeforeW) : 0;
      bookRemoved = bookBeforeWithdrawal * fraction;
    }
    const newBook = Math.max(0, bookBeforeWithdrawal - bookRemoved);
    return { bookValue: newBook, entry: makePnLEntry(newBook, eoy) };
  }

  const rrsp = updateBookValue(prevBookValues.rrsp, prevBalances.rrsp, yd.rrspContribution, yd.rrspWithdrawal, accounts.rrspEOY);
  const tfsa = updateBookValue(prevBookValues.tfsa, prevBalances.tfsa, yd.tfsaContribution, yd.tfsaWithdrawal, accounts.tfsaEOY);
  const fhsa = updateBookValue(prevBookValues.fhsa, prevBalances.fhsa, yd.fhsaContribution, yd.fhsaWithdrawal, accounts.fhsaEOY);
  const nonReg = updateBookValue(prevBookValues.nonReg, prevBalances.nonReg, yd.nonRegContribution, yd.nonRegWithdrawal, accounts.nonRegEOY);
  const savings = updateBookValue(prevBookValues.savings, prevBalances.savings, yd.savingsDeposit, yd.savingsWithdrawal, accounts.savingsEOY);
  const lira = updateBookValue(prevBookValues.lira, prevBalances.lira, 0, yd.lifWithdrawal, accounts.liraEOY);
  const resp = updateBookValue(prevBookValues.resp, prevBalances.resp, yd.respContribution + respCESG, yd.respWithdrawal, accounts.respEOY);
  const li = updateBookValue(prevBookValues.li, prevBalances.li, (yd.liPremium ?? 0), (yd.liWithdrawal ?? 0), accounts.liCashValueEOY);

  const totalBookValue = rrsp.bookValue + tfsa.bookValue + fhsa.bookValue + nonReg.bookValue + savings.bookValue + lira.bookValue + resp.bookValue + li.bookValue;
  const totalMarketValue = accounts.rrspEOY + accounts.tfsaEOY + accounts.fhsaEOY + accounts.nonRegEOY + accounts.savingsEOY + accounts.liraEOY + accounts.respEOY + accounts.liCashValueEOY;
  const totalGain = totalMarketValue - totalBookValue;

  return {
    pnl: {
      rrsp: rrsp.entry,
      tfsa: tfsa.entry,
      fhsa: fhsa.entry,
      nonReg: nonReg.entry,
      savings: savings.entry,
      lira: lira.entry,
      resp: resp.entry,
      li: li.entry,
      totalBookValue,
      totalMarketValue,
      totalGain,
      totalReturnPct: totalBookValue > 0 ? totalGain / totalBookValue : 0,
    },
    newBookValues: {
      rrsp: rrsp.bookValue,
      tfsa: tfsa.bookValue,
      fhsa: fhsa.bookValue,
      nonReg: nonReg.bookValue,
      savings: savings.bookValue,
      lira: lira.bookValue,
      resp: resp.bookValue,
      li: li.bookValue,
    },
  };
}
