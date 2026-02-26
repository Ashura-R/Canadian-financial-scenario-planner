import type { Scenario, OpeningBalances, ScheduledItem, YearData, ScheduleCondition, Assumptions, Liability } from '../types/scenario';
import type { ComputedScenario, ComputedYear, ComputedRetirement, ComputedTaxDetail, ComputedACB, ComputedLiability } from '../types/computed';
import { computeCPP, computeEI, computeTax } from './taxEngine';
import type { RetirementIncome } from './taxEngine';
import { computeAccounts, computeWaterfall } from './accountEngine';
import type { ReturnOverrides } from './accountEngine';
import { computeAnalytics } from './analyticsEngine';
import { validateYear } from './validationEngine';
import { computeACB } from './acbEngine';

// CRA RRIF minimum withdrawal factors by age
const RRIF_FACTORS: Record<number, number> = {
  71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
  76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
  81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
  86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
  91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879,
};

function getRRIFFactor(age: number): number {
  if (age < 71) return 0;
  if (age >= 95) return 0.20;
  return RRIF_FACTORS[age] ?? 0.20;
}

/** Compute one year of liability amortization */
function computeLiabilityYear(
  liabilities: Liability[],
  prevBalances: number[], // opening balance per liability
): { computed: ComputedLiability[]; newBalances: number[] } {
  const computed: ComputedLiability[] = [];
  const newBalances: number[] = [];

  for (let i = 0; i < liabilities.length; i++) {
    const l = liabilities[i];
    const opening = prevBalances[i];
    if (opening <= 0) {
      computed.push({ id: l.id, label: l.label, openingBalance: 0, interestPaid: 0, principalPaid: 0, totalPayment: 0, closingBalance: 0 });
      newBalances.push(0);
      continue;
    }

    // Simplified annual amortization: interest accrues on opening balance
    const annualInterest = opening * l.annualRate;
    const annualPayment = l.monthlyPayment * 12;
    const actualPayment = Math.min(annualPayment, opening + annualInterest);
    const interestPaid = Math.min(annualInterest, actualPayment);
    const principalPaid = Math.max(0, actualPayment - interestPaid);
    const closing = Math.max(0, opening - principalPaid);

    computed.push({
      id: l.id,
      label: l.label,
      openingBalance: opening,
      interestPaid,
      principalPaid,
      totalPayment: actualPayment,
      closingBalance: closing,
    });
    newBalances.push(closing);
  }

  return { computed, newBalances };
}

/** Evaluate a single condition against computed values */
function evaluateCondition(cond: ScheduleCondition, vals: Record<string, number>): boolean {
  const actual = vals[cond.field] ?? 0;
  switch (cond.operator) {
    case '>': return actual > cond.value;
    case '<': return actual < cond.value;
    case '>=': return actual >= cond.value;
    case '<=': return actual <= cond.value;
    case '==': return Math.abs(actual - cond.value) < 0.01;
    case 'between': return actual >= cond.value && actual <= (cond.value2 ?? cond.value);
    default: return true;
  }
}

/** Build condition evaluation context from a computed year */
function buildConditionContext(computed: ComputedYear, rawYd: YearData): Record<string, number> {
  return {
    grossIncome: computed.waterfall.grossIncome,
    netTaxableIncome: computed.tax.netTaxableIncome,
    afterTaxIncome: computed.waterfall.afterTaxIncome,
    netCashFlow: computed.waterfall.netCashFlow,
    netWorth: computed.accounts.netWorth,
    totalIncomeTax: computed.tax.totalIncomeTax,
    employmentIncome: rawYd.employmentIncome,
    selfEmploymentIncome: rawYd.selfEmploymentIncome,
    rrspEOY: computed.accounts.rrspEOY,
    tfsaEOY: computed.accounts.tfsaEOY,
    fhsaEOY: computed.accounts.fhsaEOY,
    nonRegEOY: computed.accounts.nonRegEOY,
    savingsEOY: computed.accounts.savingsEOY,
    rrspUnusedRoom: computed.rrspUnusedRoom,
    tfsaUnusedRoom: computed.tfsaUnusedRoom,
    capitalGainsRealized: rawYd.capitalGainsRealized,
    capitalLossCF: computed.capitalLossCF,
    age: computed.retirement.age ?? 0,
  };
}

