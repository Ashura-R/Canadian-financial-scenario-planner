import React from 'react';
import type { Page } from '../PageNav/PageNav';

const PAGE_TABS: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tax-detail', label: 'Tax Detail' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'assumptions', label: 'Settings' },
];

interface Props {
  onCompare: () => void; // kept for API compat, handled by ScenarioBar
  page: Page;
  onPageChange: (p: Page) => void;
}

export function TopBar({ page, onPageChange }: Props) {
  return (
    <div className="flex items-center px-4 py-0 bg-slate-900 shrink-0 h-11">
      {/* App title — left */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-sm font-semibold text-white whitespace-nowrap">CDN Tax</span>
      </div>

      {/* Page tabs — truly centered via flex-1 spacers */}
      <div className="flex-1" />
      <nav className="flex items-center gap-0.5">
        {PAGE_TABS.map(t => {
          const active = page === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onPageChange(t.id)}
              className={`relative px-3.5 py-2.5 text-[12px] font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-16px)] h-[2px] bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="flex-1" />
    </div>
  );
}
