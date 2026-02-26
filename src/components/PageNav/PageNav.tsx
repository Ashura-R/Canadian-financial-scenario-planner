import React from 'react';

export type Page = 'overview' | 'tax-detail' | 'accounts' | 'timeline' | 'scheduling' | 'analysis' | 'assumptions';

interface Props {
  page: Page;
  onChange: (p: Page) => void;
}

const TABS: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tax-detail', label: 'Tax Detail' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'assumptions', label: 'Settings' },
];

export function PageNav({ page, onChange }: Props) {
  return (
    <div className="flex items-center gap-0 px-4 bg-app-surface border-b border-app-border shrink-0">
      {TABS.map(t => (
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
