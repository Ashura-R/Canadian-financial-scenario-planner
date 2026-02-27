/**
 * TFSA historical annual limits (CRA verified):
 * https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html
 */
const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500,
  2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500,
  2024: 7000, 2025: 7000, 2026: 7000,
};

/**
 * Compute accumulated TFSA contribution room from age 18 to startYear - 1,
 * assuming zero contributions and zero withdrawals.
 *
 * @param birthYear - Year of birth
 * @param startYear - First year of the simulation (room is as-of Jan 1 of this year)
 * @param currentAnnualLimit - Fallback limit for years beyond the lookup table
 * @returns Total accumulated TFSA room (0 if not yet 18 by startYear)
 */
export function computeAccumulatedTfsaRoom(
  birthYear: number,
  startYear: number,
  currentAnnualLimit: number,
  overrideOpeningYear?: number,
): number {
  // TFSA started in 2009; eligible at age 18 (or override)
  const firstEligibleYear = overrideOpeningYear
    ? Math.max(2009, overrideOpeningYear)
    : Math.max(2009, birthYear + 18);

  if (firstEligibleYear >= startYear) return 0; // not yet 18 or no years to accumulate

  let total = 0;
  for (let y = firstEligibleYear; y < startYear; y++) {
    total += TFSA_ANNUAL_LIMITS[y] ?? currentAnnualLimit;
  }
  return total;
}
