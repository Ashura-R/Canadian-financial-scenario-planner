import { useState, useCallback } from 'react';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch { /* ignore */ }
    return defaultValue;
  });

  const setValue = useCallback((v: T) => {
    setValueRaw(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key]);

  return [value, setValue];
}
