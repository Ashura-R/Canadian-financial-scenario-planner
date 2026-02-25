import React, { useRef, useState, useMemo } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import { TimelineCell } from '../components/LeftPanel/TimelineTable/TimelineCell';
import { RowGroup } from '../components/LeftPanel/TimelineTable/RowGroup';
import { getScheduledAmount } from '../engine/index';
import type { YearData, ScheduledItem } from '../types/scenario';

type YDKey = keyof YearData;

interface FillState { key: YDKey; pct: boolean }

const ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.1, 1.25];
const ZOOM_STORAGE_KEY = 'cdn-tax-timeline-zoom';
const BAND_STORAGE_KEY = 'cdn-tax-timeline-banding';

function loadZoom(): number {
  try { const v = Number(localStorage.getItem(ZOOM_STORAGE_KEY)); return ZOOM_LEVELS.includes(v) ? v : 1; } catch { return 1; }
}
function loadBanding(): boolean {
  try { return localStorage.getItem(BAND_STORAGE_KEY) === '1'; } catch { return false; }
}

/** Compute what each schedule would provide per year/field (fixed-amount non-conditional only; percentage rules show 0 as hint) */
function buildScheduleOverlay(
  schedules: ScheduledItem[],
  years: YearData[],
  inflationRate: number
): Map<number, Map<string, number>> {
  const overlay = new Map<number, Map<string, number>>();
  for (let i = 0; i < years.length; i++) {
    const yd = years[i];
    const fieldMap = new Map<string, number>();
    for (const s of schedules) {
      if (yd.year < s.startYear) continue;
      if (s.endYear !== undefined && yd.year > s.endYear) continue;
      const field = s.field;
      if (!fieldMap.has(field)) {
        // Percentage-based rules depend on computed values — show a marker (-1) so cell knows a rule exists
        if (s.amountType === 'percentage') {
          fieldMap.set(field, -1);
        } else if (!s.conditions || s.conditions.length === 0) {
          fieldMap.set(field, getScheduledAmount(s, yd.year, inflationRate));
        }
      }
    }
    if (fieldMap.size > 0) overlay.set(i, fieldMap);
  }
  return overlay;
}

