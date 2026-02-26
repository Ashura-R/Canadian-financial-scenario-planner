import React, { useState, useMemo } from 'react';
import { useScenario } from '../store/ScenarioContext';
import { computeCPPDeferral, computeOASDeferral } from '../engine/retirementAnalysis';
import { computeSensitivity } from '../engine/sensitivityEngine';
import { computeWithdrawalStrategies } from '../engine/optimizerEngine';
import type { DeferralScenario } from '../engine/retirementAnalysis';
import type { SensitivityAnalysis } from '../engine/sensitivityEngine';
import type { WithdrawalStrategy } from '../engine/optimizerEngine';

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return '$' + Math.round(v / 1000) + 'K';
  return '$' + Math.round(v).toLocaleString();
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function CPPDeferralPanel({ scenarios }: { scenarios: DeferralScenario[] }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">CPP Start Age Analysis</h3>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1.5 pr-3 text-slate-500 font-medium">Start Age</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Adjustment</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Monthly</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Annual</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Cumul. @ 80</th>
              <th className="text-right py-1.5 pl-2 text-slate-500 font-medium">Break-Even vs 65</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={s.startAge} className={`border-b border-slate-100 ${s.startAge === 65 ? 'bg-blue-50 font-semibold' : ''}`}>
                <td className="py-1.5 pr-3">{s.startAge}</td>
                <td className="text-right py-1.5 px-2">
                  <span className={s.adjustmentPct < 0 ? 'text-red-600' : s.adjustmentPct > 0 ? 'text-green-600' : ''}>
                    {s.adjustmentPct > 0 ? '+' : ''}{(s.adjustmentPct * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.monthlyAmount).toLocaleString()}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.annualAmount).toLocaleString()}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.cumulativeByAge[20] ?? 0)}</td>
                <td className="text-right py-1.5 pl-2">
                  {s.breakEvenVs65 !== null ? `Age ${s.breakEvenVs65}` : s.startAge === 65 ? '—' : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OASDeferralPanel({ scenarios }: { scenarios: DeferralScenario[] }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">OAS Start Age Analysis</h3>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1.5 pr-3 text-slate-500 font-medium">Start Age</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Adjustment</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Monthly</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Annual</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Cumul. @ 80</th>
              <th className="text-right py-1.5 pl-2 text-slate-500 font-medium">Break-Even vs 65</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={s.startAge} className={`border-b border-slate-100 ${s.startAge === 65 ? 'bg-blue-50 font-semibold' : ''}`}>
                <td className="py-1.5 pr-3">{s.startAge}</td>
                <td className="text-right py-1.5 px-2">
                  <span className={s.adjustmentPct > 0 ? 'text-green-600' : ''}>
                    {s.adjustmentPct > 0 ? '+' : ''}{(s.adjustmentPct * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.monthlyAmount).toLocaleString()}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">${Math.round(s.annualAmount).toLocaleString()}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.cumulativeByAge[15] ?? 0)}</td>
                <td className="text-right py-1.5 pl-2">
                  {s.breakEvenVs65 !== null ? `Age ${s.breakEvenVs65}` : s.startAge === 65 ? '—' : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SensitivityPanel({ analysis }: { analysis: SensitivityAnalysis }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Sensitivity Analysis (Equity Return Offsets)</h3>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1.5 pr-3 text-slate-500 font-medium">Scenario</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Final Net Worth</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Real Net Worth</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Lifetime After-Tax</th>
              <th className="text-right py-1.5 pl-2 text-slate-500 font-medium">Lifetime Tax</th>
            </tr>
          </thead>
          <tbody>
            {analysis.scenarios.map(s => (
              <tr key={s.label} className={`border-b border-slate-100 ${s.equityOffset === 0 ? 'bg-blue-50 font-semibold' : ''}`}>
                <td className="py-1.5 pr-3">{s.label}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.finalNetWorth)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.finalRealNetWorth)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.lifetimeAfterTax)}</td>
                <td className="text-right py-1.5 pl-2 tabular-nums">{fmt(s.lifetimeTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        Shows how final outcomes change when equity returns are adjusted by the specified offset from your base assumption.
      </p>
    </div>
  );
}

function WithdrawalPanel({ strategies }: { strategies: WithdrawalStrategy[] }) {
  if (strategies.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Withdrawal Sequencing Comparison</h3>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1.5 pr-3 text-slate-500 font-medium">Strategy</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Lifetime Tax</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Lifetime After-Tax</th>
              <th className="text-right py-1.5 px-2 text-slate-500 font-medium">Final Net Worth</th>
              <th className="text-right py-1.5 pl-2 text-slate-500 font-medium">Avg Tax Rate</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s, i) => {
              const best = strategies.reduce((a, b) => a.lifetimeTax < b.lifetimeTax ? a : b);
              return (
                <tr key={s.name} className={`border-b border-slate-100 ${s === best ? 'bg-green-50 font-semibold' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {s.name}
                    {s === best && <span className="ml-1 text-[9px] text-green-600 font-bold">BEST</span>}
                  </td>
                  <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.lifetimeTax)}</td>
                  <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.lifetimeAfterTax)}</td>
                  <td className="text-right py-1.5 px-2 tabular-nums">{fmt(s.finalNetWorth)}</td>
                  <td className="text-right py-1.5 pl-2 tabular-nums">{fmtPct(s.avgTaxRate)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-2 text-[10px] text-slate-400">
                {strategies.map(s => s.description).join(' | ')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function AnalysisPage() {
  const { activeScenario, activeComputed } = useScenario();
  const [cppMonthly, setCppMonthly] = useState(900);
  const [oasMonthly, setOasMonthly] = useState(700);
  const [withdrawalTarget, setWithdrawalTarget] = useState(50000);

  const cppScenarios = useMemo(
    () => computeCPPDeferral(cppMonthly, activeScenario?.assumptions.inflationRate ?? 0.02),
    [cppMonthly, activeScenario?.assumptions.inflationRate]
  );

  const oasScenarios = useMemo(
    () => computeOASDeferral(oasMonthly, activeScenario?.assumptions.inflationRate ?? 0.02),
    [oasMonthly, activeScenario?.assumptions.inflationRate]
  );

  const sensitivity = useMemo(
    () => activeScenario ? computeSensitivity(activeScenario) : null,
    [activeScenario]
  );

  const withdrawalStrategies = useMemo(
    () => activeScenario && withdrawalTarget > 0
      ? computeWithdrawalStrategies(activeScenario, withdrawalTarget)
      : [],
    [activeScenario, withdrawalTarget]
  );

  if (!activeScenario) return null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Advanced Analysis</h2>

      {/* CPP/OAS Deferral */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-xs text-slate-600">CPP Monthly @ 65:</label>
            <input
              type="number"
              value={cppMonthly}
              onChange={e => setCppMonthly(Number(e.target.value) || 0)}
              className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
            />
          </div>
          <CPPDeferralPanel scenarios={cppScenarios} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-xs text-slate-600">OAS Monthly @ 65:</label>
            <input
              type="number"
              value={oasMonthly}
              onChange={e => setOasMonthly(Number(e.target.value) || 0)}
              className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
            />
          </div>
          <OASDeferralPanel scenarios={oasScenarios} />
        </div>
      </div>

      {/* Sensitivity */}
      {sensitivity && <SensitivityPanel analysis={sensitivity} />}

      {/* Withdrawal Optimizer */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <label className="text-xs text-slate-600">Annual Withdrawal Target:</label>
          <input
            type="number"
            value={withdrawalTarget}
            onChange={e => setWithdrawalTarget(Number(e.target.value) || 0)}
            className="w-28 px-2 py-1 text-xs border border-slate-300 rounded"
          />
        </div>
        <WithdrawalPanel strategies={withdrawalStrategies} />
      </div>
    </div>
  );
}
