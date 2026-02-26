import React, { useState } from 'react';
import { useScenario, useWhatIf } from '../store/ScenarioContext';
import { formatShort, formatPct } from '../utils/formatters';
import { usePersistedYear } from '../utils/usePersistedYear';
import { TaxWaterfallChart } from '../components/RightPanel/ChartsView/TaxWaterfallChart';
import { IncomeBreakdownChart } from '../components/RightPanel/ChartsView/IncomeBreakdownChart';
import { CumulativeCashFlowChart } from '../components/RightPanel/ChartsView/CumulativeCashFlowChart';
import { CashflowExpensesChart } from '../components/RightPanel/ChartsView/CashflowExpensesChart';
import { sliceByRange } from '../components/ChartRangeSelector';
import type { ChartRange } from '../components/ChartRangeSelector';
import type { ComputedYear } from '../types/computed';
import { usePersistedState } from '../utils/usePersistedState';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useChartColors } from '../hooks/useChartColors';
import { safe } from '../utils/formatters';

// ── Palette ────────────────────────────────────────────────────────────
const PALETTE = {
  accounts: { rrsp: '#3b82f6', tfsa: '#10b981', fhsa: '#8b5cf6', nonReg: '#f59e0b', savings: '#06b6d4' },
  positive: '#10b981', negative: '#f43f5e', neutral: '#64748b',
};

// ── Types ──────────────────────────────────────────────────────────────
type ViewMode = 'nominal' | 'real' | 'diff';
const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'nominal', label: 'Nominal' },
  { value: 'real', label: 'Real' },
  { value: 'diff', label: 'Diff' },
];
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '5y', label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: '25y', label: '25Y' },
  { value: 'all', label: 'All' },
];

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem('cdn-tax-real-mode');
    if (v === 'diff') return 'diff';
    return v === '1' ? 'real' : 'nominal';
  } catch { return 'nominal'; }
}

