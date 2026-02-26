import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useScenario, useUpdateScenario } from '../store/ScenarioContext';
import { TimelineCell } from '../components/LeftPanel/TimelineTable/TimelineCell';
import { RowGroup, loadGroupState } from '../components/LeftPanel/TimelineTable/RowGroup';
import { useGridNavigation } from '../hooks/useGridNavigation';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { getScheduledAmount } from '../engine/index';
import type { YearData, ScheduledItem, Scenario } from '../types/scenario';
import type { ComputedYear } from '../types/computed';
import type { CellCoord, NavRow, GridNavigation } from '../hooks/useGridNavigation';
import { buildTimelineCSV, downloadCSV } from '../utils/exportCSV';

type YDKey = keyof YearData;

interface CellChange {
  yearIdx: number;
  key: YDKey;
  value: number | undefined; // undefined = delete the key (for overrides)
}

interface FillState { key: YDKey; pct: boolean }

const ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.1, 1.25];
const ZOOM_STORAGE_KEY = 'cdn-tax-timeline-zoom';
const BAND_STORAGE_KEY = 'cdn-tax-timeline-banding';
const GROUP_ORDER_STORAGE_KEY = 'cdn-tax-timeline-group-order';

function loadZoom(): number {
  try { const v = Number(localStorage.getItem(ZOOM_STORAGE_KEY)); return ZOOM_LEVELS.includes(v) ? v : 1; } catch { return 1; }
}
function loadBanding(): boolean {
  try { return localStorage.getItem(BAND_STORAGE_KEY) === '1'; } catch { return false; }
}

function getRefFromComputed(ref: string, cy: ComputedYear): number {
  switch (ref) {
    case 'grossIncome': return cy.waterfall.grossIncome;
    case 'netTaxableIncome': return cy.tax.netTaxableIncome;
    case 'afterTaxIncome': return cy.waterfall.afterTaxIncome;
    case 'netCashFlow': return cy.waterfall.netCashFlow;
    case 'netWorth': return cy.accounts.netWorth;
    case 'totalIncomeTax': return cy.tax.totalIncomeTax;
    case 'employmentIncome': return cy.waterfall.grossIncome;
    case 'selfEmploymentIncome': return 0;
    case 'rrspEOY': return cy.accounts.rrspEOY;
    case 'tfsaEOY': return cy.accounts.tfsaEOY;
    case 'fhsaEOY': return cy.accounts.fhsaEOY;
    case 'nonRegEOY': return cy.accounts.nonRegEOY;
    case 'savingsEOY': return cy.accounts.savingsEOY;
    case 'rrspUnusedRoom': return cy.rrspUnusedRoom;
    case 'tfsaUnusedRoom': return cy.tfsaUnusedRoom;
    case 'capitalGainsRealized': return cy.tax.taxableCapitalGains; // from computed tax
    case 'capitalLossCF': return cy.capitalLossCF;
    case 'liraEOY': return cy.accounts.liraEOY;
    case 'respEOY': return cy.accounts.respEOY;
    case 'rentalGrossIncome': return 0;
    case 'pensionIncome': return 0;
    case 'foreignIncome': return 0;
    default: return 0;
  }
}

function buildScheduleOverlay(
  schedules: ScheduledItem[],
  years: YearData[],
  inflationRate: number,
  computedYears?: ComputedYear[]
): Map<number, Map<string, number>> {
  const overlay = new Map<number, Map<string, number>>();
  for (let i = 0; i < years.length; i++) {
    const yd = years[i];
    const cy = computedYears?.[i];
    const fieldMap = new Map<string, number>();
    for (const s of schedules) {
      if (yd.year < s.startYear) continue;
      if (s.endYear !== undefined && yd.year > s.endYear) continue;
      const field = s.field;
      if (!fieldMap.has(field)) {
        const hasConditions = s.conditions && s.conditions.length > 0;
        if (s.amountType === 'percentage' && cy && s.amountReference) {
          const refValue = getRefFromComputed(s.amountReference, cy);
          let pctAmt = getScheduledAmount(s, yd.year, inflationRate) * refValue;
          if (s.amountMin !== undefined && s.amountMin > 0) pctAmt = Math.max(pctAmt, s.amountMin);
          if (s.amountMax !== undefined && s.amountMax > 0) pctAmt = Math.min(pctAmt, s.amountMax);
          if (pctAmt > 0) fieldMap.set(field, pctAmt);
        } else if (s.amountType === 'percentage') {
          // No computed data — skip
        } else if (hasConditions && cy) {
          const amt = getScheduledAmount(s, yd.year, inflationRate);
          if (amt > 0) fieldMap.set(field, amt);
        } else if (!hasConditions) {
          fieldMap.set(field, getScheduledAmount(s, yd.year, inflationRate));
        }
      }
    }
    if (fieldMap.size > 0) overlay.set(i, fieldMap);
  }
  return overlay;
}

// Default group order
const DEFAULT_GROUP_ORDER = [
  'Income', 'Expenses & Deductions', 'RRSP', 'TFSA', 'FHSA', 'Non-Reg & Savings', 'LIRA/LIF', 'RESP',
  'Asset Allocation', 'Capital Loss', 'ACB Tracking',
  'EOY Overrides', 'Retirement (Computed)', 'Liabilities (Computed)', 'Rate Overrides',
  'Contribution Room', 'Tax Results (Computed)',
];

const GROUP_DEFAULTS: Record<string, boolean> = {
  'Income': true,
  'Expenses & Deductions': false,
  'RRSP': true,
  'TFSA': true,
  'FHSA': true,
  'Non-Reg & Savings': true,
  'LIRA/LIF': false,
  'RESP': false,
  'Asset Allocation': false,
  'Capital Loss': false,
  'ACB Tracking': false,
  'EOY Overrides': false,
  'Retirement (Computed)': false,
  'Liabilities (Computed)': false,
  'Rate Overrides': false,
  'Contribution Room': false,
  'Tax Results (Computed)': true,
};

