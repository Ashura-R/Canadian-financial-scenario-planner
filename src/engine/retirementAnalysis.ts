/**
 * CPP and OAS Deferral Analysis
 *
 * CPP: 7.2%/yr reduction for early take (60-64), 8.4%/yr increase for deferral (66-70)
 * OAS: 7.2%/yr increase for deferral from 65 to 70 (36% more at 70)
 */

export interface DeferralScenario {
  startAge: number;
  adjustmentPct: number;   // e.g. -36% for CPP at 60, +42% for CPP at 70
  monthlyAmount: number;   // adjusted monthly amount
  annualAmount: number;    // adjusted annual amount
  cumulativeByAge: number[];  // cumulative received at each age from 60 to 90
  breakEvenVs65: number | null; // age at which this option surpasses age-65 start
}

export function computeCPPDeferral(
  monthlyAt65: number,
  inflationRate: number = 0,
): DeferralScenario[] {
  const scenarios: DeferralScenario[] = [];

  for (let startAge = 60; startAge <= 70; startAge++) {
    let adjustmentPct: number;
    if (startAge < 65) {
      adjustmentPct = (startAge - 65) * 0.072; // -7.2%/yr for each year early
    } else if (startAge > 65) {
      adjustmentPct = (startAge - 65) * 0.084; // +8.4%/yr for each year deferred
    } else {
      adjustmentPct = 0;
    }

    const monthlyAmount = monthlyAt65 * (1 + adjustmentPct);
    const annualAmount = monthlyAmount * 12;

    // Compute cumulative from age 60 to 90 (index 0 = age 60)
    const cumulative: number[] = [];
    let total = 0;
    for (let age = 60; age <= 90; age++) {
      if (age >= startAge) {
        const yearsReceiving = age - startAge;
        const inflatedAnnual = annualAmount * Math.pow(1 + inflationRate, yearsReceiving);
        total += inflatedAnnual;
      }
      cumulative.push(total);
    }

    scenarios.push({
      startAge,
      adjustmentPct,
      monthlyAmount,
      annualAmount,
      cumulativeByAge: cumulative,
      breakEvenVs65: null, // computed below
    });
  }

  // Compute break-even vs age 65
  const base65 = scenarios.find(s => s.startAge === 65)!;
  for (const s of scenarios) {
    if (s.startAge === 65) continue;
    let found = false;
    for (let i = 0; i < s.cumulativeByAge.length; i++) {
      if (s.cumulativeByAge[i] >= base65.cumulativeByAge[i] && s.cumulativeByAge[i] > 0 && base65.cumulativeByAge[i] > 0) {
        // Only count as break-even if this scenario was behind at some point
        if (s.startAge > 65 && i > 0 && s.cumulativeByAge[i - 1] < base65.cumulativeByAge[i - 1]) {
          s.breakEvenVs65 = 60 + i;
          found = true;
          break;
        }
        if (s.startAge < 65 && i > 0 && s.cumulativeByAge[i - 1] > base65.cumulativeByAge[i - 1]) {
          // Early start: break-even is when 65-start catches up
          s.breakEvenVs65 = 60 + i;
          found = true;
          break;
        }
      }
    }
    if (!found && s.startAge < 65) {
      // For early start, find when age-65 catches up to early start
      for (let i = 0; i < s.cumulativeByAge.length; i++) {
        if (base65.cumulativeByAge[i] >= s.cumulativeByAge[i] && base65.cumulativeByAge[i] > 0) {
          s.breakEvenVs65 = 60 + i;
          break;
        }
      }
    }
  }

  return scenarios;
}

export function computeOASDeferral(
  monthlyAt65: number,
  inflationRate: number = 0,
): DeferralScenario[] {
  const scenarios: DeferralScenario[] = [];

  // OAS can only be deferred from 65 to 70
  for (let startAge = 65; startAge <= 70; startAge++) {
    const adjustmentPct = (startAge - 65) * 0.072; // +7.2%/yr
    const monthlyAmount = monthlyAt65 * (1 + adjustmentPct);
    const annualAmount = monthlyAmount * 12;

    const cumulative: number[] = [];
    let total = 0;
    for (let age = 65; age <= 90; age++) {
      if (age >= startAge) {
        const yearsReceiving = age - startAge;
        const inflatedAnnual = annualAmount * Math.pow(1 + inflationRate, yearsReceiving);
        total += inflatedAnnual;
      }
      cumulative.push(total);
    }

    scenarios.push({
      startAge,
      adjustmentPct,
      monthlyAmount,
      annualAmount,
      cumulativeByAge: cumulative,
      breakEvenVs65: null,
    });
  }

  // Compute break-even vs age 65
  const base65 = scenarios.find(s => s.startAge === 65)!;
  for (const s of scenarios) {
    if (s.startAge === 65) continue;
    for (let i = 0; i < s.cumulativeByAge.length; i++) {
      if (s.cumulativeByAge[i] >= base65.cumulativeByAge[i] && base65.cumulativeByAge[i] > 0) {
        s.breakEvenVs65 = 65 + i;
        break;
      }
    }
  }

  return scenarios;
}