// ── MiniSparkline (pure SVG) ───────────────────────────────────────────
function MiniSparkline({ data, color, width = 80, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return { x, y };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];
  const areaPath = `M${points[0].x},${height} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${last.x},${height} Z`;
  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

// ── Pill Toggle ────────────────────────────────────────────────────────
function PillToggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="bg-app-surface2 rounded-md p-0.5 flex gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-all ${
            value === o.value
              ? 'bg-app-surface text-app-text'
              : 'text-app-text3 hover:text-app-text2'
          }`}
          style={value === o.value ? { boxShadow: 'var(--app-shadow-sm)' } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── ModernTooltip for hero chart ───────────────────────────────────────
function HeroChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => (p.value ?? 0) !== 0);
  const total = items.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div style={{
      background: 'var(--app-tooltip-bg)', borderRadius: 8, padding: '10px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--app-glass-border)', fontSize: 11, minWidth: 160,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--app-text2)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--app-border)' }}>{label}</div>
      {[...items].reverse().map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.fill || p.stroke }} />
            <span style={{ color: 'var(--app-text3)' }}>{p.dataKey}</span>
          </div>
          <span style={{ fontWeight: 500, color: 'var(--app-text)', fontVariantNumeric: 'tabular-nums' }}>{formatShort(p.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 6, borderTop: '1px solid var(--app-border)', fontWeight: 600 }}>
          <span style={{ color: 'var(--app-text2)' }}>Total</span>
          <span style={{ color: 'var(--app-text)', fontVariantNumeric: 'tabular-nums' }}>{formatShort(total)}</span>
        </div>
      )}
    </div>
  );
}

// ── Hero Net Worth Chart (moved to 2x2 grid) ──────────────────────────
const HERO_ACCOUNTS = [
  { key: 'RRSP', color: PALETTE.accounts.rrsp },
  { key: 'TFSA', color: PALETTE.accounts.tfsa },
  { key: 'FHSA', color: PALETTE.accounts.fhsa },
  { key: 'Non-Reg', color: PALETTE.accounts.nonReg },
  { key: 'Savings', color: PALETTE.accounts.savings },
];

function HeroNetWorthChart({ years, realMode, diffMode }: { years: ComputedYear[]; realMode: boolean; diffMode: boolean }) {
  const cc = useChartColors();

  if (diffMode) {
    const data = years.map(y => ({
      year: y.year,
      'Nominal NW': Math.round(safe(y.accounts.netWorth)),
      'Real NW': Math.round(safe(y.realNetWorth)),
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="hero-grad-nom" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="hero-grad-real" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={cc.gridStroke} />
          <XAxis dataKey="year" tick={cc.axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={false} tickLine={false} />
          <Tooltip content={<HeroChartTooltip />} />
          <Area type="monotone" dataKey="Nominal NW" stroke="#64748b" strokeWidth={0} fill="url(#hero-grad-nom)" />
          <Area type="monotone" dataKey="Real NW" stroke="#3b82f6" strokeWidth={2} fill="url(#hero-grad-real)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const data = years.map(y => {
    const f = realMode ? y.inflationFactor : 1;
    return {
      year: y.year,
      RRSP: Math.round(safe(y.accounts.rrspEOY / f)),
      TFSA: Math.round(safe(y.accounts.tfsaEOY / f)),
      FHSA: Math.round(safe(y.accounts.fhsaEOY / f)),
      'Non-Reg': Math.round(safe(y.accounts.nonRegEOY / f)),
      Savings: Math.round(safe(y.accounts.savingsEOY / f)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
        <defs>
          {HERO_ACCOUNTS.map(a => (
            <linearGradient key={a.key} id={`hero-grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={a.color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={a.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={false} tickLine={false} />
        <Tooltip content={<HeroChartTooltip />} />
        {HERO_ACCOUNTS.map(a => (
          <Area
            key={a.key}
            type="monotone"
            dataKey={a.key}
            stackId="1"
            stroke={a.color}
            strokeWidth={0}
            fill={`url(#hero-grad-${a.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── What-If Overlay Chart ─────────────────────────────────────────────
function WhatIfOverlayChart({ baseYears, whatIfYears }: {
  baseYears: ComputedYear[];
  whatIfYears: ComputedYear[];
}) {
  const cc = useChartColors();
  const data = baseYears.map((y, i) => ({
    year: y.year,
    'Base NW': Math.round(safe(y.accounts.netWorth)),
    'What-If NW': Math.round(safe(whatIfYears[i]?.accounts.netWorth ?? 0)),
    'Base Income': Math.round(safe(y.waterfall.afterTaxIncome)),
    'What-If Income': Math.round(safe(whatIfYears[i]?.waterfall.afterTaxIncome ?? 0)),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={cc.gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={cc.axisTick} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => formatShort(v)} tick={cc.axisTick} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={cc.tooltipStyle} formatter={(v: number, name: string) => [formatShort(v), name]} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="Base NW" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Base Net Worth" />
        <Line type="monotone" dataKey="What-If NW" stroke="#2563eb" strokeWidth={2.5} dot={false} name="What-If Net Worth" />
        <Line type="monotone" dataKey="Base Income" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Base After-Tax" />
        <Line type="monotone" dataKey="What-If Income" stroke="#10b981" strokeWidth={2} dot={false} name="What-If After-Tax" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Chart Section wrapper ──────────────────────────────────────────────
function ChartSection({ title, children, height = 200 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
      <div className="px-4 pt-3 pb-0.5">
        <div className="text-[11px] font-semibold text-app-text2">{title}</div>
      </div>
      <div style={{ height, padding: '4px 10px 6px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Detail KPI row ─────────────────────────────────────────────────────
function DKPI({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-0.5">
      <span className="text-[11px] text-app-text3 truncate">{label}</span>
      <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${cls ?? 'text-app-text'}`}>{value}</span>
    </div>
  );
}

// ── YoY Columns ────────────────────────────────────────────────────────
function getYoYCols(mode: ViewMode): { label: string; fn: (y: ComputedYear) => string; cls?: string | ((y: ComputedYear) => string) }[] {
  const real = mode === 'real';
  const diff = mode === 'diff';
  const d = (v: number, y: ComputedYear) => real ? v / y.inflationFactor : v;

  if (diff) {
    return [
      { label: 'Year', fn: y => String(y.year), cls: 'text-app-text2 font-medium' },
      { label: 'Gross (Nom)', fn: y => formatShort(y.waterfall.grossIncome) },
      { label: 'Gross (Real)', fn: y => formatShort(y.realGrossIncome), cls: 'text-app-accent' },
      { label: 'After-Tax (Nom)', fn: y => formatShort(y.waterfall.afterTaxIncome), cls: 'text-emerald-600' },
      { label: 'After-Tax (Real)', fn: y => formatShort(y.realAfterTaxIncome), cls: 'text-app-accent' },
      { label: 'NW (Nom)', fn: y => formatShort(y.accounts.netWorth), cls: 'font-medium' },
      { label: 'NW (Real)', fn: y => formatShort(y.realNetWorth), cls: 'text-app-accent font-medium' },
      { label: 'Erosion', fn: y => {
        const factor = y.inflationFactor;
        return factor > 1 ? `-${formatPct(1 - 1/factor)}` : '0%';
      }, cls: 'text-orange-500' },
      { label: 'Inflate x', fn: y => y.inflationFactor.toFixed(3), cls: 'text-app-text4' },
    ];
  }

  return [
    { label: 'Year', fn: y => String(y.year), cls: 'text-app-text2 font-medium' },
    { label: real ? 'Real Gross' : 'Gross Income', fn: y => formatShort(real ? y.realGrossIncome : y.waterfall.grossIncome) },
    { label: 'Net Taxable', fn: y => formatShort(d(y.tax.netTaxableIncome, y)) },
    { label: 'Fed Tax', fn: y => formatShort(d(y.tax.federalTaxPayable, y)), cls: 'text-red-600' },
    { label: 'Prov Tax', fn: y => formatShort(d(y.tax.provincialTaxPayable, y)), cls: 'text-red-600' },
    { label: 'CPP+EI', fn: y => formatShort(d(y.cpp.totalCPPPaid + y.ei.totalEI, y)) },
    { label: real ? 'Real After-Tax' : 'After-Tax', fn: y => formatShort(real ? y.realAfterTaxIncome : y.waterfall.afterTaxIncome), cls: 'text-emerald-600' },
    {
      label: real ? 'Real CF' : 'Net CF',
      fn: y => formatShort(real ? y.realNetCashFlow : y.waterfall.netCashFlow),
      cls: (y: ComputedYear) => (real ? y.realNetCashFlow : y.waterfall.netCashFlow) >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    { label: 'Marg Rate', fn: y => formatPct(y.tax.marginalCombinedRate) },
    { label: real ? 'Real NW' : 'Net Worth', fn: y => formatShort(real ? y.realNetWorth : y.accounts.netWorth), cls: 'font-medium' },
  ];
}

// ── What-If Delta Badge ────────────────────────────────────────────────
function DeltaBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 1) return null;
  const positive = diff >= 0;
  return (
    <span className={`inline-block ml-1.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
      positive
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    }`}>
      {positive ? '+' : ''}{formatShort(diff)}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════
// OverviewPage
// ══════════════════════════════════════════════════════════════════════
export function OverviewPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { activeComputed, activeScenario } = useScenario();
  const { isActive: isWhatIfMode, computed: whatIfComputed } = useWhatIf();
  const [viewMode, setViewModeRaw] = useState<ViewMode>(loadViewMode);
  function setViewMode(v: ViewMode) {
    setViewModeRaw(v);
    try { localStorage.setItem('cdn-tax-real-mode', v === 'real' ? '1' : v === 'diff' ? 'diff' : '0'); } catch {}
  }
  const realMode = viewMode === 'real';
  const diffMode = viewMode === 'diff';
  const [chartRange, setChartRange] = usePersistedState<ChartRange>('cdn-tax-chart-range-overview', 'all');
  const [yoyOpen, setYoyOpen] = usePersistedState('cdn-tax-yoy-open', false);

  if (!activeComputed || !activeScenario) {
    return <div className="p-8 text-app-text4 text-sm">No scenario data.</div>;
  }

  // Use what-if computed data when active, fall back to base
  const displayComputed = (isWhatIfMode && whatIfComputed) ? whatIfComputed : activeComputed;
  const years = displayComputed.years;
  const [selectedYearIdx, setSelectedYearIdx] = usePersistedYear(years.length - 1);
  const yr = years[selectedYearIdx] ?? years[years.length - 1];
  const analytics = displayComputed.analytics;

  if (!yr) return null;

  const prevYr = years[selectedYearIdx - 1];
  const { tax, cpp, ei, waterfall, accounts } = yr;
  const grossIncome = realMode ? yr.realGrossIncome : waterfall.grossIncome;
  const afterTaxIncome = realMode ? yr.realAfterTaxIncome : waterfall.afterTaxIncome;
  const netWorth = realMode ? yr.realNetWorth : accounts.netWorth;
  const netCashFlow = realMode ? yr.realNetCashFlow : waterfall.netCashFlow;
  const totalTax = tax.totalIncomeTax + cpp.totalCPPPaid + ei.totalEI;
  const effRate = waterfall.grossIncome > 0 ? totalTax / waterfall.grossIncome : 0;

  // What-If delta computation for KPIs
  const baseYr = activeComputed.years[selectedYearIdx] ?? activeComputed.years[activeComputed.years.length - 1];
  const baseNW = baseYr ? (realMode ? baseYr.realNetWorth : baseYr.accounts.netWorth) : 0;
  const baseAfterTax = baseYr ? (realMode ? baseYr.realAfterTaxIncome : baseYr.waterfall.afterTaxIncome) : 0;
  const baseTotalTax = baseYr ? (baseYr.tax.totalIncomeTax + baseYr.cpp.totalCPPPaid + baseYr.ei.totalEI) : 0;
  const baseCF = baseYr ? (realMode ? baseYr.realNetCashFlow : baseYr.waterfall.netCashFlow) : 0;
  const baseGross = baseYr ? (realMode ? baseYr.realGrossIncome : baseYr.waterfall.grossIncome) : 0;

  // YoY % changes
  const pctChange = (curr: number, prev: number | undefined) => {
    if (prev === undefined || prev === 0) return null;
    return (curr - prev) / Math.abs(prev);
  };
  const prevNW = prevYr ? (realMode ? prevYr.realNetWorth : prevYr.accounts.netWorth) : undefined;
  const prevAfterTax = prevYr ? (realMode ? prevYr.realAfterTaxIncome : prevYr.waterfall.afterTaxIncome) : undefined;
  const prevTotalTax = prevYr ? (prevYr.tax.totalIncomeTax + prevYr.cpp.totalCPPPaid + prevYr.ei.totalEI) : undefined;
  const prevCF = prevYr ? (realMode ? prevYr.realNetCashFlow : prevYr.waterfall.netCashFlow) : undefined;
  const prevGross = prevYr ? (realMode ? prevYr.realGrossIncome : prevYr.waterfall.grossIncome) : undefined;

  const nwChange = pctChange(netWorth, prevNW);
  const atChange = pctChange(afterTaxIncome, prevAfterTax);
  const taxChange = pctChange(totalTax, prevTotalTax);
  const cfChange = pctChange(netCashFlow, prevCF);
  const grossChange = pctChange(grossIncome, prevGross);

  // Sparkline data — respect the chart range selector
  const sparkYears = sliceByRange(years, chartRange);
  const sparkNW = sparkYears.map(y => realMode ? y.realNetWorth : y.accounts.netWorth);
  const sparkAT = sparkYears.map(y => realMode ? y.realAfterTaxIncome : y.waterfall.afterTaxIncome);
  const sparkTax = sparkYears.map(y => y.tax.totalIncomeTax + y.cpp.totalCPPPaid + y.ei.totalEI);
  const sparkCF = sparkYears.map(y => realMode ? y.realNetCashFlow : y.waterfall.netCashFlow);
  const sparkGross = sparkYears.map(y => realMode ? y.realGrossIncome : y.waterfall.grossIncome);

  const warnings = years.flatMap(y => y.warnings.filter(w => w.severity === 'error'));

  const chartYears = sliceByRange(years, chartRange);
  const chartRawYears = sliceByRange(displayComputed.effectiveYears, chartRange);
  const chartComputed = {
    ...displayComputed,
    years: chartYears,
    analytics: {
      ...displayComputed.analytics,
      annualCashFlow: sliceByRange(analytics.annualCashFlow, chartRange),
      cumulativeCashFlow: sliceByRange(analytics.cumulativeCashFlow, chartRange),
      cumulativeRealCashFlow: sliceByRange(analytics.cumulativeRealCashFlow, chartRange),
    },
  };

  // Trend badge helper
  function TrendBadge({ change, invert }: { change: number | null; invert?: boolean }) {
    if (change === null) return null;
    const isPositive = invert ? change < 0 : change >= 0;
    const arrow = change >= 0 ? '\u25B2' : '\u25BC';
    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
        isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                   : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
      }`}>
        <span style={{ fontSize: 7 }}>{arrow}</span>
        {formatPct(Math.abs(change))}
      </span>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-bg">
      {/* ── Sticky Glass Toolbar ─────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{
          background: 'var(--app-glass)',
          borderColor: 'var(--app-glass-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PillToggle options={VIEW_MODES} value={viewMode} onChange={setViewMode} />
            {isWhatIfMode && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                What-If Active
              </span>
            )}
          </div>
          <PillToggle options={RANGE_OPTIONS} value={chartRange} onChange={setChartRange} />
          <select
            className="text-xs rounded px-2.5 py-1 bg-app-surface2 text-app-text2 outline-none border border-app-border font-medium"
            value={selectedYearIdx}
            onChange={e => setSelectedYearIdx(Number(e.target.value))}
          >
            {years.map((y, i) => (
              <option key={y.year} value={i}>{y.year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-4 space-y-3">

        {/* ── Warnings banner ────────────────────────────────────────── */}
        {warnings.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2.5 border border-red-200 dark:border-red-800/40">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-red-700 dark:text-red-400">Validation Issues ({warnings.length})</div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('scheduling')}
                  className="text-[11px] text-red-600 dark:text-red-400 hover:text-red-800 underline underline-offset-2 transition-colors"
                >
                  View all in Scheduling
                </button>
              )}
            </div>
            <ul className="text-xs text-red-600 dark:text-red-300 space-y-0.5">
              {warnings.slice(0, 5).map((w, i) => <li key={i}>- {w.message}</li>)}
              {warnings.length > 5 && <li className="text-app-text3">...and {warnings.length - 5} more</li>}
            </ul>
          </div>
        )}

        {/* ── Hero KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Gross Income', value: grossIncome, change: grossChange, spark: sparkGross, color: PALETTE.positive, sub: realMode ? `Nominal: ${formatShort(waterfall.grossIncome)}` : undefined, delta: isWhatIfMode ? grossIncome - baseGross : 0 },
            { label: 'Total Tax', value: totalTax, change: taxChange, spark: sparkTax, color: PALETTE.negative, invert: true, sub: `${formatPct(effRate)} eff. rate`, delta: isWhatIfMode ? totalTax - baseTotalTax : 0 },
            { label: 'Net Cash Flow', value: netCashFlow, change: cfChange, spark: sparkCF, color: netCashFlow >= 0 ? PALETTE.positive : PALETTE.negative, delta: isWhatIfMode ? netCashFlow - baseCF : 0 },
            { label: 'Net Worth', value: netWorth, change: nwChange, spark: sparkNW, color: PALETTE.accounts.rrsp, sub: realMode ? `Nominal: ${formatShort(accounts.netWorth)}` : undefined, delta: isWhatIfMode ? netWorth - baseNW : 0 },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="bg-app-surface rounded-lg border border-app-border px-4 py-3"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-app-text3 font-medium">{kpi.label}</span>
                <TrendBadge change={kpi.change} invert={kpi.invert} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums text-app-text tracking-tight">
                  {formatShort(kpi.value)}
                </span>
                {isWhatIfMode && <DeltaBadge diff={kpi.delta} />}
              </div>
              {kpi.sub && <div className="text-[9px] text-app-text4 mt-0.5">{kpi.sub}</div>}
              <div className="mt-1.5">
                <MiniSparkline data={kpi.spark} color={kpi.color} width={72} height={26} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Hero Tax Waterfall Chart ──────────────────────────────── */}
        <ChartSection title={diffMode ? 'Tax Burden: Nominal vs Real' : 'Tax Waterfall'} height={240}>
          <TaxWaterfallChart years={chartYears} realMode={realMode} diffMode={diffMode} modern />
        </ChartSection>

        {/* ── What-If Overlay (only when active) ────────────────────── */}
        {isWhatIfMode && whatIfComputed && (
          <ChartSection title="What-If vs Base — Net Worth & After-Tax Income" height={220}>
            <WhatIfOverlayChart
              baseYears={sliceByRange(activeComputed.years, chartRange)}
              whatIfYears={sliceByRange(whatIfComputed.years, chartRange)}
            />
          </ChartSection>
        )}

        {/* ── Supporting Charts (2x2) — Net Worth now here ──────────── */}
        <div className="grid grid-cols-2 gap-3">
          <ChartSection title={diffMode ? 'Net Worth: Nominal vs Real' : realMode ? 'Real Net Worth Over Time' : 'Net Worth Over Time'}>
            <HeroNetWorthChart years={chartYears} realMode={realMode} diffMode={diffMode} />
          </ChartSection>
          <ChartSection title={diffMode ? 'Gross Income: Nominal vs Real' : 'Income Breakdown'}>
            <IncomeBreakdownChart years={chartYears} rawYears={chartRawYears} diffMode={diffMode} modern />
          </ChartSection>
          <ChartSection title={diffMode ? 'Cash Flow: Nominal vs Real' : realMode ? 'Real Cash Flow' : 'Cash Flow (Annual + Cumulative)'}>
            <CumulativeCashFlowChart computed={chartComputed} realMode={realMode} diffMode={diffMode} modern />
          </ChartSection>
          <ChartSection title="Cashflow vs Expenses">
            <CashflowExpensesChart years={chartYears} rawYears={chartRawYears} modern />
          </ChartSection>
        </div>

        {/* ── Detail Panels (3-col) ──────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Tax Breakdown */}
          <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
            <div className="px-4 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">Tax Breakdown</div>
            </div>
            <div className="px-4 pb-3 space-y-0.5">
              <DKPI label={realMode ? 'Real Gross Income' : 'Gross Income'} value={formatShort(grossIncome)} />
              <DKPI label="Net Taxable Income" value={formatShort(realMode ? tax.netTaxableIncome / yr.inflationFactor : tax.netTaxableIncome)} />
              <DKPI label="Federal Tax" value={formatShort(realMode ? tax.federalTaxPayable / yr.inflationFactor : tax.federalTaxPayable)} cls="text-red-600" />
              <DKPI label="Provincial Tax" value={formatShort(realMode ? tax.provincialTaxPayable / yr.inflationFactor : tax.provincialTaxPayable)} cls="text-red-600" />
              <DKPI label="CPP + EI" value={formatShort(realMode ? (cpp.totalCPPPaid + ei.totalEI) / yr.inflationFactor : cpp.totalCPPPaid + ei.totalEI)} />
              <div className="border-t border-app-border my-1" />
              <DKPI label={realMode ? 'Real After-Tax' : 'After-Tax Income'} value={formatShort(afterTaxIncome)} cls="text-emerald-600" />
              <DKPI label="Marginal Rate" value={formatPct(tax.marginalCombinedRate)} />
              <DKPI label="Avg All-In Rate" value={formatPct(tax.avgAllInRate)} />
            </div>
          </div>

          {/* Accounts EOY */}
          <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
            <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">Account Balances</div>
              <span className="text-[10px] font-medium text-app-text3">{formatShort(accounts.netWorth)} NW</span>
            </div>
            <div className="px-4 pb-3 space-y-0.5">
              <DKPI label="RRSP" value={formatShort(accounts.rrspEOY)} />
              <DKPI label="TFSA" value={formatShort(accounts.tfsaEOY)} />
              <DKPI label="FHSA" value={formatShort(accounts.fhsaEOY)} />
              <DKPI label="Non-Registered" value={formatShort(accounts.nonRegEOY)} />
              <DKPI label="Savings" value={formatShort(accounts.savingsEOY)} />
              <div className="border-t border-app-border my-1" />
              <DKPI label={realMode ? 'Real Net Worth' : 'Net Worth'} value={formatShort(netWorth)} cls="font-bold" />
            </div>
          </div>

          {/* Room & Lifetime */}
          <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
            <div className="px-4 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">Room & Lifetime</div>
            </div>
            <div className="px-4 pb-3 space-y-0.5">
              <DKPI label="RRSP Unused Room" value={formatShort(yr.rrspUnusedRoom)} />
              <DKPI label="TFSA Unused Room" value={formatShort(yr.tfsaUnusedRoom)} />
              <DKPI label="FHSA Unused Room" value={formatShort(yr.fhsaUnusedRoom)} />
              <DKPI label="Capital Loss C/F" value={formatShort(yr.capitalLossCF)} />
              <div className="border-t border-app-border my-1" />
              <div className="text-[10px] text-app-text4 uppercase tracking-wider font-semibold mb-0.5">Lifetime</div>
              <DKPI label="Lifetime Tax" value={formatShort(analytics.lifetimeTotalTax)} cls="text-red-600" />
              <DKPI label="Lifetime After-Tax" value={formatShort(analytics.lifetimeAfterTaxIncome)} cls="text-emerald-600" />
              <DKPI label="Avg Tax Rate" value={formatPct(analytics.lifetimeAvgTaxRate)} />
            </div>
          </div>
        </div>

        {/* ── YoY Table (collapsible) ────────────────────────────────── */}
        <div className="bg-app-surface rounded-lg border border-app-border overflow-hidden">
          <button
            onClick={() => setYoyOpen(!yoyOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-app-surface2/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-app-text3">{yoyOpen ? '\u25BE' : '\u25B8'}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text4">
                Year-over-Year Detail
              </span>
              {diffMode && <span className="text-orange-500 text-[10px] normal-case font-normal">Nominal vs Real</span>}
            </div>
            <span className="text-[10px] font-medium text-app-text4 bg-app-surface2 px-2 py-0.5 rounded-full">
              {years.length} years
            </span>
          </button>
          {yoyOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0">
                  <tr className="border-t border-b border-app-border bg-app-surface2">
                    {getYoYCols(viewMode).map(c => (
                      <th key={c.label} className="py-2 px-3 text-left text-[10px] font-semibold text-app-text3 whitespace-nowrap uppercase tracking-wide">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((rowYr, i) => {
                    const isSelected = i === selectedYearIdx;
                    return (
                      <tr
                        key={rowYr.year}
                        className={`border-b border-app-border hover:bg-app-accent-light transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-app-surface2/50' : ''} ${isSelected ? 'ring-1 ring-inset ring-app-accent/20' : ''}`}
                        onClick={() => setSelectedYearIdx(i)}
                      >
                        {getYoYCols(viewMode).map(c => {
                          const cls = typeof c.cls === 'function' ? c.cls(rowYr) : (c.cls ?? 'text-app-text2');
                          return (
                            <td key={c.label} className={`py-1.5 px-3 whitespace-nowrap ${cls}`}>
                              {c.fn(rowYr)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
