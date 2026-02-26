import React from 'react';
import type { Page } from '../PageNav/PageNav';
import { useTheme } from '../../hooks/useTheme';

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
  onCompare: () => void;
  page: Page;
  onPageChange: (p: Page) => void;
}

export function TopBar({ page, onPageChange }: Props) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex items-center px-4 py-0 bg-slate-900 shrink-0 h-11">
      {/* App title — left */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
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

      {/* Theme toggle — right */}
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}