export function TimelinePage() {
  const { activeScenario, activeComputed } = useScenario();
  const update = useUpdateScenario();
  const tableRef = useRef<HTMLDivElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);

  // Fill-all state: which row is in "fill all years" mode
  const [fillRow, setFillRow] = useState<FillState | null>(null);
  const [fillVal, setFillVal] = useState('');

  // Zoom & banding
  const [zoom, setZoomRaw] = useState(loadZoom);
  const [banding, setBandingRaw] = useState(loadBanding);

  function setZoom(v: number) { setZoomRaw(v); try { localStorage.setItem(ZOOM_STORAGE_KEY, String(v)); } catch {} }
  function setBanding(v: boolean) { setBandingRaw(v); try { localStorage.setItem(BAND_STORAGE_KEY, v ? '1' : '0'); } catch {} }

  function zoomIn() { const i = ZOOM_LEVELS.indexOf(zoom); if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1]); }
  function zoomOut() { const i = ZOOM_LEVELS.indexOf(zoom); if (i > 0) setZoom(ZOOM_LEVELS[i - 1]); }

  const schedules = activeScenario?.scheduledItems ?? [];
  const inflRate = activeScenario?.assumptions.inflationRate ?? 0;
  const scheduleOverlay = useMemo(
    () => activeScenario ? buildScheduleOverlay(schedules, activeScenario.years, inflRate) : new Map(),
    [schedules, activeScenario?.years, inflRate]
  );

  if (!activeScenario) return null;

  const years = activeScenario.years;
  const computed = activeComputed?.years ?? [];

  function updateYear(yearIdx: number, key: YDKey, val: number) {
    update(s => {
      const newYears = [...s.years];
      newYears[yearIdx] = { ...newYears[yearIdx], [key]: val };
      return { ...s, years: newYears };
    });
  }

  function updateYearOpt(yearIdx: number, key: YDKey, val: number | undefined) {
    update(s => {
      const newYears = [...s.years];
      const yr = { ...newYears[yearIdx] };
      if (val === undefined) {
        delete (yr as Record<string, unknown>)[key as string];
      } else {
        (yr as Record<string, unknown>)[key as string] = val;
      }
      newYears[yearIdx] = yr;
      return { ...s, years: newYears };
    });
  }

  function warningFields(yearIdx: number): Set<string> {
    const s = new Set<string>();
    computed[yearIdx]?.warnings.forEach(w => s.add(w.field));
    return s;
  }

  function openFill(key: YDKey, pct: boolean) {
    setFillRow({ key, pct });
    setFillVal('');
    setTimeout(() => fillInputRef.current?.focus(), 30);
  }

  function applyFill() {
    if (!fillRow) return;
    const raw = fillVal.replace(/[$,%\s,]/g, '');
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const v = fillRow.pct ? n / 100 : n;
      update(s => {
        const newYears = s.years.map(yr => ({ ...yr, [fillRow.key]: v }));
        return { ...s, years: newYears };
      });
    }
    setFillRow(null);
    setFillVal('');
  }

  const YEAR_WIDTH = 72;
  const LABEL_WIDTH = 175;

  // Row counter for banding — resets each render
  let bandRowIdx = 0;

  function labelCell(label: string, key: YDKey, pct = false, isEditable = true) {
    const isActive = fillRow?.key === key;
    return (
      <td
        className="sticky left-0 bg-inherit z-10 py-0.5 pl-2 pr-1 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100 group"
        style={{ minWidth: LABEL_WIDTH, maxWidth: LABEL_WIDTH }}
      >
        {isActive ? (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-blue-500 shrink-0 font-semibold">ALL→</span>
            <input
              ref={fillInputRef}
              className="flex-1 min-w-0 text-[10px] border border-blue-400 rounded px-1 py-px outline-none bg-blue-50 text-slate-800"
              value={fillVal}
              onChange={e => setFillVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyFill();
                if (e.key === 'Escape') { setFillRow(null); setFillVal(''); }
              }}
              onBlur={() => { setFillRow(null); setFillVal(''); }}
              placeholder={pct ? '75' : '80000'}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span>{label}</span>
            {isEditable && (
              <button
                className="opacity-0 group-hover:opacity-100 text-[8px] px-0.5 py-px text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                onMouseDown={e => { e.preventDefault(); openFill(key, pct); }}
                title="Fill all years with one value"
              >⟹</button>
            )}
          </div>
        )}
      </td>
    );
  }

  function renderRow(label: string, key: YDKey, opts: { readOnly?: boolean; pct?: boolean; computedFn?: (i: number) => number } = {}) {
    const isEditable = !opts.readOnly && !opts.computedFn;
    const myIdx = bandRowIdx++;
    const bandCls = banding && myIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
    return (
      <tr key={key} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${bandCls}`}>
        {labelCell(label, key, opts.pct, isEditable)}
        {years.map((yd, i) => {
          const warns = warningFields(i);
          const displayVal = opts.computedFn ? opts.computedFn(i) : (yd[key] as number ?? 0);
          const schedVal = scheduleOverlay.get(i)?.get(key as string);
          return (
            <td key={yd.year} className="py-0.5 px-0.5" style={{ minWidth: YEAR_WIDTH }}>
              {opts.readOnly || opts.computedFn ? (
                <div className="w-full text-right text-[10px] px-1 py-px text-slate-400">
                  {opts.pct
                    ? (displayVal * 100).toFixed(1) + '%'
                    : displayVal >= 1000
                    ? '$' + (displayVal / 1000).toFixed(0) + 'K'
                    : displayVal === 0 ? '—' : '$' + Math.round(displayVal).toLocaleString()}
                </div>
              ) : (
                <TimelineCell
                  value={displayVal}
                  onChange={v => updateYear(i, key, v)}
                  pct={opts.pct}
                  hasWarning={warns.has(key as string)}
                  hasOverride={key.endsWith('Override') && displayVal !== 0}
                  readOnly={opts.readOnly}
                  scheduledValue={schedVal}
                />
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div ref={tableRef} className="h-full overflow-auto bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-40 bg-blue-50 border-b border-blue-100 px-3 py-1 text-[10px] text-blue-500 flex items-center justify-between gap-3">
        <span>Click a cell to edit · <kbd className="bg-white border border-blue-200 rounded px-0.5">Tab</kbd>/<kbd className="bg-white border border-blue-200 rounded px-0.5">Enter</kbd> to advance · Hover label → <span className="font-bold">⟹</span> fill all</span>
        <div className="flex items-center gap-3 shrink-0">
          {/* Banding toggle */}
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={banding}
              onChange={e => setBanding(e.target.checked)}
              className="accent-blue-600 w-3 h-3"
            />
            <span className="text-[10px] text-blue-600">Banding</span>
          </label>
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
              className="w-5 h-5 flex items-center justify-center rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
              title="Zoom out"
            >−</button>
            <span className="text-[10px] text-blue-600 w-8 text-center font-medium tabular-nums">{zoomPct}%</span>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="w-5 h-5 flex items-center justify-center rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
              title="Zoom in"
            >+</button>
          </div>
        </div>
      </div>
      <div style={{ zoom }}>
        <table className="w-full text-xs border-collapse" style={{ minWidth: LABEL_WIDTH + years.length * YEAR_WIDTH }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th
                className="sticky left-0 bg-slate-50 z-40 py-2 pl-3 pr-2 text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wide border-r border-slate-200"
                style={{ minWidth: LABEL_WIDTH }}
              >
                Row
              </th>
              {years.map(yd => (
                <th
                  key={yd.year}
                  className="py-2 px-0.5 text-center text-[10px] font-semibold text-slate-700"
                  style={{ minWidth: YEAR_WIDTH }}
                >
                  {yd.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <RowGroup title="Income">
              {renderRow('Employment', 'employmentIncome')}
              {renderRow('Self-Employment', 'selfEmploymentIncome')}
              {renderRow('Eligible Dividends', 'eligibleDividends')}
              {renderRow('Non-Elig. Dividends', 'nonEligibleDividends')}
              {renderRow('Interest', 'interestIncome')}
              {renderRow('Capital Gains', 'capitalGainsRealized')}
              {renderRow('Capital Losses', 'capitalLossesRealized')}
              {renderRow('Other Taxable', 'otherTaxableIncome')}
              <tr className="bg-slate-50 border-b border-slate-100">
                <td className="sticky left-0 bg-slate-50 z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-700 font-semibold whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>
                  Total Gross Income
                </td>
                {years.map((_, i) => (
                  <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-emerald-600 font-medium">
                    {computed[i] ? '$' + Math.round(computed[i].waterfall.grossIncome / 1000) + 'K' : '—'}
                  </td>
                ))}
              </tr>
            </RowGroup>

            <RowGroup title="RRSP">
              {renderRow('Contribution', 'rrspContribution')}
              {renderRow('Deduction Claimed', 'rrspDeductionClaimed')}
              {renderRow('Withdrawal', 'rrspWithdrawal')}
            </RowGroup>

            <RowGroup title="TFSA">
              {renderRow('Contribution', 'tfsaContribution')}
              {renderRow('Withdrawal', 'tfsaWithdrawal')}
            </RowGroup>

            <RowGroup title="FHSA">
              {renderRow('Contribution', 'fhsaContribution')}
              {renderRow('Deduction Claimed', 'fhsaDeductionClaimed')}
              {renderRow('Withdrawal', 'fhsaWithdrawal')}
            </RowGroup>

            <RowGroup title="Non-Reg & Savings">
              {renderRow('Non-Reg Contribution', 'nonRegContribution')}
              {renderRow('Non-Reg Withdrawal', 'nonRegWithdrawal')}
              {renderRow('Savings Deposit', 'savingsDeposit')}
              {renderRow('Savings Withdrawal', 'savingsWithdrawal')}
            </RowGroup>

            <RowGroup title="Asset Allocation" defaultOpen={false}>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[9px] text-slate-400 italic border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>RRSP Alloc</td>
                {years.map((_, i) => <td key={i} />)}
              </tr>
              {renderRow('  Equity %', 'rrspEquityPct', { pct: true })}
              {renderRow('  Fixed %', 'rrspFixedPct', { pct: true })}
              {renderRow('  Cash %', 'rrspCashPct', { pct: true })}
              <tr>
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[9px] text-slate-400 border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>  Return (calc)</td>
                {years.map((_, i) => (
                  <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-slate-400">
                    {computed[i] ? (computed[i].accounts.rrspReturn * 100).toFixed(1) + '%' : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[9px] text-slate-400 italic border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>TFSA Alloc</td>
                {years.map((_, i) => <td key={i} />)}
              </tr>
              {renderRow('  Equity %', 'tfsaEquityPct', { pct: true })}
              {renderRow('  Fixed %', 'tfsaFixedPct', { pct: true })}
              {renderRow('  Cash %', 'tfsaCashPct', { pct: true })}
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[9px] text-slate-400 italic border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>FHSA Alloc</td>
                {years.map((_, i) => <td key={i} />)}
              </tr>
              {renderRow('  Equity %', 'fhsaEquityPct', { pct: true })}
              {renderRow('  Fixed %', 'fhsaFixedPct', { pct: true })}
              {renderRow('  Cash %', 'fhsaCashPct', { pct: true })}
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[9px] text-slate-400 italic border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>Non-Reg Alloc</td>
                {years.map((_, i) => <td key={i} />)}
              </tr>
              {renderRow('  Equity %', 'nonRegEquityPct', { pct: true })}
              {renderRow('  Fixed %', 'nonRegFixedPct', { pct: true })}
              {renderRow('  Cash %', 'nonRegCashPct', { pct: true })}
            </RowGroup>

            <RowGroup title="Capital Loss" defaultOpen={false}>
              {renderRow('Loss Applied', 'capitalLossApplied')}
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-400 border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>Loss C/F Balance</td>
                {years.map((_, i) => (
                  <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-slate-400">
                    {computed[i] ? '$' + Math.round(computed[i].capitalLossCF).toLocaleString() : '—'}
                  </td>
                ))}
              </tr>
            </RowGroup>

            <RowGroup title="EOY Overrides" defaultOpen={false}>
              {(['rrspEOYOverride', 'tfsaEOYOverride', 'fhsaEOYOverride', 'nonRegEOYOverride', 'savingsEOYOverride'] as YDKey[]).map(key => {
                const label = key.replace('EOYOverride', '').toUpperCase() + ' Override';
                return (
                  <tr key={key} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
                    {years.map((yd, i) => {
                      const v = yd[key] as number | undefined;
                      return (
                        <td key={yd.year} className="py-0.5 px-0.5" style={{ minWidth: YEAR_WIDTH }}>
                          <TimelineCell
                            value={v ?? 0}
                            onChange={val => updateYearOpt(i, key, val === 0 ? undefined : val)}
                            hasOverride={v !== undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </RowGroup>

            <RowGroup title="Retirement (Computed)" defaultOpen={false}>
              {[
                { label: 'Age', fn: (i: number) => computed[i]?.retirement?.age ?? null, fmt: (v: number | null) => v !== null ? String(v) : '—' },
                { label: 'CPP Benefit Income', fn: (i: number) => computed[i]?.retirement?.cppIncome ?? 0, fmt: (v: number) => v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString() },
                { label: 'OAS Income', fn: (i: number) => computed[i]?.retirement?.oasIncome ?? 0, fmt: (v: number) => v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString() },
                { label: 'RRIF Status', fn: (i: number) => computed[i]?.retirement?.isRRIF ? 1 : 0, fmt: (v: number) => v ? 'RRIF' : 'RRSP' },
                { label: 'RRIF Min Withdrawal', fn: (i: number) => computed[i]?.retirement?.rrifMinWithdrawal ?? 0, fmt: (v: number) => v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString() },
              ].map(({ label, fn, fmt }) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
                  {years.map((_, i) => (
                    <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-slate-400">
                      {fmt(fn(i) as any)}
                    </td>
                  ))}
                </tr>
              ))}
            </RowGroup>

            <RowGroup title="Rate Overrides" defaultOpen={false}>
              {(['inflationRateOverride', 'equityReturnOverride', 'fixedIncomeReturnOverride', 'cashReturnOverride', 'savingsReturnOverride'] as YDKey[]).map(key => {
                const labels: Record<string, string> = {
                  inflationRateOverride: 'Inflation Rate',
                  equityReturnOverride: 'Equity Return',
                  fixedIncomeReturnOverride: 'Fixed Income Return',
                  cashReturnOverride: 'Cash Return',
                  savingsReturnOverride: 'Savings Return',
                };
                return (
                  <tr key={key} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>{labels[key] ?? key}</td>
                    {years.map((yd, i) => {
                      const v = yd[key] as number | undefined;
                      return (
                        <td key={yd.year} className="py-0.5 px-0.5" style={{ minWidth: YEAR_WIDTH }}>
                          <TimelineCell
                            value={v ?? 0}
                            onChange={val => updateYearOpt(i, key, val === 0 ? undefined : val)}
                            pct
                            hasOverride={v !== undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </RowGroup>

            <RowGroup title="Contribution Room" defaultOpen={false}>
              {[
                { label: 'RRSP Unused Room', fn: (i: number) => computed[i]?.rrspUnusedRoom ?? 0 },
                { label: 'TFSA Unused Room', fn: (i: number) => computed[i]?.tfsaUnusedRoom ?? 0 },
                { label: 'FHSA Unused Room', fn: (i: number) => computed[i]?.fhsaUnusedRoom ?? 0 },
                { label: 'Capital Loss C/F', fn: (i: number) => computed[i]?.capitalLossCF ?? 0 },
              ].map(({ label, fn }) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
                  {years.map((_, i) => {
                    const v = fn(i);
                    return (
                      <td key={i} className="py-0.5 px-0.5 text-right text-[10px] text-slate-400">
                        {v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </RowGroup>

            <RowGroup title="Tax Results (Computed)" defaultOpen>
              {[
                { label: 'Net Taxable Income', fn: (i: number) => computed[i]?.tax.netTaxableIncome ?? 0, cls: 'text-slate-600' },
                { label: 'Federal Tax', fn: (i: number) => computed[i]?.tax.federalTaxPayable ?? 0, cls: 'text-red-600' },
                { label: 'Provincial Tax', fn: (i: number) => computed[i]?.tax.provincialTaxPayable ?? 0, cls: 'text-red-600' },
                { label: 'CPP Paid', fn: (i: number) => computed[i]?.cpp.totalCPPPaid ?? 0, cls: 'text-amber-600' },
                { label: 'EI Paid', fn: (i: number) => computed[i]?.ei.totalEI ?? 0, cls: 'text-amber-600' },
                { label: 'After-Tax Income', fn: (i: number) => computed[i]?.waterfall.afterTaxIncome ?? 0, cls: 'text-emerald-600' },
                { label: 'Net Cash Flow', fn: (i: number) => computed[i]?.waterfall.netCashFlow ?? 0 },
                { label: 'Net Worth (EOY)', fn: (i: number) => computed[i]?.accounts.netWorth ?? 0, cls: 'text-blue-600' },
              ].map(({ label, fn, cls }) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="sticky left-0 bg-white z-10 py-0.5 pl-3 pr-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-100" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
                  {years.map((_, i) => {
                    const v = fn(i);
                    const color = cls ?? (v >= 0 ? 'text-emerald-600' : 'text-red-600');
                    return (
                      <td key={i} className={`py-0.5 px-0.5 text-right text-[10px] font-medium ${color}`}>
                        {v >= 1000 || v <= -1000 ? '$' + Math.round(v / 1000) + 'K' : v === 0 ? '—' : '$' + Math.round(v).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </RowGroup>
          </tbody>
        </table>
      </div>
    </div>
  );
}
