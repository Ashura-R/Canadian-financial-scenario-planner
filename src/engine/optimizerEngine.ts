/**
 * Withdrawal Sequencing Optimizer
 *
 * Tests different withdrawal strategies for retirees and compares lifetime tax outcomes.
 * Strategies: RRIF-first, TFSA-first, Non-Reg-first, Pro-rata (equal % from each).
 */

import type { Scenario, YearData } from '../types/scenario';
import { compute } from './index';

export interface WithdrawalStrategy {
  name: string;
  description: string;
  lifetimeTax: number;
  lifetimeAfterTax: number;
  finalNetWorth: number;
  avgTaxRate: number;
  yearlyTax: number[];
  yearlyNetWorth: number[];
}

/**
 * Generate withdrawal-ordered scenarios and compare.
 * Takes the base scenario and a target annual withdrawal amount.
 * For each strategy, distributes withdrawals across accounts differently.
 */
export function computeWithdrawalStrategies(
  scenario: Scenario,
  annualTarget: number,
  startYearIdx: number = 0,
): WithdrawalStrategy[] {
  if (annualTarget <= 0) return [];

  const strategies: { name: string; description: string; order: ('rrsp' | 'tfsa' | 'nonReg')[] }[] = [
    { name: 'RRIF First', description: 'Draw RRIF first, then Non-Reg, then TFSA', order: ['rrsp', 'nonReg', 'tfsa'] },
    { name: 'Non-Reg First', description: 'Draw Non-Reg first, then RRIF, then TFSA', order: ['nonReg', 'rrsp', 'tfsa'] },
    { name: 'TFSA First', description: 'Draw TFSA first, then Non-Reg, then RRIF', order: ['tfsa', 'nonReg', 'rrsp'] },
    { name: 'Equal Split', description: 'Draw equally from all accounts proportionally', order: [] },
  ];

  return strategies.map(strat => {
    // Clone scenario and modify withdrawal years
    const modifiedYears: YearData[] = scenario.years.map((yd, idx) => {
      if (idx < startYearIdx) return { ...yd };

      const yr = { ...yd };
      // Zero out existing withdrawals for the 3 accounts
      yr.rrspWithdrawal = 0;
      yr.tfsaWithdrawal = 0;
      yr.nonRegWithdrawal = 0;

      // We can't know exact balances here without running the engine,
      // so we use a simple heuristic: allocate target amount by strategy order
      let remaining = annualTarget;

      if (strat.order.length === 0) {
        // Equal split: divide equally among 3 accounts
        const third = annualTarget / 3;
        yr.rrspWithdrawal = third;
        yr.tfsaWithdrawal = third;
        yr.nonRegWithdrawal = third;
      } else {
        for (const acct of strat.order) {
          if (remaining <= 0) break;
          const alloc = remaining; // Give all remaining to this account
          if (acct === 'rrsp') yr.rrspWithdrawal = alloc;
          else if (acct === 'tfsa') yr.tfsaWithdrawal = alloc;
          else if (acct === 'nonReg') yr.nonRegWithdrawal = alloc;
          remaining = 0;
        }
      }

      return yr;
    });

    const modified: Scenario = { ...scenario, years: modifiedYears, scheduledItems: [] };
    const result = compute(modified);
    const years = result.years;
    const lastYear = years[years.length - 1];

    return {
      name: strat.name,
      description: strat.description,
      lifetimeTax: result.analytics.lifetimeTotalTax,
      lifetimeAfterTax: result.analytics.lifetimeAfterTaxIncome,
      finalNetWorth: lastYear?.accounts.netWorth ?? 0,
      avgTaxRate: result.analytics.lifetimeAvgTaxRate,
      yearlyTax: years.map(y => y.tax.totalIncomeTax),
      yearlyNetWorth: years.map(y => y.accounts.netWorth),
    };
  });
}
