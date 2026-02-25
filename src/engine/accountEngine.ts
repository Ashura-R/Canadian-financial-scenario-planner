import type { YearData, Assumptions, OpeningBalances } from '../types/scenario';
import type { ComputedCPP, ComputedEI, ComputedTax, ComputedAccounts, ComputedWaterfall } from '../types/computed';
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
  returnOverrides?: ReturnOverrides
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

  return {
    rrspReturn,
    tfsaReturn,
    fhsaReturn,
    nonRegReturn,
    savingsReturn,
    rrspEOY: Math.max(0, rrspEOY),
    tfsaEOY: Math.max(0, tfsaEOY),
    fhsaEOY: Math.max(0, fhsaEOY),
    nonRegEOY: Math.max(0, nonRegEOY),
    savingsEOY: Math.max(0, savingsEOY),
    netWorth: Math.max(0, rrspEOY) + Math.max(0, tfsaEOY) + Math.max(0, fhsaEOY) + Math.max(0, nonRegEOY) + Math.max(0, savingsEOY),
  };
}

export function computeWaterfall(
  yd: YearData,
  cpp: ComputedCPP,
  ei: ComputedEI,
  tax: ComputedTax,
  accounts: ComputedAccounts,
  retirementIncome: RetirementIncome = { cppBenefitIncome: 0, oasIncome: 0 }
): ComputedWaterfall {
  // Gross income includes RRSP/RRIF withdrawals and CPP/OAS benefits
  const grossIncome =
    yd.employmentIncome + yd.selfEmploymentIncome +
    yd.rrspWithdrawal +
    retirementIncome.cppBenefitIncome + retirementIncome.oasIncome +
    yd.eligibleDividends + yd.nonEligibleDividends +
    yd.interestIncome + yd.capitalGainsRealized + yd.otherTaxableIncome;

  const afterRRSPDed = grossIncome - yd.rrspDeductionClaimed;
  const afterFHSADed = afterRRSPDed - yd.fhsaDeductionClaimed;
  const afterCPPSEHalf = afterFHSADed - cpp.cppSEEmployerHalfDed;
  const capLossDeduction = Math.max(0, yd.capitalLossApplied) * (1 - 0); // shown net
  const afterCapLoss = afterCPPSEHalf - capLossDeduction;
  const netTaxableIncome = tax.netTaxableIncome;
  const afterFederalTax = netTaxableIncome - tax.federalTaxPayable;
  const afterProvincialTax = afterFederalTax - tax.provincialTaxPayable;
  const afterCPPEI = afterProvincialTax - cpp.totalCPPPaid - ei.totalEI;
  const afterTaxIncome = afterCPPEI;

  const totalContributions =
    yd.rrspContribution + yd.tfsaContribution + yd.fhsaContribution +
    yd.nonRegContribution + yd.savingsDeposit;
  const totalWithdrawals =
    yd.rrspWithdrawal + yd.tfsaWithdrawal + yd.fhsaWithdrawal +
    yd.nonRegWithdrawal + yd.savingsWithdrawal;

  const netCashFlow = afterTaxIncome - totalContributions + totalWithdrawals;

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
    netCashFlow,
  };
}