/** Resolve a dynamic max reference to a numeric cap value */
function resolveMaxRef(
  ref: string,
  computed: ComputedYear,
  prevBalances: OpeningBalances,
  assumptions: Scenario['assumptions'],
  fhsaContribLifetime: number,
  fhsaUnusedRoom: number,
): number {
  switch (ref) {
    case 'rrspRoom': return computed.rrspUnusedRoom;
    case 'tfsaRoom': return computed.tfsaUnusedRoom + computed.tfsaRoomGenerated;
    case 'fhsaRoom': return assumptions.fhsaAnnualLimit + Math.min(fhsaUnusedRoom, assumptions.fhsaAnnualLimit);
    case 'fhsaLifetimeRoom': return Math.max(0, assumptions.fhsaLifetimeLimit - fhsaContribLifetime);
    case 'rrspBalance': return prevBalances.rrsp;
    case 'tfsaBalance': return prevBalances.tfsa;
    case 'fhsaBalance': return prevBalances.fhsa;
    case 'nonRegBalance': return prevBalances.nonReg;
    case 'savingsBalance': return prevBalances.savings;
    case 'capitalLossCF': return computed.capitalLossCF;
    default: return Infinity;
  }
}

/** Calculate growth-adjusted amount for a scheduled item */
export function getScheduledAmount(item: ScheduledItem, year: number, inflationRate: number): number {
  const yearsElapsed = year - item.startYear;
  if (yearsElapsed <= 0) return item.amount;
  const rate = item.growthType === 'inflation' ? inflationRate : (item.growthRate ?? 0);
  return item.amount * Math.pow(1 + rate, yearsElapsed);
}

/** Apply scheduled items to a year's data. If prevComputed provided, evaluates conditions & percentage amounts. */
function applySchedules(
  yd: YearData,
  schedules: ScheduledItem[],
  inflationRate: number,
  prevComputed: ComputedYear | null,
  conditionalOnly: boolean,
  prevBalances?: OpeningBalances,
  assumptions?: Scenario['assumptions'],
  fhsaContribLifetime?: number,
  fhsaUnusedRoom?: number,
): YearData {
  const result = { ...yd };
  for (const s of schedules) {
    if (yd.year < s.startYear) continue;
    if (s.endYear !== undefined && yd.year > s.endYear) continue;

    const hasConditions = s.conditions && s.conditions.length > 0;
    const isPercentage = s.amountType === 'percentage';
    const hasMaxRef = !!s.amountMaxRef;
    const needsComputed = hasConditions || isPercentage || hasMaxRef;

    // In first pass, skip items needing computed context. In second pass, only process those.
    if (conditionalOnly && !needsComputed) continue;
    if (!conditionalOnly && needsComputed) continue;

    // Build context once if needed
    let ctx: Record<string, number> | null = null;
    if (needsComputed && prevComputed) {
      ctx = buildConditionContext(prevComputed, yd);
    } else if (needsComputed && !prevComputed) {
      // No computed data to evaluate against yet — skip
      continue;
    }

    // Evaluate conditions against computed context
    if (hasConditions && ctx) {
      const allPass = s.conditions!.every(c => evaluateCondition(c, ctx!));
      if (!allPass) continue;
    }

    // Only apply if the field is still 0 (user hasn't manually entered a value)
    const field = s.field as keyof YearData;
    if ((result[field] as number) === 0) {
      let amount: number;
      if (isPercentage && ctx && s.amountReference) {
        const refValue = ctx[s.amountReference] ?? 0;
        const pct = getScheduledAmount(s, yd.year, inflationRate); // growth-adjusted percentage
        amount = pct * refValue;
      } else {
        amount = getScheduledAmount(s, yd.year, inflationRate);
      }
      // Apply min/max caps
      if (s.amountMin !== undefined && s.amountMin > 0) amount = Math.max(amount, s.amountMin);
      if (s.amountMax !== undefined && s.amountMax > 0) amount = Math.min(amount, s.amountMax);
      // Apply dynamic max ref cap
      if (hasMaxRef && prevComputed && prevBalances && assumptions) {
        const dynamicMax = resolveMaxRef(
          s.amountMaxRef!, prevComputed, prevBalances, assumptions,
          fhsaContribLifetime ?? 0, fhsaUnusedRoom ?? 0,
        );
        amount = Math.min(amount, Math.max(0, dynamicMax));
      }
      (result as any)[field] = amount;
    }
  }
  return result;
}

