import { makeDefaultScenario, makeDefaultYear } from '../../store/defaults';
import type { Scenario, ScheduledItem, ScheduledField, YearData } from '../../types/scenario';

/** Build a minimal valid Scenario with optional overrides */
export function makeTestScenario(overrides: Partial<Scenario> & { yearOverrides?: Partial<YearData>[] } = {}): Scenario {
  const base = makeDefaultScenario('Test');
  const { yearOverrides, ...scenarioOverrides } = overrides;

  const merged = { ...base, ...scenarioOverrides };

  // Apply per-year overrides if provided
  if (yearOverrides) {
    merged.years = merged.years.map((y, i) => {
      const ov = yearOverrides[i];
      return ov ? { ...y, ...ov } : y;
    });
  }

  return merged;
}

/** Build a ScheduledItem with sensible defaults */
export function makeTestSchedule(overrides: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    label: overrides.label ?? 'Test Rule',
    field: overrides.field ?? ('employmentIncome' as ScheduledField),
    startYear: overrides.startYear ?? 2025,
    endYear: overrides.endYear,
    amount: overrides.amount ?? 1000,
    amountType: overrides.amountType,
    amountReference: overrides.amountReference,
    amountMin: overrides.amountMin,
    amountMax: overrides.amountMax,
    amountMaxRef: overrides.amountMaxRef,
    conditions: overrides.conditions,
    growthRate: overrides.growthRate,
    growthType: overrides.growthType,
  };
}

/** Get a specific year's computed data by year number */
export function getYear<T extends { year: number }>(years: T[], year: number): T | undefined {
  return years.find(y => y.year === year);
}
