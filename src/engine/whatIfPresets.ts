import type { WhatIfAdjustments } from './whatIfEngine';

export interface WhatIfPreset {
  id: string;
  label: string;
  description: string;
  adjustments: Partial<WhatIfAdjustments>;
}

export const WHATIF_PRESETS: WhatIfPreset[] = [
  {
    id: 'bear-market',
    label: 'Bear Market',
    description: 'Equity -15%, inflation +1%, fixed income +0.5%',
    adjustments: {
      equityReturnAdj: -0.15,
      inflationAdj: 0.01,
      fixedIncomeReturnAdj: 0.005,
    },
  },
  {
    id: 'stagflation',
    label: 'Stagflation',
    description: 'Inflation +3%, equity -5%, fixed -2%, expenses 1.2x',
    adjustments: {
      inflationAdj: 0.03,
      equityReturnAdj: -0.05,
      fixedIncomeReturnAdj: -0.02,
      livingExpenseScale: 1.2,
    },
  },
  {
    id: 'early-retirement',
    label: 'Early Retire',
    description: 'CPP at 60, OAS at 65, no employment, RRSP withdrawal +$15K',
    adjustments: {
      cppStartAgeOverride: 60,
      oasStartAgeOverride: 65,
      employmentIncomeScale: 0,
      rrspWithdrawalAdj: 15000,
    },
  },
  {
    id: 'aggressive-saving',
    label: 'Aggressive Save',
    description: 'RRSP/TFSA 2x, expenses 0.8x, max RRSP strategy',
    adjustments: {
      rrspContribScale: 2,
      tfsaContribScale: 2,
      livingExpenseScale: 0.8,
      contributionStrategy: 'maxRRSP',
    },
  },
  {
    id: 'tax-rate-hike',
    label: 'Tax Hike',
    description: 'Brackets compressed 10%/5%, CG 66.7%, OAS threshold -$10K',
    adjustments: {
      federalBracketShift: -0.10,
      provBracketShift: -0.05,
      capitalGainsInclusionRateOverride: 0.6667,
      oasClawbackThresholdAdj: -10000,
    },
  },
  {
    id: 'high-growth',
    label: 'High Growth',
    description: 'Equity +4%, fixed +1%, 90% equity allocation',
    adjustments: {
      equityReturnAdj: 0.04,
      fixedIncomeReturnAdj: 0.01,
      allAccountsEquityPct: 0.9,
    },
  },
  {
    id: 'dividend-focus',
    label: 'Dividend Focus',
    description: 'Dividends 2x, interest/CG 0.5x, max TFSA strategy',
    adjustments: {
      dividendIncomeScale: 2,
      interestIncomeScale: 0.5,
      capitalGainsScale: 0.5,
      contributionStrategy: 'maxTFSA',
    },
  },
];