/** Check if any schedule items need computed context (conditions or percentage amounts) */
function hasConditionalSchedules(schedules: ScheduledItem[], year: number): boolean {
  return schedules.some(s => {
    if (year < s.startYear) return false;
    if (s.endYear !== undefined && year > s.endYear) return false;
    return (s.conditions && s.conditions.length > 0) || s.amountType === 'percentage' || !!s.amountMaxRef;
  });
}

function computeOneYear(
  yd: YearData,
  assumptions: Scenario['assumptions'],
  prevBalances: OpeningBalances,
  capitalLossCF: number,
  rrspUnusedRoom: number,
  fhsaContribLifetime: number,
  fhsaUnusedRoom: number,
  tfsaUnusedRoom: number,
  tfsaRoomGenerated: number,
  inflationFactor: number,
  returnOverrides: ReturnOverrides | undefined,
  fhsaDisposed: boolean = false,
  acbEnabled: boolean = false,
  prevACB: number = 0,
  autoComputeGains: boolean = false,
  priorYearEarnedIncome: number = 0,
  fhsaOpeningYear: number | null = null,
): {
  computed: ComputedYear;
  newCapitalLossCF: number;
  newRrspUnusedRoom: number;
  newFhsaContribLifetime: number;
  newFhsaUnusedRoom: number;
  newTfsaUnusedRoom: number;
  newBalances: OpeningBalances;
  newACB: number;
} {
  const birthYear = assumptions.birthYear ?? null;
  const retSettings = assumptions.retirement ?? {
    cppBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 },
    oasBenefit: { enabled: false, monthlyAmount: 0, startAge: 65 },
    rrifConversionAge: 71,
  };

  const age = birthYear !== null ? yd.year - birthYear : null;
  const isRRIF = age !== null && age >= retSettings.rrifConversionAge;

  const rrifMinWithdrawal = isRRIF && age !== null
    ? prevBalances.rrsp * getRRIFFactor(age)
    : 0;

  const effectiveRrspWithdrawal = isRRIF
    ? Math.max(yd.rrspWithdrawal, rrifMinWithdrawal)
    : yd.rrspWithdrawal;

  const ydEffective = effectiveRrspWithdrawal !== yd.rrspWithdrawal
    ? { ...yd, rrspWithdrawal: effectiveRrspWithdrawal }
    : yd;

  let cppBenefitIncome = 0;
  if (retSettings.cppBenefit.enabled && age !== null && age >= retSettings.cppBenefit.startAge) {
    const cppStartYear = birthYear! + retSettings.cppBenefit.startAge;
    const yearsReceiving = yd.year - cppStartYear;
    cppBenefitIncome = retSettings.cppBenefit.monthlyAmount * 12 *
      Math.pow(1 + assumptions.inflationRate, yearsReceiving);
  }

  let oasIncome = 0;
  if (retSettings.oasBenefit.enabled && age !== null && age >= retSettings.oasBenefit.startAge) {
    const oasStartYear = birthYear! + retSettings.oasBenefit.startAge;
    const yearsReceiving = yd.year - oasStartYear;
    oasIncome = retSettings.oasBenefit.monthlyAmount * 12 *
      Math.pow(1 + assumptions.inflationRate, yearsReceiving);
  }

  const retirementIncome: RetirementIncome = { cppBenefitIncome, oasIncome };

  const warnings = validateYear(
    ydEffective, assumptions, rrspUnusedRoom, fhsaContribLifetime, capitalLossCF,
    tfsaUnusedRoom + tfsaRoomGenerated, prevBalances, isRRIF, fhsaDisposed, fhsaUnusedRoom,
    fhsaOpeningYear, age, yd.year,
  );

  let lossCFBeforeApply = capitalLossCF + ydEffective.capitalLossesRealized;
  let lossApplied = Math.min(ydEffective.capitalLossApplied, lossCFBeforeApply);

  const cpp = computeCPP(ydEffective.employmentIncome, ydEffective.selfEmploymentIncome, assumptions.cpp);
  const ei = computeEI(ydEffective.employmentIncome, ydEffective.selfEmploymentIncome, assumptions.ei);

  // Compute accounts FIRST (needed for ACB)
  const accounts = computeAccounts(ydEffective, assumptions, prevBalances, returnOverrides);

  // ACB tracking
  let acbResult: ComputedACB | undefined;
  let ydForTax = { ...ydEffective, capitalLossApplied: lossApplied };
  if (acbEnabled) {
    acbResult = computeACB(
      ydEffective.nonRegContribution,
      ydEffective.nonRegWithdrawal,
      prevACB,
      prevBalances.nonReg,
      accounts.nonRegEOY,
    );
    // When auto-compute gains: replace manual CG/CL with ACB-computed values
    if (autoComputeGains) {
      if (acbResult.computedCapitalGain > 0) {
        ydForTax = { ...ydForTax, capitalGainsRealized: acbResult.computedCapitalGain, capitalLossesRealized: 0 };
      } else if (acbResult.computedCapitalGain < 0) {
        ydForTax = { ...ydForTax, capitalGainsRealized: 0, capitalLossesRealized: Math.abs(acbResult.computedCapitalGain) };
      } else {
        ydForTax = { ...ydForTax, capitalGainsRealized: 0, capitalLossesRealized: 0 };
      }
      // Recompute loss tracking with ACB-derived values
      lossCFBeforeApply = capitalLossCF + ydForTax.capitalLossesRealized;
      lossApplied = Math.min(ydForTax.capitalLossApplied, lossCFBeforeApply);
      ydForTax = { ...ydForTax, capitalLossApplied: lossApplied };
    }
  }

  const taxResult = computeTax(ydForTax, assumptions, cpp, ei, retirementIncome, assumptions.province, age, isRRIF);
  const { detail: taxDetail, ...tax } = taxResult;
  const waterfall = computeWaterfall(ydEffective, cpp, ei, tax, accounts, retirementIncome);

  const retirement: ComputedRetirement = {
    age,
    cppIncome: cppBenefitIncome,
    oasIncome,
    isRRIF,
    rrifMinWithdrawal,
  };

  const realGrossIncome = waterfall.grossIncome / inflationFactor;
  const realAfterTaxIncome = waterfall.afterTaxIncome / inflationFactor;
  const realNetWorth = accounts.netWorth / inflationFactor;
  const realNetCashFlow = waterfall.netCashFlow / inflationFactor;

  const newTfsaUnusedRoom = Math.max(0, tfsaUnusedRoom + tfsaRoomGenerated - ydEffective.tfsaContribution);

  const computedYear: ComputedYear = {
    year: ydEffective.year,
    cpp,
    ei,
    tax,
    taxDetail,
    accounts,
    waterfall,
    retirement,
    inflationFactor,
    realGrossIncome,
    realAfterTaxIncome,
    realNetWorth,
    realNetCashFlow,
    tfsaUnusedRoom: newTfsaUnusedRoom,
    tfsaRoomGenerated,
    capitalLossCF: Math.max(0, lossCFBeforeApply - lossApplied),
    rrspUnusedRoom,
    fhsaContribLifetime,
    fhsaUnusedRoom,
    acb: acbResult,
    warnings,
  };

  const newCapitalLossCF = Math.max(0, lossCFBeforeApply - lossApplied);

  const newRrspRoom = isRRIF
    ? 0
    : Math.min(priorYearEarnedIncome * assumptions.rrspPctEarnedIncome, assumptions.rrspLimit);
  const newRrspUnusedRoom = Math.max(0, rrspUnusedRoom + newRrspRoom - ydEffective.rrspDeductionClaimed);

  const newFhsaContribLifetime = fhsaContribLifetime + ydEffective.fhsaContribution;
  const newFhsaUnusedRoom = Math.min(
    fhsaUnusedRoom + assumptions.fhsaAnnualLimit - ydEffective.fhsaContribution,
    assumptions.fhsaAnnualLimit
  );

  const newBalances: OpeningBalances = {
    rrsp: accounts.rrspEOY,
    tfsa: accounts.tfsaEOY,
    fhsa: accounts.fhsaEOY,
    nonReg: accounts.nonRegEOY,
    savings: accounts.savingsEOY,
  };

  return {
    computed: computedYear,
    newCapitalLossCF,
    newRrspUnusedRoom,
    newFhsaContribLifetime,
    newFhsaUnusedRoom,
    newTfsaUnusedRoom,
    newBalances,
    newACB: acbResult?.closingACB ?? prevACB,
  };
}

