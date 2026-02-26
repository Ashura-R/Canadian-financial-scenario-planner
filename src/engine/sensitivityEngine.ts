/**
 * Sensitivity / Monte Carlo Analysis
 *
 * Runs the scenario with different return assumptions to show outcome ranges.
 * Simple approach: test base ± offsets for equity returns and show range of final outcomes.
 */

import type { Scenario } from '../types/scenario';
import type { ComputedScenario } from '../types/computed';
import { compute } from './index';

export interface SensitivityResult {
  label: string;
  equityOffset: number;   // offset from base equity return (e.g. -0.02 = -2%)
  finalNetWorth: number;
  lifetimeAfterTax: number;
  lifetimeTax: number;
  finalRealNetWorth: number;
  yearlyNetWorth: number[];
}

export interface SensitivityAnalysis {
  base: SensitivityResult;
  scenarios: SensitivityResult[];
}

function runWithOffset(scenario: Scenario, equityOffset: number, label: string): SensitivityResult {
  const modified: Scenario = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      assetReturns: {
        ...scenario.assumptions.assetReturns,
        equity: scenario.assumptions.assetReturns.equity + equityOffset,
      },
    },
  };

  const result = compute(modified);
  const years = result.years;
  const lastYear = years[years.length - 1];

  return {
    label,
    equityOffset,
    finalNetWorth: lastYear?.accounts.netWorth ?? 0,
    lifetimeAfterTax: result.analytics.lifetimeAfterTaxIncome,
    lifetimeTax: result.analytics.lifetimeTotalTax,
    finalRealNetWorth: lastYear?.realNetWorth ?? 0,
    yearlyNetWorth: years.map(y => y.accounts.netWorth),
  };
}

export function computeSensitivity(
  scenario: Scenario,
  offsets: number[] = [-0.04, -0.02, 0, 0.02, 0.04],
): SensitivityAnalysis {
  const results: SensitivityResult[] = offsets.map(offset => {
    const label = offset === 0 ? 'Base'
      : offset > 0 ? `+${(offset * 100).toFixed(0)}%`
      : `${(offset * 100).toFixed(0)}%`;
    return runWithOffset(scenario, offset, label);
  });

  const base = results.find(r => r.equityOffset === 0) ?? results[Math.floor(results.length / 2)];

  return {
    base,
    scenarios: results,
  };
}
