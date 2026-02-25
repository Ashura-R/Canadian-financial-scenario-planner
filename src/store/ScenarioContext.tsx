import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Scenario } from '../types/scenario';
import type { ComputedScenario } from '../types/computed';
import { compute } from '../engine';
import { makeDefaultScenario } from './defaults';

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
  | { type: 'RENAME_SCENARIO'; id: string; name: string };

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
    default:
      return state;
  }
}

const STORAGE_KEY = 'cdn-tax-scenarios-v1';

function loadFromStorage(): ScenarioState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { scenarios, activeId } = JSON.parse(raw) as { scenarios: Scenario[]; activeId: string };
    if (!scenarios?.length) return null;
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

  return (
    <ScenarioContext.Provider value={{ state, dispatch, activeScenario, activeComputed }}>
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
