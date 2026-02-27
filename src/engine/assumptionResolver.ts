import type { Assumptions, AssumptionOverrides, TaxBracket } from '../types/scenario';

/** Index bracket dollar thresholds by a factor, keeping rates unchanged */
function indexBrackets(brackets: TaxBracket[], factor: number): TaxBracket[] {
  return brackets.map(b => ({
    min: Math.round(b.min * factor),
    max: b.max !== null ? Math.round(b.max * factor) : null,
    rate: b.rate,
  }));
}

/** Round to nearest $500 (CRA TFSA rounding convention) */
function roundToNearest500(value: number): number {
  return Math.round(value / 500) * 500;
}

/**
 * Resolve assumptions for a specific year by applying:
 * 1. Auto-indexing of dollar thresholds by cumulative inflation
 * 2. Manual overrides for that year (which replace auto-indexed values)
 *
 * @param base - The base assumptions (start-year values)
 * @param year - The year to resolve for
 * @param cumulativeInflationFactor - The compounded inflation factor from start year to this year
 *        e.g. for year 3 with 2.5% inflation each year: (1.025)^3
 * @param overrides - Per-year manual overrides map
 */
export function resolveAssumptions(
  base: Assumptions,
  year: number,
  cumulativeInflationFactor: number,
  overrides?: Record<number, AssumptionOverrides>,
): Assumptions {
  const autoIndex = base.autoIndexAssumptions !== false; // default true
  const factor = autoIndex ? cumulativeInflationFactor : 1;
  const yearOverrides = overrides?.[year];

  // Start with a shallow copy
  const resolved: Assumptions = { ...base };

  // --- Auto-index dollar thresholds ---
  if (factor !== 1) {
    // BPA
    resolved.federalBPA = Math.round(base.federalBPA * factor);
    resolved.provincialBPA = Math.round(base.provincialBPA * factor);

    // Brackets (index min/max, keep rates)
    resolved.federalBrackets = indexBrackets(base.federalBrackets, factor);
    resolved.provincialBrackets = indexBrackets(base.provincialBrackets, factor);

    // CPP
    resolved.cpp = {
      ...base.cpp,
      basicExemption: Math.round(base.cpp.basicExemption * factor),
      ympe: Math.round(base.cpp.ympe * factor),
      yampe: Math.round(base.cpp.yampe * factor),
    };

    // EI
    resolved.ei = {
      ...base.ei,
      maxInsurableEarnings: Math.round(base.ei.maxInsurableEarnings * factor),
    };

    // Account limits
    resolved.rrspLimit = Math.round(base.rrspLimit * factor);
    resolved.tfsaAnnualLimit = roundToNearest500(base.tfsaAnnualLimit * factor);
    resolved.fhsaAnnualLimit = Math.round(base.fhsaAnnualLimit * factor);
    resolved.fhsaLifetimeLimit = Math.round(base.fhsaLifetimeLimit * factor);

    // OAS clawback threshold
    if (base.oasClawbackThreshold !== undefined) {
      resolved.oasClawbackThreshold = Math.round(base.oasClawbackThreshold * factor);
    }

    // Federal employment amount
    if (base.federalEmploymentAmount !== undefined) {
      resolved.federalEmploymentAmount = Math.round(base.federalEmploymentAmount * factor);
    }
  }

  // --- Apply manual overrides for this year ---
  if (yearOverrides) {
    if (yearOverrides.federalBPA !== undefined) resolved.federalBPA = yearOverrides.federalBPA;
    if (yearOverrides.provincialBPA !== undefined) resolved.provincialBPA = yearOverrides.provincialBPA;
    if (yearOverrides.federalBrackets !== undefined) resolved.federalBrackets = yearOverrides.federalBrackets;
    if (yearOverrides.provincialBrackets !== undefined) resolved.provincialBrackets = yearOverrides.provincialBrackets;

    // CPP overrides
    if (yearOverrides.cppBasicExemption !== undefined || yearOverrides.cppYmpe !== undefined ||
        yearOverrides.cppYampe !== undefined || yearOverrides.cppEmployeeRate !== undefined ||
        yearOverrides.cppCpp2Rate !== undefined) {
      resolved.cpp = {
        ...resolved.cpp,
        ...(yearOverrides.cppBasicExemption !== undefined && { basicExemption: yearOverrides.cppBasicExemption }),
        ...(yearOverrides.cppYmpe !== undefined && { ympe: yearOverrides.cppYmpe }),
        ...(yearOverrides.cppYampe !== undefined && { yampe: yearOverrides.cppYampe }),
        ...(yearOverrides.cppEmployeeRate !== undefined && { employeeRate: yearOverrides.cppEmployeeRate }),
        ...(yearOverrides.cppCpp2Rate !== undefined && { cpp2Rate: yearOverrides.cppCpp2Rate }),
      };
    }

    // EI overrides
    if (yearOverrides.eiMaxInsurableEarnings !== undefined || yearOverrides.eiEmployeeRate !== undefined) {
      resolved.ei = {
        ...resolved.ei,
        ...(yearOverrides.eiMaxInsurableEarnings !== undefined && { maxInsurableEarnings: yearOverrides.eiMaxInsurableEarnings }),
        ...(yearOverrides.eiEmployeeRate !== undefined && { employeeRate: yearOverrides.eiEmployeeRate }),
      };
    }

    // Account limits
    if (yearOverrides.rrspLimit !== undefined) resolved.rrspLimit = yearOverrides.rrspLimit;
    if (yearOverrides.tfsaAnnualLimit !== undefined) resolved.tfsaAnnualLimit = yearOverrides.tfsaAnnualLimit;
    if (yearOverrides.fhsaAnnualLimit !== undefined) resolved.fhsaAnnualLimit = yearOverrides.fhsaAnnualLimit;
    if (yearOverrides.fhsaLifetimeLimit !== undefined) resolved.fhsaLifetimeLimit = yearOverrides.fhsaLifetimeLimit;

    // Policy rates (NOT auto-indexed, but overridable)
    if (yearOverrides.capitalGainsInclusionRate !== undefined) {
      resolved.capitalGainsInclusionRate = yearOverrides.capitalGainsInclusionRate;
    }

    // Dividend overrides
    if (yearOverrides.dividendEligibleGrossUp !== undefined ||
        yearOverrides.dividendEligibleFederalCredit !== undefined ||
        yearOverrides.dividendEligibleProvincialCredit !== undefined) {
      resolved.dividendRates = {
        ...resolved.dividendRates,
        eligible: {
          ...resolved.dividendRates.eligible,
          ...(yearOverrides.dividendEligibleGrossUp !== undefined && { grossUp: yearOverrides.dividendEligibleGrossUp }),
          ...(yearOverrides.dividendEligibleFederalCredit !== undefined && { federalCredit: yearOverrides.dividendEligibleFederalCredit }),
          ...(yearOverrides.dividendEligibleProvincialCredit !== undefined && { provincialCredit: yearOverrides.dividendEligibleProvincialCredit }),
        },
      };
    }

    if (yearOverrides.dividendNonEligibleGrossUp !== undefined ||
        yearOverrides.dividendNonEligibleFederalCredit !== undefined ||
        yearOverrides.dividendNonEligibleProvincialCredit !== undefined) {
      resolved.dividendRates = {
        ...resolved.dividendRates,
        nonEligible: {
          ...resolved.dividendRates.nonEligible,
          ...(yearOverrides.dividendNonEligibleGrossUp !== undefined && { grossUp: yearOverrides.dividendNonEligibleGrossUp }),
          ...(yearOverrides.dividendNonEligibleFederalCredit !== undefined && { federalCredit: yearOverrides.dividendNonEligibleFederalCredit }),
          ...(yearOverrides.dividendNonEligibleProvincialCredit !== undefined && { provincialCredit: yearOverrides.dividendNonEligibleProvincialCredit }),
        },
      };
    }

    // OAS clawback
    if (yearOverrides.oasClawbackThreshold !== undefined) {
      resolved.oasClawbackThreshold = yearOverrides.oasClawbackThreshold;
    }

    // Inflation override for this year (stored on AssumptionOverrides, used by compute loop for cumulative tracking)
    if (yearOverrides.inflationRate !== undefined) {
      resolved.inflationRate = yearOverrides.inflationRate;
    }
  }

  return resolved;
}