function loadGroupOrder(): string[] {
  try {
    const raw = localStorage.getItem(GROUP_ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_GROUP_ORDER;
    const parsed = JSON.parse(raw) as string[];
    // Validate: must contain exactly the same groups
    if (parsed.length !== DEFAULT_GROUP_ORDER.length) return DEFAULT_GROUP_ORDER;
    const set = new Set(parsed);
    if (DEFAULT_GROUP_ORDER.some(g => !set.has(g))) return DEFAULT_GROUP_ORDER;
    return parsed;
  } catch { return DEFAULT_GROUP_ORDER; }
}

function saveGroupOrder(order: string[]) {
  try { localStorage.setItem(GROUP_ORDER_STORAGE_KEY, JSON.stringify(order)); } catch {}
}

// Static row registry — all navigable rows in render order
type RowEntry = { rowId: string; editable: boolean; group: string; pct?: boolean; isOverride?: boolean };
const ROW_REGISTRY: RowEntry[] = [
  // Income
  { rowId: 'employmentIncome', editable: true, group: 'Income' },
  { rowId: 'selfEmploymentIncome', editable: true, group: 'Income' },
  { rowId: 'eligibleDividends', editable: true, group: 'Income' },
  { rowId: 'nonEligibleDividends', editable: true, group: 'Income' },
  { rowId: 'interestIncome', editable: true, group: 'Income' },
  { rowId: 'capitalGainsRealized', editable: true, group: 'Income' },
  { rowId: 'capitalLossesRealized', editable: true, group: 'Income' },
  { rowId: 'otherTaxableIncome', editable: true, group: 'Income' },
  { rowId: 'rentalGrossIncome', editable: true, group: 'Income' },
  { rowId: 'pensionIncome', editable: true, group: 'Income' },
  { rowId: 'foreignIncome', editable: true, group: 'Income' },
  { rowId: '_summary_grossIncome', editable: false, group: 'Income' },
  // Expenses & Deductions
  { rowId: 'rentalExpenses', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'foreignTaxPaid', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'charitableDonations', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'selfEmploymentExpenses', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'childCareExpenses', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'unionDues', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'movingExpenses', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'otherDeductions', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'medicalExpenses', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'studentLoanInterest', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'otherNonRefundableCredits', editable: true, group: 'Expenses & Deductions' },
  { rowId: 'lcgeClaimAmount', editable: true, group: 'Expenses & Deductions' },
  // RRSP
  { rowId: 'rrspContribution', editable: true, group: 'RRSP' },
  { rowId: 'rrspDeductionClaimed', editable: true, group: 'RRSP' },
  { rowId: 'rrspWithdrawal', editable: true, group: 'RRSP' },
  // TFSA
  { rowId: 'tfsaContribution', editable: true, group: 'TFSA' },
  { rowId: 'tfsaWithdrawal', editable: true, group: 'TFSA' },
  // FHSA
  { rowId: 'fhsaContribution', editable: true, group: 'FHSA' },
  { rowId: 'fhsaDeductionClaimed', editable: true, group: 'FHSA' },
  { rowId: 'fhsaWithdrawal', editable: true, group: 'FHSA' },
  // Non-Reg & Savings
  { rowId: 'nonRegContribution', editable: true, group: 'Non-Reg & Savings' },
  { rowId: 'nonRegWithdrawal', editable: true, group: 'Non-Reg & Savings' },
  { rowId: 'savingsDeposit', editable: true, group: 'Non-Reg & Savings' },
  { rowId: 'savingsWithdrawal', editable: true, group: 'Non-Reg & Savings' },
  // LIRA/LIF
  { rowId: 'lifWithdrawal', editable: true, group: 'LIRA/LIF' },
  { rowId: '_computed_liraEOY', editable: false, group: 'LIRA/LIF' },
  { rowId: '_computed_lifMin', editable: false, group: 'LIRA/LIF' },
  { rowId: '_computed_lifMax', editable: false, group: 'LIRA/LIF' },
  // RESP
  { rowId: 'respContribution', editable: true, group: 'RESP' },
  { rowId: 'respWithdrawal', editable: true, group: 'RESP' },
  { rowId: '_computed_respEOY', editable: false, group: 'RESP' },
  { rowId: '_computed_respCESG', editable: false, group: 'RESP' },
  // Asset Allocation
  { rowId: 'rrspEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'rrspFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'rrspCashPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: '_computed_rrspReturn', editable: false, group: 'Asset Allocation' },
  { rowId: 'tfsaEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'tfsaFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'tfsaCashPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'fhsaEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'fhsaFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'fhsaCashPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'nonRegEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'nonRegFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'nonRegCashPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'liraEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'liraFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'liraCashPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'respEquityPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'respFixedPct', editable: true, group: 'Asset Allocation', pct: true },
  { rowId: 'respCashPct', editable: true, group: 'Asset Allocation', pct: true },
  // Capital Loss
  { rowId: 'capitalLossApplied', editable: true, group: 'Capital Loss' },
  { rowId: '_computed_capitalLossCF', editable: false, group: 'Capital Loss' },
  // ACB Tracking
  { rowId: '_computed_acbOpening', editable: false, group: 'ACB Tracking' },
  { rowId: '_computed_acbAdded', editable: false, group: 'ACB Tracking' },
  { rowId: '_computed_acbRemoved', editable: false, group: 'ACB Tracking' },
  { rowId: '_computed_acbClosing', editable: false, group: 'ACB Tracking' },
  { rowId: '_computed_acbPerUnit', editable: false, group: 'ACB Tracking' },
  { rowId: '_computed_acbCG', editable: false, group: 'ACB Tracking' },
  // EOY Overrides
  { rowId: 'rrspEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'tfsaEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'fhsaEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'nonRegEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'savingsEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'liraEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  { rowId: 'respEOYOverride', editable: true, group: 'EOY Overrides', isOverride: true },
  // Retirement (Computed)
  { rowId: '_computed_age', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_cppIncome', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_oasIncome', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_gisIncome', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_rrifStatus', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_rrifMin', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_hbpBalance', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_hbpRepayReq', editable: false, group: 'Retirement (Computed)' },
  { rowId: '_computed_hbpShortfall', editable: false, group: 'Retirement (Computed)' },
  // Liabilities (Computed)
  { rowId: '_computed_totalDebt', editable: false, group: 'Liabilities (Computed)' },
  { rowId: '_computed_debtPayment', editable: false, group: 'Liabilities (Computed)' },
  { rowId: '_computed_interestPaid', editable: false, group: 'Liabilities (Computed)' },
  // Rate Overrides
  { rowId: 'inflationRateOverride', editable: true, group: 'Rate Overrides', pct: true, isOverride: true },
  { rowId: 'equityReturnOverride', editable: true, group: 'Rate Overrides', pct: true, isOverride: true },
  { rowId: 'fixedIncomeReturnOverride', editable: true, group: 'Rate Overrides', pct: true, isOverride: true },
  { rowId: 'cashReturnOverride', editable: true, group: 'Rate Overrides', pct: true, isOverride: true },
  { rowId: 'savingsReturnOverride', editable: true, group: 'Rate Overrides', pct: true, isOverride: true },
  // Contribution Room
  { rowId: '_computed_rrspRoom', editable: false, group: 'Contribution Room' },
  { rowId: '_computed_tfsaRoom', editable: false, group: 'Contribution Room' },
  { rowId: '_computed_fhsaRoom', editable: false, group: 'Contribution Room' },
  { rowId: '_computed_clCF', editable: false, group: 'Contribution Room' },
  // Tax Results
  { rowId: '_computed_netTaxable', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_fedTax', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_provTax', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_cppPaid', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_eiPaid', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_afterTax', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_netCash', editable: false, group: 'Tax Results (Computed)' },
  { rowId: '_computed_netWorth', editable: false, group: 'Tax Results (Computed)' },
];

export function TimelinePage() {
  const { activeScenario, activeComputed } = useScenario();
  const rawUpdate = useUpdateScenario();
  const { trackedUpdate: update, undo, redo, canUndo, canRedo } = useUndoRedo(activeScenario, rawUpdate);
  const tableRef = useRef<HTMLDivElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);

  const [fillRow, setFillRow] = useState<FillState | null>(null);
  const [fillVal, setFillVal] = useState('');
  const [zoom, setZoomRaw] = useState(loadZoom);
  const [banding, setBandingRaw] = useState(loadBanding);
  const LONGNUM_KEY = 'cdn-tax-timeline-longnum';
  const [longNumbers, setLongNumbersRaw] = useState(() => {
    try { return localStorage.getItem(LONGNUM_KEY) === '1'; } catch { return false; }
  });
  function setLongNumbers(v: boolean) { setLongNumbersRaw(v); try { localStorage.setItem(LONGNUM_KEY, v ? '1' : '0'); } catch {} }

  // Group open/close state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = loadGroupState();
    const state: Record<string, boolean> = {};
    for (const title of DEFAULT_GROUP_ORDER) {
      state[title] = saved[title] !== undefined ? saved[title] : (GROUP_DEFAULTS[title] ?? true);
    }
    return state;
  });

  // Group order state (draggable reorder)
  const [groupOrder, setGroupOrder] = useState<string[]>(loadGroupOrder);
  const [dragGroup, setDragGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const toggleGroup = useCallback((title: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        const stored = JSON.parse(localStorage.getItem('cdn-tax-rowgroup-state') || '{}');
        stored[title] = next[title];
        localStorage.setItem('cdn-tax-rowgroup-state', JSON.stringify(stored));
      } catch {}
      return next;
    });
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((title: string, e: React.DragEvent) => {
    setDragGroup(title);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', title);
    // Make the drag image a bit transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragOver = useCallback((title: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (title !== dragGroup) {
      setDragOverGroup(title);
    }
  }, [dragGroup]);

  const handleDragLeave = useCallback(() => {
    setDragOverGroup(null);
  }, []);

  const handleDrop = useCallback((targetTitle: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverGroup(null);
    const sourceTitle = dragGroup;
    if (!sourceTitle || sourceTitle === targetTitle) return;

    setGroupOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(sourceTitle);
      const toIdx = next.indexOf(targetTitle);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceTitle);
      saveGroupOrder(next);
      return next;
    });
  }, [dragGroup]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    setDragGroup(null);
    setDragOverGroup(null);
  }, []);

  function setZoom(v: number) { setZoomRaw(v); try { localStorage.setItem(ZOOM_STORAGE_KEY, String(v)); } catch {} }
  function setBanding(v: boolean) { setBandingRaw(v); try { localStorage.setItem(BAND_STORAGE_KEY, v ? '1' : '0'); } catch {} }

  function zoomIn() { const i = ZOOM_LEVELS.indexOf(zoom); if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1]); }
  function zoomOut() { const i = ZOOM_LEVELS.indexOf(zoom); if (i > 0) setZoom(ZOOM_LEVELS[i - 1]); }

  const schedules = activeScenario?.scheduledItems ?? [];
  const inflRate = activeScenario?.assumptions.inflationRate ?? 0;
  const computedYears = activeComputed?.years;
  const scheduleOverlay = useMemo(
    () => activeScenario ? buildScheduleOverlay(schedules, activeScenario.years, inflRate, computedYears) : new Map(),
    [schedules, activeScenario?.years, inflRate, computedYears]
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

  // Batched multi-cell update — applies all changes in a single dispatch
  const updateCells = useCallback((changes: CellChange[]) => {
    if (changes.length === 0) return;
    update((s: Scenario) => {
      const newYears = s.years.map(y => ({ ...y }));
      for (const { yearIdx, key, value } of changes) {
        if (yearIdx < 0 || yearIdx >= newYears.length) continue;
        if (value === undefined) {
          delete (newYears[yearIdx] as Record<string, unknown>)[key as string];
        } else {
          (newYears[yearIdx] as Record<string, unknown>)[key as string] = value;
        }
      }
      return { ...s, years: newYears };
    });
  }, [update]);

  const updateCellsRef = useRef(updateCells);
  updateCellsRef.current = updateCells;

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

  // Active rows sorted by current group order
  const activeRows: NavRow[] = useMemo(() => {
    const orderMap = new Map(groupOrder.map((g, i) => [g, i]));
    const sorted = [...ROW_REGISTRY].sort((a, b) => {
      const ai = orderMap.get(a.group) ?? 999;
      const bi = orderMap.get(b.group) ?? 999;
      if (ai !== bi) return ai - bi;
      return ROW_REGISTRY.indexOf(a) - ROW_REGISTRY.indexOf(b);
    });
    return sorted.filter(r => openGroups[r.group] !== false);
  }, [openGroups, groupOrder]);

  // Delete handler — batched single dispatch
  const handleDeleteCells = useCallback((cells: CellCoord[]) => {
    const changes: CellChange[] = [];
    for (const cell of cells) {
      if (cell.rowId.startsWith('_')) continue;
      const entry = ROW_REGISTRY.find(r => r.rowId === cell.rowId);
      if (!entry?.editable) continue;
      changes.push({
        yearIdx: cell.col,
        key: cell.rowId as YDKey,
        value: entry.isOverride ? undefined : 0,
      });
    }
    updateCellsRef.current(changes);
  }, []);

  // Multi-cell commit: when user edits with a range selected, apply value to all selected editable cells
  const handleMultiCellCommit = useCallback((cellKeys: Set<string>, value: number) => {
    const changes: CellChange[] = [];
    for (const key of cellKeys) {
      const [rowId, colStr] = key.split(':');
      const col = Number(colStr);
      const entry = ROW_REGISTRY.find(r => r.rowId === rowId);
      if (!entry?.editable) continue;
      changes.push({
        yearIdx: col,
        key: rowId as YDKey,
        value: entry.isOverride ? (value === 0 ? undefined : value) : value,
      });
    }
    updateCellsRef.current(changes);
  }, []);

  // Paste handler needs grid.focusedCell, so we use a ref that gets assigned after grid init
  const gridRef = useRef<GridNavigation | null>(null);
  const activeRowsRef = useRef(activeRows);
  activeRowsRef.current = activeRows;
  const yearsLenRef = useRef(years.length);
  yearsLenRef.current = years.length;

  const handlePaste = useCallback((text: string) => {
    const g = gridRef.current;
    if (!g?.focusedCell) return;
    const rows = activeRowsRef.current;
    const rowIdx = new Map(rows.map((r, i) => [r.rowId, i]));
    const startRI = rowIdx.get(g.focusedCell.rowId);
    if (startRI === undefined) return;
    const startCol = g.focusedCell.col;

    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    const changes: CellChange[] = [];

    for (let dr = 0; dr < lines.length; dr++) {
      const ri = startRI + dr;
      if (ri >= rows.length) break;
      const row = rows[ri];
      const cols = lines[dr].split('\t');
      for (let dc = 0; dc < cols.length; dc++) {
        const ci = startCol + dc;
        if (ci >= yearsLenRef.current) break;
        if (!row.editable) continue;
        const entry = ROW_REGISTRY.find(r => r.rowId === row.rowId);
        if (!entry?.editable) continue;
        // Strip $, K, %, commas for numeric parsing
        const raw = cols[dc].replace(/[$,K%\s]/gi, '');
        let n = parseFloat(raw);
        if (isNaN(n)) continue;
        // If original had K suffix, multiply by 1000
        if (/\d\s*K/i.test(cols[dc])) n *= 1000;
        // If pct row, divide by 100
        if (entry.pct) n = n / 100;
        changes.push({
          yearIdx: ci,
          key: row.rowId as YDKey,
          value: entry.isOverride ? (n === 0 ? undefined : n) : n,
        });
      }
    }
    if (changes.length > 0) updateCellsRef.current(changes);
  }, []);

  const grid = useGridNavigation(activeRows, years.length, tableRef, openGroups, {
    onDeleteCells: handleDeleteCells,
    onMultiCellCommit: handleMultiCellCommit,
    onUndo: undo,
    onRedo: redo,
    onPaste: handlePaste,
  });
  gridRef.current = grid;

  // Event delegation for click-drag on table container
  const findCellFromEvent = useCallback((e: React.MouseEvent): { rowId: string; col: number } | null => {
    const target = e.target as HTMLElement;
    const td = target.closest('td[data-row][data-col]') as HTMLElement | null;
    if (!td) return null;
    const rowId = td.dataset.row!;
    const col = Number(td.dataset.col!);
    return { rowId, col };
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left button
    if (e.button !== 0) return;
    const cell = findCellFromEvent(e);
    if (!cell) return;
    // Prevent text selection during drag
    e.preventDefault();
    // Ensure table container has focus for keyboard navigation
    tableRef.current?.focus();
    grid.handleCellMouseDown(cell.rowId, cell.col, e.shiftKey);
  }, [findCellFromEvent, grid.handleCellMouseDown]);

  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    if (!grid.isDragging.current) return;
    const cell = findCellFromEvent(e);
    if (!cell) return;
    grid.handleCellMouseEnter(cell.rowId, cell.col);
  }, [findCellFromEvent, grid.handleCellMouseEnter]);

  const handleTableMouseUp = useCallback(() => {
    grid.handleMouseUp();
  }, [grid.handleMouseUp]);

  // Stable cell callbacks
  const onCellClick = useCallback((rowId: string, col: number, shiftKey: boolean) => {
    grid.handleCellClick(rowId, col, shiftKey);
  }, [grid.handleCellClick]);

  const onCellDblClick = useCallback((rowId: string, col: number) => {
    grid.handleCellDblClick(rowId, col);
  }, [grid.handleCellDblClick]);

  const YEAR_WIDTH = 72;
  const LABEL_WIDTH = 175;

  let bandRowIdx = 0;

  function labelCell(label: string, key: YDKey, pct = false, isEditable = true) {
    const isActive = fillRow?.key === key;
    return (
      <td
        className="sticky left-0 bg-inherit z-10 py-0.5 pl-2 pr-1 text-[10px] text-app-text3 whitespace-nowrap border-r border-app-border group"
        style={{ minWidth: LABEL_WIDTH, maxWidth: LABEL_WIDTH }}
      >
        {isActive ? (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-app-accent shrink-0 font-semibold">ALL→</span>
            <input
              ref={fillInputRef}
              className="flex-1 min-w-0 text-[10px] border border-app-accent rounded px-1 py-px outline-none bg-app-accent-light text-app-text"
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
                className="opacity-0 group-hover:opacity-100 text-[8px] px-0.5 py-px text-app-accent hover:text-app-accent hover:bg-app-accent-light rounded transition-all"
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
    const isBanded = banding && myIdx % 2 === 1;
    return (
      <tr key={key} className={`border-b border-app-border hover:bg-app-accent-light/30 transition-colors`}
        style={isBanded ? { backgroundColor: 'var(--app-surface2)' } : undefined}
      >
        {labelCell(label, key, opts.pct, isEditable)}
        {years.map((yd, i) => {
          const warns = warningFields(i);
          const displayVal = opts.computedFn ? opts.computedFn(i) : (yd[key] as number ?? 0);
          const schedVal = scheduleOverlay.get(i)?.get(key as string);
          const focused = grid.isFocused(key, i);
          const selected = grid.isSelected(key, i);
          const isEditingThis = focused && grid.editing;
          return (
            <td
              key={yd.year}
              className="py-0.5 px-0.5"
              style={{ minWidth: YEAR_WIDTH }}
              data-row={key}
              data-col={i}
            >
              {opts.readOnly || opts.computedFn ? (
                <div className={`w-full text-right text-[10px] px-1 py-px text-app-text4 rounded ${focused ? 'ring-2 ring-app-accent ring-inset' : ''} ${selected && !focused ? 'bg-app-accent-light' : ''}`}>
                  {opts.pct
                    ? (displayVal * 100).toFixed(1) + '%'
                    : fmtVal(displayVal)}
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
                  isFocused={focused}
                  isSelected={selected}
                  isEditing={isEditingThis}
                  initialEditKey={isEditingThis ? grid.initialKey : null}
                  onCellClick={(shiftKey) => onCellClick(key, i, shiftKey)}
                  onCellDblClick={() => onCellDblClick(key, i)}
                  onEditCommit={grid.commitEdit}
                  onEditCancel={grid.cancelEdit}
                  longNumbers={longNumbers}
                />
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  // Render a computed-only row with data attributes and focus/selection styles
  function renderComputedRow(rowId: string, label: string, fn: (i: number) => string, colorCls?: string) {
    return (
      <tr key={rowId} className="border-b border-app-border">
        <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[10px] text-app-text3 whitespace-nowrap border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
        {years.map((_, i) => {
          const focused = grid.isFocused(rowId, i);
          const selected = grid.isSelected(rowId, i);
          return (
            <td
              key={i}
              className={`py-0.5 px-0.5 text-right text-[10px] ${colorCls ?? 'text-app-text4'} rounded ${focused ? 'ring-2 ring-app-accent ring-inset' : ''} ${selected && !focused ? 'bg-app-accent-light' : ''}`}
              data-row={rowId}
              data-col={i}
              onClick={(e) => onCellClick(rowId, i, e.shiftKey)}
            >
              {fn(i)}
            </td>
          );
        })}
      </tr>
    );
  }

  // Render an override/optional row (EOY overrides, Rate overrides)
  function renderOverrideRow(key: YDKey, label: string, pct?: boolean) {
    return (
      <tr key={key} className="border-b border-app-border hover:bg-app-accent-light/30">
        <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[10px] text-app-text3 whitespace-nowrap border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
        {years.map((yd, i) => {
          const v = yd[key] as number | undefined;
          const focused = grid.isFocused(key, i);
          const selected = grid.isSelected(key, i);
          const isEditingThis = focused && grid.editing;
          return (
            <td
              key={yd.year}
              className="py-0.5 px-0.5"
              style={{ minWidth: YEAR_WIDTH }}
              data-row={key}
              data-col={i}
            >
              <TimelineCell
                value={v ?? 0}
                onChange={val => updateYearOpt(i, key, val === 0 ? undefined : val)}
                pct={pct}
                hasOverride={v !== undefined}
                isFocused={focused}
                isSelected={selected}
                isEditing={isEditingThis}
                initialEditKey={isEditingThis ? grid.initialKey : null}
                onCellClick={(shiftKey) => onCellClick(key, i, shiftKey)}
                onCellDblClick={() => onCellDblClick(key, i)}
                onEditCommit={grid.commitEdit}
                onEditCancel={grid.cancelEdit}
                longNumbers={longNumbers}
              />
            </td>
          );
        })}
      </tr>
    );
  }

  // Drag props factory for a group
  function dragProps(title: string) {
    return {
      draggable: true as const,
      isDragOver: dragOverGroup === title,
      onDragStart: (e: React.DragEvent) => handleDragStart(title, e),
      onDragOver: (e: React.DragEvent) => handleDragOver(title, e),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(title, e),
      onDragEnd: handleDragEnd,
    };
  }

  // Helper for formatting computed cell values respecting longNumbers toggle
  function fmtVal(v: number): string {
    if (v === 0) return '—';
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    if (longNumbers) return sign + '$' + Math.round(abs).toLocaleString('en-CA');
    if (abs >= 1000) return sign + '$' + Math.round(abs / 1000) + 'K';
    return sign + '$' + Math.round(abs).toLocaleString('en-CA');
  }

  // ── Group content renderers ──
  function renderGroupContent(title: string): React.ReactNode {
    switch (title) {
      case 'Income':
        return (
          <>
            {renderRow('Employment', 'employmentIncome')}
            {renderRow('Self-Employment', 'selfEmploymentIncome')}
            {renderRow('Eligible Dividends', 'eligibleDividends')}
            {renderRow('Non-Elig. Dividends', 'nonEligibleDividends')}
            {renderRow('Interest', 'interestIncome')}
            {renderRow('Capital Gains', 'capitalGainsRealized')}
            {renderRow('Capital Losses', 'capitalLossesRealized')}
            {renderRow('Other Taxable', 'otherTaxableIncome')}
            {renderRow('Rental Gross', 'rentalGrossIncome')}
            {renderRow('Pension Income', 'pensionIncome')}
            {renderRow('Foreign Income', 'foreignIncome')}
            <tr className="bg-app-surface2 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface2 z-10 py-0.5 pl-3 pr-2 text-[10px] text-app-text2 font-semibold whitespace-nowrap border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>
                Total Gross Income
              </td>
              {years.map((_, i) => {
                const focused = grid.isFocused('_summary_grossIncome', i);
                const selected = grid.isSelected('_summary_grossIncome', i);
                return (
                  <td
                    key={i}
                    className={`py-0.5 px-0.5 text-right text-[10px] text-emerald-600 font-medium rounded ${focused ? 'ring-2 ring-app-accent ring-inset' : ''} ${selected && !focused ? 'bg-app-accent-light' : ''}`}
                    data-row="_summary_grossIncome"
                    data-col={i}
                    onClick={(e) => onCellClick('_summary_grossIncome', i, e.shiftKey)}
                  >
                    {computed[i] ? (longNumbers ? '$' + Math.round(computed[i].waterfall.grossIncome).toLocaleString('en-CA') : '$' + Math.round(computed[i].waterfall.grossIncome / 1000) + 'K') : '—'}
                  </td>
                );
              })}
            </tr>
          </>
        );

      case 'Expenses & Deductions':
        return (
          <>
            {renderRow('Rental Expenses', 'rentalExpenses')}
            {renderRow('Foreign Tax Paid', 'foreignTaxPaid')}
            {renderRow('Charitable Donations', 'charitableDonations')}
            {renderRow('SE Expenses', 'selfEmploymentExpenses' as YDKey)}
            {renderRow('Child Care', 'childCareExpenses' as YDKey)}
            {renderRow('Union/Prof. Dues', 'unionDues' as YDKey)}
            {renderRow('Moving Expenses', 'movingExpenses' as YDKey)}
            {renderRow('Other Deductions', 'otherDeductions' as YDKey)}
            {renderRow('Medical Expenses', 'medicalExpenses' as YDKey)}
            {renderRow('Student Loan Int.', 'studentLoanInterest' as YDKey)}
            {renderRow('Other Credits ($)', 'otherNonRefundableCredits' as YDKey)}
            {renderRow('LCGE Claim', 'lcgeClaimAmount' as YDKey)}
          </>
        );

      case 'RRSP':
        return (
          <>
            {renderRow('Contribution', 'rrspContribution')}
            {renderRow('Deduction Claimed', 'rrspDeductionClaimed')}
            {renderRow('Withdrawal', 'rrspWithdrawal')}
          </>
        );

      case 'TFSA':
        return (
          <>
            {renderRow('Contribution', 'tfsaContribution')}
            {renderRow('Withdrawal', 'tfsaWithdrawal')}
          </>
        );

      case 'FHSA':
        return (
          <>
            {renderRow('Contribution', 'fhsaContribution')}
            {renderRow('Deduction Claimed', 'fhsaDeductionClaimed')}
            {renderRow('Withdrawal', 'fhsaWithdrawal')}
          </>
        );

      case 'Non-Reg & Savings':
        return (
          <>
            {renderRow('Non-Reg Contribution', 'nonRegContribution')}
            {renderRow('Non-Reg Withdrawal', 'nonRegWithdrawal')}
            {renderRow('Savings Deposit', 'savingsDeposit')}
            {renderRow('Savings Withdrawal', 'savingsWithdrawal')}
          </>
        );

      case 'LIRA/LIF':
        return (
          <>
            {renderRow('LIF Withdrawal', 'lifWithdrawal')}
            {renderComputedRow('_computed_liraEOY', 'LIRA/LIF EOY', i => { const v = computed[i]?.accounts?.liraEOY ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_lifMin', 'LIF Min Withdrawal', i => { const v = computed[i]?.retirement?.lifMinWithdrawal ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_lifMax', 'LIF Max Withdrawal', i => { const v = computed[i]?.retirement?.lifMaxWithdrawal ?? 0; return fmtVal(v); })}
          </>
        );

      case 'RESP':
        return (
          <>
            {renderRow('RESP Contribution', 'respContribution')}
            {renderRow('RESP Withdrawal', 'respWithdrawal')}
            {renderComputedRow('_computed_respEOY', 'RESP EOY', i => { const v = computed[i]?.accounts?.respEOY ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_respCESG', 'CESG Grant', i => { const v = computed[i]?.respCESG ?? 0; return v > 0 ? '$' + Math.round(v).toLocaleString() : '—'; })}
          </>
        );

      case 'Asset Allocation':
        return (
          <>
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>RRSP Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'rrspEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'rrspFixedPct', { pct: true })}
            {renderRow('  Cash %', 'rrspCashPct', { pct: true })}
            {renderComputedRow('_computed_rrspReturn', '  Return (calc)',
              i => computed[i] ? (computed[i].accounts.rrspReturn * 100).toFixed(1) + '%' : '—'
            )}
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>TFSA Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'tfsaEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'tfsaFixedPct', { pct: true })}
            {renderRow('  Cash %', 'tfsaCashPct', { pct: true })}
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>FHSA Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'fhsaEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'fhsaFixedPct', { pct: true })}
            {renderRow('  Cash %', 'fhsaCashPct', { pct: true })}
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>Non-Reg Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'nonRegEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'nonRegFixedPct', { pct: true })}
            {renderRow('  Cash %', 'nonRegCashPct', { pct: true })}
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>LIRA Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'liraEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'liraFixedPct', { pct: true })}
            {renderRow('  Cash %', 'liraCashPct', { pct: true })}
            <tr className="bg-app-surface2/60 border-b border-app-border">
              <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[9px] text-app-text4 italic border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>RESP Alloc</td>
              {years.map((_, i) => <td key={i} />)}
            </tr>
            {renderRow('  Equity %', 'respEquityPct', { pct: true })}
            {renderRow('  Fixed %', 'respFixedPct', { pct: true })}
            {renderRow('  Cash %', 'respCashPct', { pct: true })}
          </>
        );

      case 'Capital Loss':
        return (
          <>
            {renderRow('Loss Applied', 'capitalLossApplied')}
            {renderComputedRow('_computed_capitalLossCF', 'Loss C/F Balance',
              i => computed[i] ? '$' + Math.round(computed[i].capitalLossCF).toLocaleString() : '—'
            )}
          </>
        );

      case 'ACB Tracking': {
        const acbOn = !!activeScenario?.acbConfig;
        const fmtACB = (v: number) => fmtVal(v);
        if (!acbOn) {
          return (
            <tr>
              <td className="sticky left-0 z-10 bg-app-surface2 px-2 py-1.5 text-[11px] text-app-text4 italic" colSpan={years.length + 1}>
                Enable in Settings &gt; Accounts
              </td>
            </tr>
          );
        }
        return (
          <>
            {renderComputedRow('_computed_acbOpening', 'Opening ACB', i => fmtACB(computed[i]?.acb?.openingACB ?? 0))}
            {renderComputedRow('_computed_acbAdded', 'ACB Added', i => fmtACB(computed[i]?.acb?.acbAdded ?? 0))}
            {renderComputedRow('_computed_acbRemoved', 'ACB Removed', i => fmtACB(computed[i]?.acb?.acbRemoved ?? 0))}
            {renderComputedRow('_computed_acbClosing', 'Closing ACB', i => fmtACB(computed[i]?.acb?.closingACB ?? 0))}
            {renderComputedRow('_computed_acbPerUnit', 'Per-Unit ACB', i => { const v = computed[i]?.acb?.perUnitACB ?? 0; return v > 0 ? '$' + v.toFixed(4) : '—'; })}
            {renderComputedRow('_computed_acbCG', 'Computed CG', i => {
              const v = computed[i]?.acb?.computedCapitalGain ?? 0;
              return fmtVal(v);
            })}
          </>
        );
      }

      case 'EOY Overrides':
        return (
          <>
            {renderOverrideRow('rrspEOYOverride', 'RRSP Override')}
            {renderOverrideRow('tfsaEOYOverride', 'TFSA Override')}
            {renderOverrideRow('fhsaEOYOverride', 'FHSA Override')}
            {renderOverrideRow('nonRegEOYOverride', 'NONREG Override')}
            {renderOverrideRow('savingsEOYOverride', 'SAVINGS Override')}
            {renderOverrideRow('liraEOYOverride', 'LIRA Override')}
            {renderOverrideRow('respEOYOverride', 'RESP Override')}
          </>
        );

      case 'Retirement (Computed)':
        return (
          <>
            {renderComputedRow('_computed_age', 'Age', i => { const v = computed[i]?.retirement?.age ?? null; return v !== null ? String(v) : '—'; })}
            {renderComputedRow('_computed_cppIncome', 'CPP Benefit Income', i => { const v = computed[i]?.retirement?.cppIncome ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_oasIncome', 'OAS Income', i => { const v = computed[i]?.retirement?.oasIncome ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_gisIncome', 'GIS Income', i => { const v = computed[i]?.retirement?.gisIncome ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_rrifStatus', 'RRIF Status', i => computed[i]?.retirement?.isRRIF ? 'RRIF' : 'RRSP')}
            {renderComputedRow('_computed_rrifMin', 'RRIF Min Withdrawal', i => { const v = computed[i]?.retirement?.rrifMinWithdrawal ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_hbpBalance', 'HBP Balance', i => { const v = computed[i]?.hbpBalance ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_hbpRepayReq', 'HBP Repay Required', i => { const v = computed[i]?.hbpRepaymentRequired ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_hbpShortfall', 'HBP Shortfall (Taxable)', i => { const v = computed[i]?.hbpTaxableShortfall ?? 0; return v > 0 ? '$' + Math.round(v).toLocaleString() : '—'; })}
          </>
        );

      case 'Rate Overrides':
        return (
          <>
            {renderOverrideRow('inflationRateOverride', 'Inflation Rate', true)}
            {renderOverrideRow('equityReturnOverride', 'Equity Return', true)}
            {renderOverrideRow('fixedIncomeReturnOverride', 'Fixed Income Return', true)}
            {renderOverrideRow('cashReturnOverride', 'Cash Return', true)}
            {renderOverrideRow('savingsReturnOverride', 'Savings Return', true)}
          </>
        );

      case 'Liabilities (Computed)':
        return (
          <>
            {renderComputedRow('_computed_totalDebt', 'Total Debt', i => { const v = computed[i]?.totalDebt ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_debtPayment', 'Debt Payment', i => { const v = computed[i]?.totalDebtPayment ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_interestPaid', 'Interest Paid', i => { const v = computed[i]?.totalInterestPaid ?? 0; return fmtVal(v); })}
          </>
        );

      case 'Contribution Room':
        return (
          <>
            {renderComputedRow('_computed_rrspRoom', 'RRSP Unused Room', i => { const v = computed[i]?.rrspUnusedRoom ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_tfsaRoom', 'TFSA Unused Room', i => { const v = computed[i]?.tfsaUnusedRoom ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_fhsaRoom', 'FHSA Unused Room', i => { const v = computed[i]?.fhsaUnusedRoom ?? 0; return fmtVal(v); })}
            {renderComputedRow('_computed_clCF', 'Capital Loss C/F', i => { const v = computed[i]?.capitalLossCF ?? 0; return fmtVal(v); })}
          </>
        );

      case 'Tax Results (Computed)': {
        const taxRows = [
          { rowId: '_computed_netTaxable', label: 'Net Taxable Income', fn: (i: number) => computed[i]?.tax.netTaxableIncome ?? 0, cls: 'text-app-text2' },
          { rowId: '_computed_fedTax', label: 'Federal Tax', fn: (i: number) => computed[i]?.tax.federalTaxPayable ?? 0, cls: 'text-red-600' },
          { rowId: '_computed_provTax', label: 'Provincial Tax', fn: (i: number) => computed[i]?.tax.provincialTaxPayable ?? 0, cls: 'text-red-600' },
          { rowId: '_computed_cppPaid', label: 'CPP Paid', fn: (i: number) => computed[i]?.cpp.totalCPPPaid ?? 0, cls: 'text-amber-600' },
          { rowId: '_computed_eiPaid', label: 'EI Paid', fn: (i: number) => computed[i]?.ei.totalEI ?? 0, cls: 'text-amber-600' },
          { rowId: '_computed_afterTax', label: 'After-Tax Income', fn: (i: number) => computed[i]?.waterfall.afterTaxIncome ?? 0, cls: 'text-emerald-600' },
          { rowId: '_computed_netCash', label: 'Net Cash Flow', fn: (i: number) => computed[i]?.waterfall.netCashFlow ?? 0 },
          { rowId: '_computed_netWorth', label: 'Net Worth (EOY)', fn: (i: number) => computed[i]?.accounts.netWorth ?? 0, cls: 'text-app-accent' },
        ];
        return (
          <>
            {taxRows.map(({ rowId, label, fn, cls }) => (
              <tr key={rowId} className="border-b border-app-border">
                <td className="sticky left-0 bg-app-surface z-10 py-0.5 pl-3 pr-2 text-[10px] text-app-text3 whitespace-nowrap border-r border-app-border" style={{ minWidth: LABEL_WIDTH }}>{label}</td>
                {years.map((_, i) => {
                  const v = fn(i);
                  const color = cls ?? (v >= 0 ? 'text-emerald-600' : 'text-red-600');
                  const focused = grid.isFocused(rowId, i);
                  const selected = grid.isSelected(rowId, i);
                  return (
                    <td
                      key={i}
                      className={`py-0.5 px-0.5 text-right text-[10px] font-medium ${color} rounded ${focused ? 'ring-2 ring-app-accent ring-inset' : ''} ${selected && !focused ? 'bg-app-accent-light' : ''}`}
                      data-row={rowId}
                      data-col={i}
                      onClick={(e) => onCellClick(rowId, i, e.shiftKey)}
                    >
                      {fmtVal(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </>
        );
      }

      default:
        return null;
    }
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div
      ref={tableRef}
      className="h-full overflow-auto bg-app-surface outline-none"
      tabIndex={0}
      onKeyDown={grid.handleKeyDown}
      onMouseDown={handleTableMouseDown}
      onMouseMove={handleTableMouseMove}
      onMouseUp={handleTableMouseUp}
    >
      {/* Toolbar */}
      <div
        className="sticky top-0 z-40 bg-app-accent-light border-b border-app-border px-3 py-1 text-[10px] text-app-accent flex items-center justify-between gap-3"
      >
        <span className="overflow-hidden whitespace-nowrap text-ellipsis">
          Click/drag to select · <kbd className="bg-app-surface border border-app-border rounded px-0.5">↑↓←→</kbd> navigate · <kbd className="bg-app-surface border border-app-border rounded px-0.5">Enter</kbd> edit · <kbd className="bg-app-surface border border-app-border rounded px-0.5">Shift</kbd>+click/arrow range · <kbd className="bg-app-surface border border-app-border rounded px-0.5">Ctrl+C</kbd>/<kbd className="bg-app-surface border border-app-border rounded px-0.5">X</kbd>/<kbd className="bg-app-surface border border-app-border rounded px-0.5">V</kbd> copy/cut/paste · <kbd className="bg-app-surface border border-app-border rounded px-0.5">Ctrl+Z</kbd>/<kbd className="bg-app-surface border border-app-border rounded px-0.5">Y</kbd> undo/redo · <kbd className="bg-app-surface border border-app-border rounded px-0.5">Ctrl+A</kbd> select all
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="w-5 h-5 flex items-center justify-center rounded border border-app-border bg-app-surface text-app-accent hover:bg-app-accent-light disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
              title="Undo (Ctrl+Z)"
            >↶</button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="w-5 h-5 flex items-center justify-center rounded border border-app-border bg-app-surface text-app-accent hover:bg-app-accent-light disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
              title="Redo (Ctrl+Y)"
            >↷</button>
          </div>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={banding}
              onChange={e => setBanding(e.target.checked)}
              className="accent-[var(--app-accent)] w-3 h-3"
            />
            <span className="text-[10px] text-app-accent">Banding</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={longNumbers}
              onChange={e => setLongNumbers(e.target.checked)}
              className="accent-[var(--app-accent)] w-3 h-3"
            />
            <span className="text-[10px] text-app-accent">Full $</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
              className="w-5 h-5 flex items-center justify-center rounded border border-app-border bg-app-surface text-app-accent hover:bg-app-accent-light disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
              title="Zoom out"
            >−</button>
            <span className="text-[10px] text-app-accent w-8 text-center font-medium tabular-nums">{zoomPct}%</span>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="w-5 h-5 flex items-center justify-center rounded border border-app-border bg-app-surface text-app-accent hover:bg-app-accent-light disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
              title="Zoom in"
            >+</button>
          </div>
          <button
            onClick={() => {
              if (computed.length > 0 && years.length > 0) {
                const csv = buildTimelineCSV(computed, years);
                const name = activeScenario?.name ?? 'scenario';
                downloadCSV(csv, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_timeline.csv`);
              }
            }}
            className="px-2 py-0.5 rounded border border-app-border bg-app-surface text-app-accent hover:bg-app-accent-light text-[10px] font-medium"
            title="Export timeline as CSV"
          >CSV</button>
        </div>
      </div>
      <div style={{ zoom }}>
        <table className="w-full text-xs border-collapse" style={{ minWidth: LABEL_WIDTH + years.length * YEAR_WIDTH }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-app-surface2 border-b border-app-border">
              <th
                className="sticky left-0 bg-app-surface2 z-40 py-2 pl-3 pr-2 text-left text-[10px] text-app-text3 font-semibold uppercase tracking-wide border-r border-app-border"
                style={{ minWidth: LABEL_WIDTH }}
              >
                Row
              </th>
              {years.map((yd, i) => {
                const cy = computed[i];
                const age = cy?.retirement?.age ?? null;
                // Detect retirement events
                const events: { label: string; color: string }[] = [];
                if (cy && i > 0) {
                  const prev = computed[i - 1];
                  if (cy.retirement.cppIncome > 0 && (!prev || prev.retirement.cppIncome === 0)) events.push({ label: 'CPP', color: 'bg-blue-500' });
                  if (cy.retirement.oasIncome > 0 && (!prev || prev.retirement.oasIncome === 0)) events.push({ label: 'OAS', color: 'bg-green-500' });
                  if (cy.retirement.isRRIF && (!prev || !prev.retirement.isRRIF)) events.push({ label: 'RRIF', color: 'bg-amber-500' });
                  if (cy.retirement.isLIF && (!prev || !prev.retirement.isLIF)) events.push({ label: 'LIF', color: 'bg-purple-500' });
                } else if (cy && i === 0) {
                  if (cy.retirement.cppIncome > 0) events.push({ label: 'CPP', color: 'bg-blue-500' });
                  if (cy.retirement.oasIncome > 0) events.push({ label: 'OAS', color: 'bg-green-500' });
                  if (cy.retirement.isRRIF) events.push({ label: 'RRIF', color: 'bg-amber-500' });
                  if (cy.retirement.isLIF) events.push({ label: 'LIF', color: 'bg-purple-500' });
                }
                return (
                  <th
                    key={yd.year}
                    className="py-1 px-0.5 text-center text-[10px] font-semibold text-app-text2"
                    style={{ minWidth: YEAR_WIDTH }}
                  >
                    <div>{yd.year}</div>
                    {age !== null && <div className="text-[8px] font-normal text-app-text4">Age {age}</div>}
                    {events.length > 0 && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        {events.map(ev => (
                          <span key={ev.label} className={`${ev.color} text-white text-[7px] px-1 py-px rounded-sm leading-none font-bold`}>{ev.label}</span>
                        ))}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groupOrder.map(title => (
              <RowGroup
                key={title}
                title={title}
                open={openGroups[title]}
                onToggle={() => toggleGroup(title)}
                {...dragProps(title)}
              >
                {renderGroupContent(title)}
              </RowGroup>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
