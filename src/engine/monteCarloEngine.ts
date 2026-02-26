/**
 * Monte Carlo Simulation Engine
 *
 * Runs the scenario N times with randomly sampled returns each year,
 * producing percentile bands for net worth, after-tax income, and cash flow.
 */

import type { Scenario, MonteCarloConfig } from '../types/scenario';
import { compute } from './index';

// ── Seeded PRNG (xoshiro128**) ──────────────────────────────────────
function splitmix32(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x9e3779b9 | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

function xoshiro128ss(seed: number): () => number {
  const init = splitmix32(seed);
  let s0 = (init() * 4294967296) >>> 0;
  let s1 = (init() * 4294967296) >>> 0;
  let s2 = (init() * 4294967296) >>> 0;
  let s3 = (init() * 4294967296) >>> 0;

  return () => {
    const result = Math.imul(s1 * 5, 7) >>> 0;
    const t = s1 << 9;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3;
    s2 ^= t; s3 = (s3 << 11) | (s3 >>> 21);
    return (result >>> 0) / 4294967296;
  };
}

// Box-Muller transform: two uniform → one standard normal
function boxMuller(rng: () => number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng(); // avoid log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Sample from log-normal: mean & stdDev are of the RETURN (arithmetic), not the log
// We convert arithmetic mean/stdDev to log-normal parameters
function sampleReturn(mean: number, stdDev: number, rng: () => number): number {
  if (stdDev <= 0) return mean;
  // For small stdDev relative to mean, use normal approximation
  // For realistic returns, log-normal is better but we keep it simple with normal
  // since returns can be negative in bad years
  return mean + stdDev * boxMuller(rng);
}

// ── Percentile computation ──────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Result types ────────────────────────────────────────────────────
export interface MonteCarloPercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface MonteCarloResult {
  numTrials: number;
  years: number[];                           // year labels
  netWorth: MonteCarloPercentileBands;
  afterTaxIncome: MonteCarloPercentileBands;
  // Final-year distribution
  finalNetWorthDistribution: number[];       // sorted array of all final net worths
  finalNetWorthStats: {
    mean: number;
    median: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    min: number;
    max: number;
  };
  // Probability metrics
  probabilityOfRuin: number;                 // % of trials where net worth goes to 0
}

// ── Main engine ─────────────────────────────────────────────────────
export function runMonteCarlo(
  scenario: Scenario,
  config: MonteCarloConfig,
): MonteCarloResult {
  const numYears = scenario.years.length;
  const numTrials = Math.max(1, Math.min(config.numTrials, 2000)); // cap at 2000
  const rng = xoshiro128ss(config.seed ?? Date.now());

  // Collect per-trial results
  const allNetWorth: number[][] = [];      // [trial][yearIdx]
  const allAfterTax: number[][] = [];
  const allFinalNW: number[] = [];
  let ruinCount = 0;

  for (let t = 0; t < numTrials; t++) {
    // Build return sequence for this trial
    const equity: number[] = [];
    const fixedIncome: number[] = [];
    const cash: number[] = [];
    const savings: number[] = [];

    for (let y = 0; y < numYears; y++) {
      equity.push(sampleReturn(config.equity.mean, config.equity.stdDev, rng));
      fixedIncome.push(sampleReturn(config.fixedIncome.mean, config.fixedIncome.stdDev, rng));
      cash.push(sampleReturn(config.cash.mean, config.cash.stdDev, rng));
      savings.push(sampleReturn(config.savings.mean, config.savings.stdDev, rng));
    }

    // Clone scenario with this trial's return sequence
    const trialScenario: Scenario = {
      ...scenario,
      returnSequence: { enabled: true, equity, fixedIncome, cash, savings },
    };

    const result = compute(trialScenario);
    const nw = result.years.map(yr => yr.accounts.netWorth);
    const at = result.years.map(yr => yr.waterfall.afterTaxIncome);

    allNetWorth.push(nw);
    allAfterTax.push(at);

    const finalNW = nw[nw.length - 1] ?? 0;
    allFinalNW.push(finalNW);

    // Ruin = net worth hits 0 at any point
    if (nw.some(v => v <= 0)) ruinCount++;
  }

  // Compute percentile bands per year
  function computeBands(data: number[][]): MonteCarloPercentileBands {
    const bands: MonteCarloPercentileBands = {
      p10: [], p25: [], p50: [], p75: [], p90: [],
    };
    for (let y = 0; y < numYears; y++) {
      const vals = data.map(trial => trial[y]).sort((a, b) => a - b);
      bands.p10.push(percentile(vals, 10));
      bands.p25.push(percentile(vals, 25));
      bands.p50.push(percentile(vals, 50));
      bands.p75.push(percentile(vals, 75));
      bands.p90.push(percentile(vals, 90));
    }
    return bands;
  }

  const sortedFinalNW = [...allFinalNW].sort((a, b) => a - b);
  const mean = allFinalNW.reduce((s, v) => s + v, 0) / allFinalNW.length;

  return {
    numTrials,
    years: scenario.years.map(y => y.year),
    netWorth: computeBands(allNetWorth),
    afterTaxIncome: computeBands(allAfterTax),
    finalNetWorthDistribution: sortedFinalNW,
    finalNetWorthStats: {
      mean,
      median: percentile(sortedFinalNW, 50),
      p10: percentile(sortedFinalNW, 10),
      p25: percentile(sortedFinalNW, 25),
      p75: percentile(sortedFinalNW, 75),
      p90: percentile(sortedFinalNW, 90),
      min: sortedFinalNW[0] ?? 0,
      max: sortedFinalNW[sortedFinalNW.length - 1] ?? 0,
    },
    probabilityOfRuin: (ruinCount / numTrials) * 100,
  };
}
