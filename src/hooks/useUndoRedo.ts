import { useCallback, useRef, useState } from 'react';
import type { Scenario } from '../types/scenario';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

export function useUndoRedo(
  activeScenario: Scenario | undefined,
  rawUpdate: (updater: (s: Scenario) => Scenario) => void
) {
  const pastRef = useRef<Scenario[]>([]);
  const futureRef = useRef<Scenario[]>([]);
  const lastPushTimeRef = useRef(0);
  const activeRef = useRef(activeScenario);
  activeRef.current = activeScenario;

  // Force re-render for canUndo/canRedo (lightweight)
  const [, bump] = useState(0);
  const notify = () => bump(n => n + 1);

  const trackedUpdate = useCallback((updater: (s: Scenario) => Scenario) => {
    if (!activeRef.current) return;

    const now = Date.now();
    const shouldPush = now - lastPushTimeRef.current > DEBOUNCE_MS;

    if (shouldPush) {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), activeRef.current];
      futureRef.current = [];
    }
    lastPushTimeRef.current = now;

    rawUpdate(updater);
    notify();
  }, [rawUpdate]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0 || !activeRef.current) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, activeRef.current];
    // Dispatch the previous state directly
    rawUpdate(() => prev);
    notify();
  }, [rawUpdate]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0 || !activeRef.current) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, activeRef.current];
    rawUpdate(() => next);
    notify();
  }, [rawUpdate]);

  return {
    trackedUpdate,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
