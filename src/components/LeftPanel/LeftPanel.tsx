import React, { useState } from 'react';
import { AssumptionsPanel } from './AssumptionsPanel/AssumptionsPanel';
import { OpeningBalancesPanel } from './OpeningBalancesPanel/OpeningBalancesPanel';
import { TimelineTable } from './TimelineTable/TimelineTable';

type Tab = 'assumptions' | 'timeline';

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('timeline');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex border-b border-app-border bg-app-surface shrink-0">
        {(['timeline', 'assumptions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-app-accent text-app-text'
                : 'border-transparent text-app-text3 hover:text-app-text'
            }`}
          >
            {t === 'timeline' ? 'Timeline' : 'Assumptions & Balances'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {tab === 'assumptions' ? (
          <div className="p-3 space-y-3">
            <OpeningBalancesPanel />
            <AssumptionsPanel />
          </div>
        ) : (
          <TimelineTable />
        )}
      </div>
    </div>
  );
}
