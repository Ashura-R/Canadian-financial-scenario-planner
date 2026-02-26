import type { Scenario, TaxBracket } from '../types/scenario';

export interface WhatIfAdjustments {
  inflationAdj: number;           // delta, e.g. +0.02 = +2%
  equityReturnAdj: number;        // delta
  fixedIncomeReturnAdj: number;   // delta
  cashReturnAdj: number;          // delta
  savingsReturnAdj: number;       // delta
  incomeScaleFactor: number;      // multiplier, 1.0 = no change
  expenseScaleFactor: number;     // multiplier for contributions
  contributionStrategy: 'unchanged' | 'maxRRSP' | 'maxTFSA';
  federalBracketShift: number;    // multiplier for bracket thresholds, 0 = no change
  provBracketShift: number;       // multiplier for bracket thresholds, 0 = no change
}

export const DEFAULT_WHATIF: WhatIfAdjustments = {
  inflationAdj: 0,
  equityReturnAdj: 0,
  fixedIncomeReturnAdj: 0,
  cashReturnAdj: 0,
  savingsReturnAdj: 0,
  incomeScaleFactor: 1,
  expenseScaleFactor: 1,
  contributionStrategy: 'unchanged',
  federalBracketShift: 0,
  provBracketShift: 0,
};

export function isWhatIfActive(adj: WhatIfAdjustments): boolean {
  return (
    adj.inflationAdj !== 0 ||
    adj.equityReturnAdj !== 0 ||
    adj.fixedIncomeReturnAdj !== 0 ||
    adj.cashReturnAdj !== 0 ||
    adj.savingsReturnAdj !== 0 ||
    adj.incomeScaleFactor !== 1 ||
    adj.expenseScaleFactor !== 1 ||
    adj.contributionStrategy !== 'unchanged' ||
    adj.federalBracketShift !== 0 ||
    adj.provBracketShift !== 0
  );
}

function shiftBrackets(brackets: TaxBracket[], shift: number): TaxBracket[] {
  if (shift === 0) return brackets;
  const multiplier = 1 + shift;
  return brackets.map(b => ({
    ...b,
    min: Math.round(b.min * multiplier),
    max: b.max !== null ? Math.round(b.max * multiplier) : null,
  }));
}

export function applyWhatIfAdjustments(scenario: Scenario, adj: WhatIfAdjustments): Scenario {
  if (!isWhatIfActive(adj)) return scenario;

  // Deep-clone assumptions and years only
  const assumptions = JSON.parse(JSON.stringify(scenario.assumptions));
  const years = JSON.parse(JSON.stringify(scenario.years));

  // Macro adjustments
  assumptions.inflationRate += adj.inflationAdj;
  assumptions.assetReturns.equity += adj.equityReturnAdj;
  assumptions.assetReturns.fixedIncome += adj.fixedIncomeReturnAdj;
  assumptions.assetReturns.cash += adj.cashReturnAdj;
  assumptions.assetReturns.savings += adj.savingsReturnAdj;

  // Bracket shifts
  if (adj.federalBracketShift !== 0) {
    assumptions.federalBrackets = shiftBrackets(assumptions.federalBrackets, adj.federalBracketShift);
    assumptions.federalBPA = Math.round(assumptions.federalBPA * (1 + adj.federalBracketShift));
  }
  if (adj.provBracketShift !== 0) {
    assumptions.provincialBrackets = shiftBrackets(assumptions.provincialBrackets, adj.provBracketShift);
    assumptions.provincialBPA = Math.round(assumptions.provincialBPA * (1 + adj.provBracketShift));
  }

  // Income & contribution scaling + contribution strategy
  const incomeFields = [
    'employmentIncome', 'selfEmploymentIncome', 'eligibleDividends',
    'nonEligibleDividends', 'interestIncome', 'capitalGainsRealized',
    'otherTaxableIncome', 'rentalGrossIncome', 'pensionIncome', 'foreignIncome',
  ] as const;

  const contributionFields = [
    'rrspContribution', 'rrspDeductionClaimed', 'tfsaContribution',
    'fhsaContribution', 'fhsaDeductionClaimed', 'nonRegContribution',
    'savingsDeposit',
  ] as const;

  for (const yd of years) {
    // Scale income fields
    if (adj.incomeScaleFactor !== 1) {
      for (const f of incomeFields) {
        yd[f] = yd[f] * adj.incomeScaleFactor;
      }
    }

    // Scale contribution fields
    if (adj.expenseScaleFactor !== 1) {
      for (const f of contributionFields) {
        yd[f] = yd[f] * adj.expenseScaleFactor;
      }
    }

    // Contribution strategy redirects
    if (adj.contributionStrategy === 'maxRRSP') {
      const tfsaAmt = yd.tfsaContribution;
      const fhsaAmt = yd.fhsaContribution;
      yd.rrspContribution += tfsaAmt + fhsaAmt;
      yd.rrspDeductionClaimed += tfsaAmt + fhsaAmt;
      yd.tfsaContribution = 0;
      yd.fhsaContribution = 0;
      yd.fhsaDeductionClaimed = 0;
    } else if (adj.contributionStrategy === 'maxTFSA') {
      const rrspAmt = yd.rrspContribution;
      const fhsaAmt = yd.fhsaContribution;
      yd.tfsaContribution += rrspAmt + fhsaAmt;
      yd.rrspContribution = 0;
      yd.rrspDeductionClaimed = 0;
      yd.fhsaContribution = 0;
      yd.fhsaDeductionClaimed = 0;
    }
  }

  return {
    ...scenario,
    assumptions,
    years,
  };
}
