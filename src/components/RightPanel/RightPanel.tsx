import React, { useState } from 'react';
import { DashboardView } from './DashboardView/DashboardView';
import { ChartsView } from './ChartsView/ChartsView';

type Tab = 'dashboard' | 'charts';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-app-border bg-app-surface shrink-0">
        {(['dashboard', 'charts'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-xs font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-app-accent text-app-text'
                : 'border-transparent text-app-text3 hover:text-app-text'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : 'Charts'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'dashboard' ? <DashboardView /> : <ChartsView />}
      </div>
    </div>
  );
}
