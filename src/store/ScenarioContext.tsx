import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useMemo } from 'react';
import type { Scenario, AssumptionOverrides } from '../types/scenario';
import type { ComputedScenario } from '../types/computed';
import { compute } from '../engine';
import { makeDefaultScenario, makeDefaultYear } from './defaults';
import { DEFAULT_WHATIF, isWhatIfActive, applyWhatIfAdjustments } from '../engine/whatIfEngine';
import type { WhatIfAdjustments } from '../engine/whatIfEngine';

interface ScenarioState {
  scenarios: Scenario[];
  activeId: string;
  computed: Record<string, ComputedScenario>;
}

type Action =
  | { type: 'ADD_SCENARIO'; scenario: Scenario }
  | { type: 'UPDATE_SCENARIO'; scenario: Scenario }
  | { type: 'DELETE_SCENARIO'; id: string }
  | { type: 'DUPLICATE_SCENARIO'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'RENAME_SCENARIO'; id: string; name: string }
  | { type: 'SET_ASSUMPTION_OVERRIDE'; year: number; overrides: Partial<AssumptionOverrides> }
  | { type: 'DELETE_ASSUMPTION_OVERRIDE'; year: number; field?: keyof AssumptionOverrides }
  | { type: 'TOGGLE_AUTO_INDEX'; enabled: boolean };

function recompute(state: ScenarioState, ids?: string[]): ScenarioState {
  const toRecompute = ids ?? state.scenarios.map(s => s.id);
  const newComputed = { ...state.computed };
  for (const id of toRecompute) {
    const sc = state.scenarios.find(s => s.id === id);
    if (sc) {
      try {
        newComputed[id] = compute(sc);
      } catch (e) {
        console.error('Compute error for scenario', id, e);
        delete newComputed[id]; // clear stale data so CompareModal can filter it out
      }
    }
  }
  return { ...state, computed: newComputed };
}

function reducer(state: ScenarioState, action: Action): ScenarioState {
  switch (action.type) {
    case 'ADD_SCENARIO': {
      const next = { ...state, scenarios: [...state.scenarios, action.scenario], activeId: action.scenario.id };
      return recompute(next, [action.scenario.id]);
    }
    case 'UPDATE_SCENARIO': {
      const next = {
        ...state,
        scenarios: state.scenarios.map(s => s.id === action.scenario.id ? action.scenario : s),
      };
      return recompute(next, [action.scenario.id]);
    }
    case 'DELETE_SCENARIO': {
      const remaining = state.scenarios.filter(s => s.id !== action.id);
      const newComputed = { ...state.computed };
      delete newComputed[action.id];
      const newActiveId = state.activeId === action.id
        ? (remaining[remaining.length - 1]?.id ?? '')
        : state.activeId;
      return { scenarios: remaining, activeId: newActiveId, computed: newComputed };
    }
    case 'DUPLICATE_SCENARIO': {
      const original = state.scenarios.find(s => s.id === action.id);
      if (!original) return state;
      const copy: Scenario = {
        ...JSON.parse(JSON.stringify(original)),
        id: crypto.randomUUID(),
        name: original.name + ' (Copy)',
      };
      const next = { ...state, scenarios: [...state.scenarios, copy], activeId: copy.id };
      return recompute(next, [copy.id]);
    }
    case 'SET_ACTIVE':
      return { ...state, activeId: action.id };
    case 'RENAME_SCENARIO':
      return {
        ...state,
        scenarios: state.scenarios.map(s => s.id === action.id ? { ...s, name: action.name } : s),
      };
    case 'SET_ASSUMPTION_OVERRIDE': {
      const sc = state.scenarios.find(s => s.id === state.activeId);
      if (!sc) return state;
      const existing = sc.assumptionOverrides ?? {};
      const yearOv = existing[action.year] ?? {};
      const updated: Scenario = {
        ...sc,
        assumptionOverrides: {
          ...existing,
          [action.year]: { ...yearOv, ...action.overrides },
        },
      };
      const next = { ...state, scenarios: state.scenarios.map(s => s.id === sc.id ? updated : s) };
      return recompute(next, [sc.id]);
    }
    case 'DELETE_ASSUMPTION_OVERRIDE': {
      const sc = state.scenarios.find(s => s.id === state.activeId);
      if (!sc || !sc.assumptionOverrides) return state;
      const existing = { ...sc.assumptionOverrides };
      if (action.field) {
        // Delete single field from year
        if (existing[action.year]) {
          const yearOv = { ...existing[action.year] };
          delete yearOv[action.field];
          if (Object.keys(yearOv).length === 0) {
            delete existing[action.year];
          } else {
            existing[action.year] = yearOv;
          }
        }
      } else {
        // Delete entire year
        delete existing[action.year];
      }
      const updated: Scenario = { ...sc, assumptionOverrides: existing };
      const next = { ...state, scenarios: state.scenarios.map(s => s.id === sc.id ? updated : s) };
      return recompute(next, [sc.id]);
    }
    case 'TOGGLE_AUTO_INDEX': {
      const sc = state.scenarios.find(s => s.id === state.activeId);
      if (!sc) return state;
      const updated: Scenario = {
        ...sc,
        assumptions: { ...sc.assumptions, autoIndexAssumptions: action.enabled },
      };
      const next = { ...state, scenarios: state.scenarios.map(s => s.id === sc.id ? updated : s) };
      return recompute(next, [sc.id]);
    }
    default:
      return state;
  }
}

