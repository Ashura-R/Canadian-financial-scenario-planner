import type { ComputedACB, ComputedInsuranceACB } from '../types/computed';

/**
 * Compute Adjusted Cost Base (ACB) tracking for Non-Registered accounts.
 *
 * ACB tracks the cost basis of investments in non-reg accounts:
 * - Contributions add to ACB at cost (1:1)
 * - Withdrawals remove proportional ACB (taking cash out removes proportional cost basis)
 * - Realized gains/losses are user-specified from actual investment dispositions
 * - computedCapitalGain reflects user-specified realized gains minus losses
 */
export function computeACB(
  nonRegContribution: number,
  nonRegWithdrawal: number,
  realizedGains: number,
  realizedLosses: number,
  prevACB: number,
  prevNonRegBalance: number,
  nonRegEOY: number,
): ComputedACB {
  const openingACB = prevACB;

  // Contributions add ACB at cost
  const acbAdded = nonRegContribution;

  // Before withdrawal, effective ACB = opening + added
  const acbBeforeWithdrawal = openingACB + acbAdded;

  // Balance before withdrawal (opening + contribution + returns - withdrawal = EOY)
  // So balance before withdrawal = prevBalance + contribution + returns
  // returns = EOY - prevBalance - contribution + withdrawal
  const balanceBeforeWithdrawal = prevNonRegBalance + nonRegContribution +
    (nonRegEOY - prevNonRegBalance - nonRegContribution + nonRegWithdrawal);

  // Proportional ACB removed on withdrawal (cash out removes proportional cost basis)
  let acbRemoved = 0;
  if (nonRegWithdrawal > 0 && balanceBeforeWithdrawal > 0) {
    const withdrawalFraction = Math.min(1, nonRegWithdrawal / balanceBeforeWithdrawal);
    acbRemoved = acbBeforeWithdrawal * withdrawalFraction;
  }

  // Capital gain is based on user-specified realized gains/losses, not withdrawal math
  const computedCapitalGain = realizedGains - realizedLosses;

  // Disposition proceeds derived from cost basis of sold portion + realized gain
  const dispositionProceeds = realizedGains > 0 || realizedLosses > 0
    ? acbRemoved + computedCapitalGain
    : nonRegWithdrawal;

  const closingACB = Math.max(0, acbBeforeWithdrawal - acbRemoved);
  const perUnitACB = nonRegEOY > 0 ? closingACB / nonRegEOY : 0;

  return {
    openingACB,
    acbAdded,
    acbRemoved,
    closingACB,
    perUnitACB,
    computedCapitalGain,
    dispositionProceeds,
  };
}

/**
 * Compute ACB tracking for Life Insurance (whole/universal life).
 *
 * ACB = cumulative premiums - cumulative COI.
 * On withdrawal (partial surrender): proportional ACB removed.
 * Surrender gain = proceeds - proportional ACB removed.
 */
export function computeInsuranceACB(
  premium: number,
  coi: number,
  withdrawal: number,
  prevACB: number,
  prevCashValue: number,
  cashValueEOY: number,
): ComputedInsuranceACB {
  const openingACB = prevACB;

  // Premiums add ACB; COI reduces ACB
  const acbAdded = premium;
  const coiDeducted = coi;
  const acbBeforeWithdrawal = Math.max(0, openingACB + acbAdded - coiDeducted);

  // Balance before withdrawal
  const balanceBeforeWithdrawal = prevCashValue + premium - coi +
    (cashValueEOY - prevCashValue - premium + coi + withdrawal);

  let acbRemoved = 0;
  let computedSurrenderGain = 0;
  const dispositionProceeds = withdrawal;

  if (withdrawal > 0 && balanceBeforeWithdrawal > 0) {
    const fraction = Math.min(1, withdrawal / balanceBeforeWithdrawal);
    acbRemoved = acbBeforeWithdrawal * fraction;
    computedSurrenderGain = dispositionProceeds - acbRemoved;
  }

  const closingACB = Math.max(0, acbBeforeWithdrawal - acbRemoved);

  return {
    openingACB,
    acbAdded,
    coiDeducted,
    acbRemoved,
    closingACB,
    computedSurrenderGain,
    dispositionProceeds,
  };
}