export function compute(scenario: Scenario): ComputedScenario {
  const { assumptions, openingBalances, years } = scenario;
  const schedules = scenario.scheduledItems ?? [];
  const fhsaSettings = assumptions.fhsa;
  const acbConfig = scenario.acbConfig;
  const acbEnabled = !!acbConfig;
  const autoComputeGains = acbConfig?.autoComputeGains ?? false;

  const ocf = scenario.openingCarryForwards;
  let prevBalances: OpeningBalances = { ...openingBalances };
  let capitalLossCF = ocf?.capitalLossCF ?? 0;
  let rrspUnusedRoom = ocf?.rrspUnusedRoom ?? 0;
  let fhsaContribLifetime = ocf?.fhsaContribLifetime ?? 0;
  let fhsaUnusedRoom = 0;
  let tfsaUnusedRoom = ocf?.tfsaUnusedRoom ?? 0;
  let prevYearTfsaWithdrawals = 0;
  let inflationFactor = 1;
  let fhsaDisposed = false;
  // FHSA opening year tracking: opened if there's an opening balance or first contribution
  let fhsaOpeningYear: number | null = openingBalances.fhsa > 0 || fhsaContribLifetime > 0
    ? (assumptions.startYear - 1) // assume opened before start year if has balance/contribs
    : null;
  let prevACB = acbConfig?.openingACB ?? openingBalances.nonReg;
  let priorYearEarnedIncome = ocf?.priorYearEarnedIncome ?? 0;

  // HBP tracking
  const hbpSettings = assumptions.hbp;
  let hbpBalance = 0; // remaining balance to repay
  let hbpOriginalAmount = 0; // original withdrawal amount (for 1/15 calc)
  let hbpRepaymentStartYear = 0; // year repayments start

  // Liability tracking
  const liabilities = scenario.liabilities ?? [];
  let liabilityBalances = liabilities.map(l => l.openingBalance);

  const computedYears: ComputedYear[] = [];

  for (const rawYd of years) {
    // Per-year return overrides
    const returnOverrides: ReturnOverrides | undefined =
      (rawYd.equityReturnOverride !== undefined || rawYd.fixedIncomeReturnOverride !== undefined ||
       rawYd.cashReturnOverride !== undefined || rawYd.savingsReturnOverride !== undefined)
        ? {
            equity: rawYd.equityReturnOverride,
            fixedIncome: rawYd.fixedIncomeReturnOverride,
            cash: rawYd.cashReturnOverride,
            savings: rawYd.savingsReturnOverride,
          }
        : undefined;

    // Per-year inflation override
    const effectiveInflation = rawYd.inflationRateOverride ?? assumptions.inflationRate;
    inflationFactor *= (1 + effectiveInflation);

    // FHSA disposition handling
    let ydWithFHSA = { ...rawYd };
    if (fhsaSettings) {
      const dispYear = fhsaSettings.dispositionYear;
      const disp = fhsaSettings.disposition;

      if (fhsaDisposed) {
        // After disposition year: block further FHSA contributions
        ydWithFHSA.fhsaContribution = 0;
        ydWithFHSA.fhsaDeductionClaimed = 0;
      }

      if (dispYear !== undefined && rawYd.year === dispYear && disp !== 'active') {
        const fhsaBalance = prevBalances.fhsa;

        if (disp === 'home-purchase') {
          // Tax-free withdrawal of full balance
          ydWithFHSA.fhsaWithdrawal = fhsaBalance;
          ydWithFHSA.fhsaContribution = 0;
          ydWithFHSA.fhsaDeductionClaimed = 0;
        } else if (disp === 'transfer-rrsp') {
          // Transfer to RRSP (no tax, doesn't use RRSP room)
          // We'll add balance to RRSP by adjusting opening balances after computation
          ydWithFHSA.fhsaWithdrawal = fhsaBalance;
          ydWithFHSA.fhsaContribution = 0;
          ydWithFHSA.fhsaDeductionClaimed = 0;
        } else if (disp === 'taxable-close') {
          // Withdraw full balance, add to taxable income
          ydWithFHSA.fhsaWithdrawal = fhsaBalance;
          ydWithFHSA.otherTaxableIncome = (rawYd.otherTaxableIncome || 0) + fhsaBalance;
          ydWithFHSA.fhsaContribution = 0;
          ydWithFHSA.fhsaDeductionClaimed = 0;
        }

        fhsaDisposed = true;
      }
    }

    // FHSA 15-year / age-71 auto-close
    if (!fhsaDisposed && prevBalances.fhsa > 0) {
      // Track opening year from first contribution
      if (fhsaOpeningYear === null && (ydWithFHSA.fhsaContribution > 0 || prevBalances.fhsa > 0)) {
        fhsaOpeningYear = rawYd.year;
      }
      const yearsOpen = fhsaOpeningYear !== null ? rawYd.year - fhsaOpeningYear : 0;
      const fhsaAge = assumptions.birthYear != null ? rawYd.year - assumptions.birthYear : null;
      const mustClose = yearsOpen >= 15 || (fhsaAge !== null && fhsaAge >= 71);

      if (mustClose && !fhsaDisposed) {
        // Auto-transfer to RRSP (CRA default)
        const fhsaBalance = prevBalances.fhsa;
        ydWithFHSA.fhsaWithdrawal = fhsaBalance;
        ydWithFHSA.fhsaContribution = 0;
        ydWithFHSA.fhsaDeductionClaimed = 0;
        fhsaDisposed = true;
        // Transfer to RRSP will be handled below like 'transfer-rrsp' disposition
      }
    } else if (!fhsaDisposed && fhsaOpeningYear === null && ydWithFHSA.fhsaContribution > 0) {
      fhsaOpeningYear = rawYd.year;
    }

    // --- HBP: Home Buyers' Plan ---
    let hbpRepaymentRequired = 0;
    let hbpRepaymentMade = 0;
    let hbpTaxableShortfall = 0;
    let hbpWithdrawalThisYear = 0;

    if (hbpSettings && rawYd.year === hbpSettings.withdrawalYear && hbpBalance === 0) {
      // HBP withdrawal year: tax-free RRSP withdrawal
      hbpWithdrawalThisYear = Math.min(hbpSettings.withdrawalAmount, prevBalances.rrsp);
      if (hbpWithdrawalThisYear > 0) {
        // Reduce RRSP balance directly (tax-free, so don't add to rrspWithdrawal which is taxable)
        prevBalances = { ...prevBalances, rrsp: prevBalances.rrsp - hbpWithdrawalThisYear };
        hbpBalance = hbpWithdrawalThisYear;
        hbpOriginalAmount = hbpWithdrawalThisYear;
        const delay = hbpSettings.repaymentStartDelay ?? 2;
        hbpRepaymentStartYear = rawYd.year + delay;
      }
    }

    if (hbpBalance > 0 && rawYd.year >= hbpRepaymentStartYear) {
      // Annual required repayment: 1/15 of original amount (or remaining balance if less)
      hbpRepaymentRequired = Math.min(hbpBalance, Math.ceil(hbpOriginalAmount / 15));
      // Repayment comes from RRSP contributions (designated as HBP repayment)
      // These contributions don't generate RRSP deductions — they repay HBP
      hbpRepaymentMade = Math.min(ydWithFHSA.rrspContribution, hbpRepaymentRequired);
      hbpTaxableShortfall = Math.max(0, hbpRepaymentRequired - hbpRepaymentMade);
      // Shortfall is added to taxable income
      if (hbpTaxableShortfall > 0) {
        ydWithFHSA = { ...ydWithFHSA };
        ydWithFHSA.otherTaxableIncome = (ydWithFHSA.otherTaxableIncome || 0) + hbpTaxableShortfall;
      }
      // HBP repayment portion of RRSP contributions should not generate RRSP deductions
      if (hbpRepaymentMade > 0) {
        ydWithFHSA = { ...ydWithFHSA };
        ydWithFHSA.rrspDeductionClaimed = Math.max(0, ydWithFHSA.rrspDeductionClaimed - hbpRepaymentMade);
      }
      // Reduce HBP balance
      hbpBalance = Math.max(0, hbpBalance - hbpRepaymentRequired);
    }

    // TFSA room for this year: annual limit + prior-year withdrawals restore room
    // TFSA room only accrues from age 18 (when birthYear is known)
    const age = assumptions.birthYear != null ? rawYd.year - assumptions.birthYear : null;
    const tfsaEligible = age === null || age >= 18;
    const tfsaRoomGenerated = tfsaEligible
      ? assumptions.tfsaAnnualLimit + prevYearTfsaWithdrawals
      : 0;

    // Deductible interest from investment loans (computed from prior year's liability balances)
    if (liabilities.length > 0) {
      const deductibleInt = liabilities.reduce((s, l, i) =>
        l.isInvestmentLoan ? s + liabilityBalances[i] * l.annualRate : s, 0);
      if (deductibleInt > 0) {
        ydWithFHSA = { ...ydWithFHSA };
        // Subtract from other taxable income as a deduction (can go negative → net deduction)
        ydWithFHSA.otherTaxableIncome = (ydWithFHSA.otherTaxableIncome || 0) - deductibleInt;
      }
    }

    // Pass 1: Apply non-conditional scheduled items
    const ydPass1 = applySchedules(ydWithFHSA, schedules, assumptions.inflationRate, null, false,
      prevBalances, assumptions, fhsaContribLifetime, fhsaUnusedRoom);

    const pass1 = computeOneYear(
      ydPass1, assumptions, prevBalances,
      capitalLossCF, rrspUnusedRoom, fhsaContribLifetime, fhsaUnusedRoom,
      tfsaUnusedRoom, tfsaRoomGenerated,
      inflationFactor, returnOverrides, fhsaDisposed,
      acbEnabled, prevACB, autoComputeGains,
      priorYearEarnedIncome, fhsaOpeningYear,
    );

    // Pass 2: Check if conditional schedules apply, if so recompute
    let finalResult = pass1;
    if (hasConditionalSchedules(schedules, rawYd.year)) {
      const ydPass2 = applySchedules(ydWithFHSA, schedules, assumptions.inflationRate, pass1.computed, true,
        prevBalances, assumptions, fhsaContribLifetime, fhsaUnusedRoom);
      // Merge: apply non-conditional again on the base, then conditional on top
      const ydMerged = applySchedules(ydPass2, schedules, assumptions.inflationRate, null, false,
        prevBalances, assumptions, fhsaContribLifetime, fhsaUnusedRoom);

      // Check if anything changed
      const pass1Keys = Object.keys(ydPass1) as (keyof YearData)[];
      let changed = false;
      for (const k of pass1Keys) {
        if (ydMerged[k] !== ydPass1[k]) { changed = true; break; }
      }

      if (changed) {
        finalResult = computeOneYear(
          ydMerged, assumptions, prevBalances,
          capitalLossCF, rrspUnusedRoom, fhsaContribLifetime, fhsaUnusedRoom,
          tfsaUnusedRoom, tfsaRoomGenerated,
          inflationFactor, returnOverrides, fhsaDisposed,
          acbEnabled, prevACB, autoComputeGains,
          priorYearEarnedIncome, fhsaOpeningYear,
        );
      }
    }

    // Attach HBP tracking fields to computed year
    const computedYear = finalResult.computed;
    if (hbpBalance > 0 || hbpWithdrawalThisYear > 0) {
      computedYear.hbpBalance = hbpBalance;
    }
    if (hbpRepaymentRequired > 0) {
      computedYear.hbpRepaymentRequired = hbpRepaymentRequired;
      computedYear.hbpRepaymentMade = hbpRepaymentMade;
      computedYear.hbpTaxableShortfall = hbpTaxableShortfall;
    }

    // Compute liabilities
    if (liabilities.length > 0) {
      const liabResult = computeLiabilityYear(liabilities, liabilityBalances);
      computedYear.liabilities = liabResult.computed;
      const totalDebt = liabResult.newBalances.reduce((s, b) => s + b, 0);
      const totalPayment = liabResult.computed.reduce((s, c) => s + c.totalPayment, 0);
      const totalInterest = liabResult.computed.reduce((s, c) => s + c.interestPaid, 0);
      const deductibleInterest = liabResult.computed.reduce((s, c, i) =>
        s + (liabilities[i].isInvestmentLoan ? c.interestPaid : 0), 0);
      computedYear.totalDebt = totalDebt;
      computedYear.totalDebtPayment = totalPayment;
      computedYear.totalInterestPaid = totalInterest;
      computedYear.deductibleInterest = deductibleInterest;
      // Adjust net worth to subtract total debt
      computedYear.accounts = { ...computedYear.accounts, netWorth: computedYear.accounts.netWorth - totalDebt };
      // Adjust real net worth
      computedYear.realNetWorth = computedYear.accounts.netWorth / inflationFactor;
      // Adjust net cash flow to subtract debt payments
      computedYear.waterfall = { ...computedYear.waterfall, netCashFlow: computedYear.waterfall.netCashFlow - totalPayment };
      computedYear.realNetCashFlow = computedYear.waterfall.netCashFlow / inflationFactor;
      liabilityBalances = liabResult.newBalances;
    }

    computedYears.push(computedYear);

    // Track TFSA withdrawals for next year's room restoration
    prevYearTfsaWithdrawals = rawYd.tfsaWithdrawal;

    // Update carry-forward state
    capitalLossCF = finalResult.newCapitalLossCF;
    rrspUnusedRoom = finalResult.newRrspUnusedRoom;
    fhsaContribLifetime = finalResult.newFhsaContribLifetime;
    fhsaUnusedRoom = finalResult.newFhsaUnusedRoom;
    tfsaUnusedRoom = finalResult.newTfsaUnusedRoom;
    prevACB = finalResult.newACB;
    priorYearEarnedIncome = rawYd.employmentIncome + rawYd.selfEmploymentIncome;
    prevBalances = { ...finalResult.newBalances };

    // FHSA transfer-rrsp: add FHSA balance to RRSP for next year
    // Applies to explicit transfer-rrsp disposition AND auto-close (which defaults to RRSP transfer)
    const isExplicitTransfer = fhsaSettings?.disposition === 'transfer-rrsp' && fhsaSettings.dispositionYear === rawYd.year;
    const isAutoClose = fhsaDisposed && prevBalances.fhsa > 0 && !isExplicitTransfer &&
      !(fhsaSettings?.disposition === 'home-purchase' && fhsaSettings?.dispositionYear === rawYd.year) &&
      !(fhsaSettings?.disposition === 'taxable-close' && fhsaSettings?.dispositionYear === rawYd.year);
    if (isExplicitTransfer || isAutoClose) {
      prevBalances.rrsp += prevBalances.fhsa;
      prevBalances.fhsa = 0;
    }
  }

  const analytics = computeAnalytics(computedYears);

  return {
    scenarioId: scenario.id,
    years: computedYears,
    analytics,
  };
}
