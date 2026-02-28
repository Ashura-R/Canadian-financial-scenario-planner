import React from 'react';

export type Page = 'overview' | 'warnings' | 'tax-detail' | 'accounts' | 'expenses' | 'timeline' | 'scheduling' | 'analysis' | 'assumptions';

// Single source of truth for all page tabs — used by TopBar and App.tsx
export const PAGE_TABS: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tax-detail', label: 'Tax Detail' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'assumptions', label: 'Settings' },
];

export const VALID_PAGES: Page[] = PAGE_TABS.map(t => t.id);

interface Props {
  page: Page;
  onChange: (p: Page) => void;
}

export function PageNav({ page, onChange }: Props) {
  return (
    <div className="flex items-center gap-0 px-4 bg-app-surface border-b border-app-border shrink-0">
      {PAGE_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            page === t.id
              ? 'border-app-accent text-app-accent bg-app-accent-light'
              : 'border-transparent text-app-text3 hover:text-app-text hover:border-app-border2'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