const STORAGE_KEY = 'cdn-tax-scenarios-v1';

/** Merge saved data with defaults so newly-added fields get zero values instead of undefined */
function migrateScenarios(scenarios: Scenario[]): Scenario[] {
  const defaultSc = makeDefaultScenario('_');
  const defaultOB = defaultSc.openingBalances;
  const defaultAss = defaultSc.assumptions;
  for (const sc of scenarios) {
    // Migrate opening balances (add lira, resp if missing)
    sc.openingBalances = { ...defaultOB, ...sc.openingBalances };
    // Migrate assumptions (add federalEmploymentAmount, etc. if missing)
    sc.assumptions = { ...defaultAss, ...sc.assumptions };
    // Deep-merge nested assumption objects (cpp, ei, dividendRates)
    sc.assumptions.cpp = { ...defaultAss.cpp, ...sc.assumptions.cpp };
    sc.assumptions.ei = { ...defaultAss.ei, ...sc.assumptions.ei };
    sc.assumptions.dividendRates = {
      eligible: { ...defaultAss.dividendRates.eligible, ...sc.assumptions.dividendRates?.eligible },
      nonEligible: { ...defaultAss.dividendRates.nonEligible, ...sc.assumptions.dividendRates?.nonEligible },
    };
    // Migrate year data
    for (let i = 0; i < sc.years.length; i++) {
      const defaults = makeDefaultYear(sc.years[i].year);
      sc.years[i] = { ...defaults, ...sc.years[i] };
    }
  }
  return scenarios;
}

function loadFromStorage(): ScenarioState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { scenarios, activeId } = JSON.parse(raw) as { scenarios: Scenario[]; activeId: string };
    if (!scenarios?.length) return null;
    migrateScenarios(scenarios);
    const computed: Record<string, ComputedScenario> = {};
    for (const sc of scenarios) {
      try { computed[sc.id] = compute(sc); } catch { /* skip */ }
    }
    return { scenarios, activeId: activeId || scenarios[0].id, computed };
  } catch {
    return null;
  }
}

interface ScenarioContextValue {
  state: ScenarioState;
  dispatch: React.Dispatch<Action>;
  activeScenario: Scenario | undefined;
  activeComputed: ComputedScenario | undefined;
  whatIfAdjustments: WhatIfAdjustments;
  whatIfComputed: ComputedScenario | null;
  isWhatIfMode: boolean;
  setWhatIfAdjustments: (partial: Partial<WhatIfAdjustments>) => void;
  resetWhatIf: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const stored = loadFromStorage();
  const defaultScenario = makeDefaultScenario('Scenario 1');
  const initialState: ScenarioState = stored ?? (() => {
    const computed: Record<string, ComputedScenario> = {};
    try { computed[defaultScenario.id] = compute(defaultScenario); } catch { /* skip */ }
    return { scenarios: [defaultScenario], activeId: defaultScenario.id, computed };
  })();

  const [state, dispatch] = useReducer(reducer, initialState);

  // What-If state (NOT persisted to localStorage)
  const [whatIfAdjustments, setWhatIfAdj] = useState<WhatIfAdjustments>(DEFAULT_WHATIF);

  const setWhatIfAdjustments = useCallback((partial: Partial<WhatIfAdjustments>) => {
    setWhatIfAdj(prev => ({ ...prev, ...partial }));
  }, []);

  const resetWhatIf = useCallback(() => {
    setWhatIfAdj(DEFAULT_WHATIF);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scenarios: state.scenarios,
        activeId: state.activeId,
      }));
    } catch { /* quota exceeded etc */ }
  }, [state.scenarios, state.activeId]);

  const activeScenario = state.scenarios.find(s => s.id === state.activeId);
  const activeComputed = activeScenario ? state.computed[activeScenario.id] : undefined;

  const isActive = isWhatIfActive(whatIfAdjustments);

  const whatIfComputed = useMemo(() => {
    if (!isActive || !activeScenario) return null;
    try {
      const modified = applyWhatIfAdjustments(activeScenario, whatIfAdjustments);
      return compute(modified);
    } catch (e) {
      console.error('What-If compute error', e);
      return null;
    }
  }, [isActive, activeScenario, whatIfAdjustments]);

  return (
    <ScenarioContext.Provider value={{
      state, dispatch, activeScenario, activeComputed,
      whatIfAdjustments, whatIfComputed, isWhatIfMode: isActive,
      setWhatIfAdjustments, resetWhatIf,
    }}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider');
  return ctx;
}

export function useUpdateScenario() {
  const { activeScenario, dispatch } = useScenario();
  return useCallback((updater: (s: Scenario) => Scenario) => {
    if (!activeScenario) return;
    dispatch({ type: 'UPDATE_SCENARIO', scenario: updater(activeScenario) });
  }, [activeScenario, dispatch]);
}

export function useWhatIf() {
  const { whatIfAdjustments, whatIfComputed, isWhatIfMode, setWhatIfAdjustments, resetWhatIf } = useScenario();
  return {
    adjustments: whatIfAdjustments,
    computed: whatIfComputed,
    isActive: isWhatIfMode,
    setAdjustments: setWhatIfAdjustments,
    reset: resetWhatIf,
  };
}
