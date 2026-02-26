import React from 'react';

export type ChartRange = '5y' | '10y' | '25y' | 'all';

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '5y', label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: '25y', label: '25Y' },
  { value: 'all', label: 'All' },
];

export function sliceByRange<T>(arr: T[], range: ChartRange): T[] {
  if (range === 'all') return arr;
  const n = range === '5y' ? 5 : range === '10y' ? 10 : 25;
  return arr.slice(0, n);
}

export function ChartRangeSelector({ value, onChange }: { value: ChartRange; onChange: (v: ChartRange) => void }) {
  return (
    <div className="flex border border-app-border rounded overflow-hidden">
      {RANGE_OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
            value === o.value
              ? 'bg-app-accent text-white'
              : 'bg-app-surface text-app-text3 hover:bg-app-surface2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
