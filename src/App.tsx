import React, { useState, useCallback } from 'react';
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

const PAGE_STORAGE_KEY = 'cdn-tax-active-page';
const VALID_PAGES: Page[] = ['overview', 'tax-detail', 'accounts', 'timeline', 'scheduling', 'assumptions'];

function loadPage(): Page {
  try {
    const v = localStorage.getItem(PAGE_STORAGE_KEY) as Page | null;
    return v && VALID_PAGES.includes(v) ? v : 'overview';
  } catch { return 'overview'; }
}

export default function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const [page, setPageRaw] = useState<Page>(loadPage);
  const setPage = useCallback((p: Page) => {
    setPageRaw(p);
    try { localStorage.setItem(PAGE_STORAGE_KEY, p); } catch {}
  }, []);

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
