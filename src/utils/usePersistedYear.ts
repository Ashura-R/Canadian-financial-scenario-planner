import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cdn-tax-selected-year-idx';

export function usePersistedYear(maxIdx: number): [number, (idx: number) => void] {
  const [idx, setIdxRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const n = Number(stored);
        if (!isNaN(n) && n >= 0 && n <= maxIdx) return n;
        // clamp to valid range
        if (!isNaN(n) && n > maxIdx) return maxIdx;
      }
    } catch { /* ignore */ }
    return 0;
  });

  const setIdx = useCallback((v: number) => {
    setIdxRaw(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* ignore */ }
  }, []);

  // Clamp if maxIdx shrunk (e.g. fewer years)
  const clamped = idx > maxIdx ? maxIdx : idx;

  return [clamped, setIdx];
}
