import React from 'react';
import { useScenario } from '../../../store/ScenarioContext';
import { NetWorthChart } from './NetWorthChart';
import { TaxWaterfallChart } from './TaxWaterfallChart';
import { IncomeBreakdownChart } from './IncomeBreakdownChart';
import { CumulativeCashFlowChart } from './CumulativeCashFlowChart';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-700">{title}</div>
      <div className="flex-1 p-2" style={{ height: 220 }}>
        {children}
      </div>
    </div>
  );
}

export function ChartsView() {
  const { activeComputed, activeScenario } = useScenario();

  if (!activeComputed || !activeScenario) {
    return <div className="p-6 text-slate-400 text-sm">No data available.</div>;
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <ChartCard title="Net Worth Over Time">
        <NetWorthChart years={activeComputed.years} />
      </ChartCard>
      <ChartCard title="Tax Waterfall (Stacked by Year)">
        <TaxWaterfallChart years={activeComputed.years} />
      </ChartCard>
      <ChartCard title="Income Breakdown by Type">
        <IncomeBreakdownChart years={activeComputed.years} rawYears={activeScenario.years} />
      </ChartCard>
      <ChartCard title="Cash Flow (Annual + Cumulative)">
        <CumulativeCashFlowChart computed={activeComputed} />
      </ChartCard>
    </div>
  );
}
