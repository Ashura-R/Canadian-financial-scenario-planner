import React from 'react';
import { useScenario } from '../../../store/ScenarioContext';
import { KPICard } from './KPICard';
import { YoYTable } from './YoYTable';
import { formatPct } from '../../../utils/formatters';

export function DashboardView() {
  const { activeComputed, activeScenario } = useScenario();

  if (!activeComputed || !activeScenario) {
    return <div className="p-6 text-app-text4 text-sm">No data available.</div>;
  }

  const latestYear = activeComputed.years[activeComputed.years.length - 1];
  const analytics = activeComputed.analytics;

  if (!latestYear) return null;

  const { tax, cpp, ei, waterfall, accounts } = latestYear;

  const warnings = activeComputed.years.flatMap(y => y.warnings.filter(w => w.severity === 'error'));

  return (
    <div className="p-4 space-y-5">
      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="bg-red-900/20 border border-app-negative/40 rounded-lg p-3">
          <div className="text-xs font-semibold text-app-negative mb-1">Validation Issues ({warnings.length})</div>
          <ul className="text-[10px] text-red-300 space-y-0.5">
            {warnings.slice(0, 5).map((w, i) => <li key={i}>• {w.message}</li>)}
            {warnings.length > 5 && <li className="text-app-text3">...and {warnings.length - 5} more</li>}
          </ul>
        </div>
      )}

      {/* Current year label */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-app-text">Latest Year: {latestYear.year}</div>
        <div className="h-px flex-1 bg-app-border" />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Gross Income" value={waterfall.grossIncome} color="text-app-text" />
        <KPICard label="Net Taxable Income" value={tax.netTaxableIncome} color="text-app-text" />
        <KPICard label="Federal Tax" value={tax.federalTaxPayable} color="text-app-warning" />
        <KPICard label="Provincial Tax" value={tax.provincialTaxPayable} color="text-app-warning" />
        <KPICard label="CPP + EI" value={cpp.totalCPPPaid + ei.totalEI} color="text-app-warning" />
        <KPICard label="Total Tax+CPP+EI" value={tax.totalIncomeTax + cpp.totalCPPPaid + ei.totalEI} color="text-app-negative" />
        <KPICard label="After-Tax Income" value={waterfall.afterTaxIncome} color="text-app-positive" />
        <KPICard label="Net Cash Flow" value={waterfall.netCashFlow} color={waterfall.netCashFlow >= 0 ? 'text-app-positive' : 'text-app-negative'} />
        <KPICard label="Marginal Rate" value={tax.marginalCombinedRate} format="pct" color="text-app-text3" />
        <KPICard label="Avg All-In Rate" value={tax.avgAllInRate} format="pct" color="text-app-text3" />
      </div>

      {/* Account Balances */}
      <div>
        <div className="text-[10px] text-app-text4 uppercase tracking-wider mb-2">Account Balances (EOY)</div>
        <div className="grid grid-cols-2 gap-2">
          <KPICard label="RRSP" value={accounts.rrspEOY} color="text-app-accent" />
          <KPICard label="TFSA" value={accounts.tfsaEOY} color="text-app-positive" />
          <KPICard label="FHSA" value={accounts.fhsaEOY} color="text-[#8b5cf6]" />
          <KPICard label="Non-Reg" value={accounts.nonRegEOY} color="text-app-warning" />
          <KPICard label="Savings" value={accounts.savingsEOY} color="text-[#06b6d4]" />
          <KPICard label="Total Net Worth" value={accounts.netWorth} color="text-app-text" />
        </div>
      </div>

      {/* Lifetime Analytics */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-semibold text-app-text">Lifetime Cumulative</div>
          <div className="h-px flex-1 bg-app-border" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <KPICard label="Lifetime Gross Income" value={analytics.lifetimeGrossIncome} />
          <KPICard label="Lifetime Total Tax" value={analytics.lifetimeTotalTax} color="text-app-warning" />
          <KPICard label="Lifetime CPP+EI" value={analytics.lifetimeCPPEI} color="text-app-warning" />
          <KPICard label="Lifetime After-Tax" value={analytics.lifetimeAfterTaxIncome} color="text-app-positive" />
          <KPICard label="Lifetime Avg Tax Rate" value={analytics.lifetimeAvgTaxRate} format="pct" color="text-app-text3" />
          <KPICard label="Lifetime All-In Rate" value={analytics.lifetimeAvgAllInRate} format="pct" color="text-app-text3" />
        </div>
      </div>

      {/* Year-over-Year Table */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-semibold text-app-text">Year-over-Year Summary</div>
          <div className="h-px flex-1 bg-app-border" />
        </div>
        <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
          <YoYTable years={activeComputed.years} />
        </div>
      </div>
    </div>
  );
}
