import React, { useState, useCallback } from 'react';
import { ScenarioProvider } from './store/ScenarioContext';
import { TopBar } from './components/TopBar/TopBar';
import { ScenarioBar } from './components/ScenarioBar/ScenarioBar';
import { CompareModal } from './components/CompareModal/CompareModal';
import { WhatIfPanel } from './components/WhatIfPanel/WhatIfPanel';
import { OverviewPage } from './pages/OverviewPage';
import { TaxDetailPage } from './pages/TaxDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { TimelinePage } from './pages/TimelinePage';
import { SchedulingPage } from './pages/SchedulingPage';
import { AssumptionsPage } from './pages/AssumptionsPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { WarningsPage } from './pages/WarningsPage';
import { usePersistedState } from './utils/usePersistedState';
import type { Page } from './components/PageNav/PageNav';
import { VALID_PAGES } from './components/PageNav/PageNav';

const PAGE_STORAGE_KEY = 'cdn-tax-active-page';

function loadPage(): Page {
  try {
    const v = localStorage.getItem(PAGE_STORAGE_KEY) as Page | null;
    return v && VALID_PAGES.includes(v) ? v : 'overview';
  } catch { return 'overview'; }
}

function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('cdn-tax-disclaimer-dismissed') === '1'; } catch { return false; }
  });
  if (dismissed) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-1.5 flex items-center justify-between gap-3">
      <p className="text-[11px] text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Disclaimer:</span> This tool provides estimates for educational/planning purposes only. Results may not be completely accurate. Always verify with CRA resources, a certified accountant, or official tax software before filing.
      </p>
      <button
        onClick={() => { setDismissed(true); try { localStorage.setItem('cdn-tax-disclaimer-dismissed', '1'); } catch {} }}
        className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs font-medium shrink-0"
      >Dismiss</button>
    </div>
  );
}

export default function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const [page, setPageRaw] = useState<Page>(loadPage);
  const setPage = useCallback((p: Page) => {
    setPageRaw(p);
    try { localStorage.setItem(PAGE_STORAGE_KEY, p); } catch {}
  }, []);
  const [whatIfOpen, setWhatIfOpen] = usePersistedState('cdn-tax-whatif-panel', false);

  const isSettings = page === 'assumptions';

  return (
    <ScenarioProvider>
      <div className="flex flex-col h-screen bg-app-bg overflow-hidden">
        <TopBar
          onCompare={() => setCompareOpen(true)}
          page={page}
          onPageChange={setPage}
          whatIfOpen={whatIfOpen}
          onWhatIfToggle={() => setWhatIfOpen(!whatIfOpen)}
        />
        <DisclaimerBanner />
        <ScenarioBar onCompare={() => setCompareOpen(true)} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className={`flex-1 min-h-0 min-w-0 overflow-hidden ${isSettings ? '' : 'page-scale'}`}>
            {page === 'overview' && <OverviewPage onNavigate={(p) => { if (VALID_PAGES.includes(p as Page)) setPage(p as Page); }} />}
            {page === 'warnings' && <WarningsPage onNavigate={(p) => { if (VALID_PAGES.includes(p as Page)) setPage(p as Page); }} />}
            {page === 'tax-detail' && <TaxDetailPage />}
            {page === 'accounts' && <AccountsPage />}
            {page === 'expenses' && <ExpensesPage />}
            {page === 'timeline' && <TimelinePage />}
            {page === 'scheduling' && <SchedulingPage />}
            {page === 'analysis' && <AnalysisPage />}
            {page === 'assumptions' && <AssumptionsPage />}
          </div>
          <WhatIfPanel open={whatIfOpen} onToggle={() => setWhatIfOpen(!whatIfOpen)} />
        </div>
        {compareOpen && <CompareModal onClose={() => setCompareOpen(false)} />}
      </div>
    </ScenarioProvider>
  );
}
