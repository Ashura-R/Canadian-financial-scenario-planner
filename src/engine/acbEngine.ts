import type { ComputedACB, ComputedInsuranceACB } from '../types/computed';

/**
 * Compute Adjusted Cost Base (ACB) tracking for Non-Registered accounts.
 *
 * ACB tracks the cost basis of investments in non-reg accounts:
 * - Contributions add to ACB at cost (1:1)
 * - Withdrawals remove proportional ACB based on withdrawal fraction
 * - Capital gain = proceeds (withdrawal amount) - proportional ACB removed
 */
export function computeACB(
  nonRegContribution: number,
  nonRegWithdrawal: number,
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

  // Proportional ACB removed on withdrawal
  let acbRemoved = 0;
  let computedCapitalGain = 0;
  const dispositionProceeds = nonRegWithdrawal;

  if (nonRegWithdrawal > 0 && balanceBeforeWithdrawal > 0) {
    const withdrawalFraction = Math.min(1, nonRegWithdrawal / balanceBeforeWithdrawal);
    acbRemoved = acbBeforeWithdrawal * withdrawalFraction;
    computedCapitalGain = dispositionProceeds - acbRemoved;
  }

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
