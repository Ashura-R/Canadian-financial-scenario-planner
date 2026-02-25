import React, { useState } from 'react';
import { ScenarioProvider } from './store/ScenarioContext';
import { TopBar } from './components/TopBar/TopBar';
import { PageNav, type Page } from './components/PageNav/PageNav';
import { CompareModal } from './components/CompareModal/CompareModal';
import { OverviewPage } from './pages/OverviewPage';
import { TaxDetailPage } from './pages/TaxDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { TimelinePage } from './pages/TimelinePage';
import { SchedulingPage } from './pages/SchedulingPage';
import { AssumptionsPage } from './pages/AssumptionsPage';

export default function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const [page, setPage] = useState<Page>('overview');

  return (
    <ScenarioProvider>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        <TopBar onCompare={() => setCompareOpen(true)} />
        <PageNav page={page} onChange={setPage} />
        <div className="flex-1 min-h-0 overflow-hidden">
          {page === 'overview' && <OverviewPage />}
          {page === 'tax-detail' && <TaxDetailPage />}
          {page === 'accounts' && <AccountsPage />}
          {page === 'timeline' && <TimelinePage />}
          {page === 'scheduling' && <SchedulingPage />}
          {page === 'assumptions' && <AssumptionsPage />}
        </div>
        {compareOpen && <CompareModal onClose={() => setCompareOpen(false)} />}
      </div>
    </ScenarioProvider>
  );
}
