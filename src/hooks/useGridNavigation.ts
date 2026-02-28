import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface CellCoord {
  rowId: string;
  col: number;
}

export interface NavRow {
  rowId: string;
  editable: boolean;
  group: string;
}

function cellKey(rowId: string, col: number): string {
  return `${rowId}:${col}`;
}

function buildSelectedSet(
  anchor: CellCoord | null,
  focus: CellCoord | null,
  activeRows: NavRow[]
): Set<string> {
  if (!anchor || !focus) return new Set();
  if (anchor.rowId === focus.rowId && anchor.col === focus.col) return new Set();
  const rowIndex = new Map<string, number>();
  activeRows.forEach((r, i) => rowIndex.set(r.rowId, i));
  const ai = rowIndex.get(anchor.rowId);
  const fi = rowIndex.get(focus.rowId);
  if (ai === undefined || fi === undefined) return new Set();
  const rMin = Math.min(ai, fi);
  const rMax = Math.max(ai, fi);
  const cMin = Math.min(anchor.col, focus.col);
  const cMax = Math.max(anchor.col, focus.col);
  const set = new Set<string>();
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      set.add(cellKey(activeRows[r].rowId, c));
    }
  }
  return set;
}

export interface GridNavigation {
  focusedCell: CellCoord | null;
  editing: boolean;
  initialKey: string | null;
  selectedCells: Set<string>;
  isDragging: React.MutableRefObject<boolean>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleCellClick: (rowId: string, col: number, shiftKey: boolean) => void;
  handleCellDblClick: (rowId: string, col: number) => void;
  handleCellMouseDown: (rowId: string, col: number, shiftKey: boolean) => void;
  handleCellMouseEnter: (rowId: string, col: number) => void;
  handleMouseUp: () => void;
  commitEdit: (direction: 'down' | 'right', committedValue?: number) => void;
  cancelEdit: () => void;
  isFocused: (rowId: string, col: number) => boolean;
  isSelected: (rowId: string, col: number) => boolean;
}

interface GridCallbacks {
  onDeleteCells?: (cells: CellCoord[]) => void;
  onMultiCellCommit?: (cellKeys: Set<string>, value: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPaste?: (text: string) => void;
}

export function useGridNavigation(
  activeRows: NavRow[],
  colCount: number,
  tableRef: React.RefObject<HTMLDivElement | null>,
  openGroups: Record<string, boolean>,
  callbacks: GridCallbacks = {}
): GridNavigation {
  const [focusedCell, setFocusedCell] = useState<CellCoord | null>(null);
  const [anchor, setAnchor] = useState<CellCoord | null>(null);
  const [editing, setEditing] = useState(false);
  const [initialKey, setInitialKey] = useState<string | null>(null);

  // Drag state (ref to avoid re-renders)
  const isDragging = useRef(false);

  // Snapshot of selected cells when editing starts (for multi-cell typing)
  const selectionAtEditStartRef = useRef<Set<string> | null>(null);

  // Refs for stable callbacks
  const activeRowsRef = useRef(activeRows);
  activeRowsRef.current = activeRows;

  const colCountRef = useRef(colCount);
  colCountRef.current = colCount;

  const editingRef = useRef(editing);
  editingRef.current = editing;

  const focusedCellRef = useRef(focusedCell);
  focusedCellRef.current = focusedCell;

  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  // Callback refs
  const onDeleteRef = useRef(callbacks.onDeleteCells);
  onDeleteRef.current = callbacks.onDeleteCells;
  const onMultiCellCommitRef = useRef(callbacks.onMultiCellCommit);
  onMultiCellCommitRef.current = callbacks.onMultiCellCommit;
  const onUndoRef = useRef(callbacks.onUndo);
  onUndoRef.current = callbacks.onUndo;
  const onRedoRef = useRef(callbacks.onRedo);
  onRedoRef.current = callbacks.onRedo;
  const onPasteRef = useRef(callbacks.onPaste);
  onPasteRef.current = callbacks.onPaste;

  // Row index lookup
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    activeRows.forEach((r, i) => m.set(r.rowId, i));
    return m;
  }, [activeRows]);

  const rowIndexRef = useRef(rowIndex);
  rowIndexRef.current = rowIndex;

  // Selected cells set
  const selectedCells = useMemo(
    () => buildSelectedSet(anchor, focusedCell, activeRows),
    [anchor, focusedCell, activeRows]
  );

  const selectedCellsRef = useRef(selectedCells);
  selectedCellsRef.current = selectedCells;

  // Clear focus if focused cell's group collapsed
  useEffect(() => {
    if (!focusedCell) return;
    const row = activeRows.find(r => r.rowId === focusedCell.rowId);
    if (!row) {
      setFocusedCell(null);
      setAnchor(null);
      setEditing(false);
      setInitialKey(null);
    }
  }, [openGroups, activeRows, focusedCell]);

  // Scroll focused cell into view
  useEffect(() => {
    if (!focusedCell || !tableRef.current) return;
    const td = tableRef.current.querySelector(
      `td[data-row="${CSS.escape(focusedCell.rowId)}"][data-col="${focusedCell.col}"]`
    );
    if (td) {
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusedCell, tableRef]);

  // Global mouseup listener so drag ends even if mouse leaves table
  useEffect(() => {
    const handler = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, []);

  // moveFocus
  const moveFocus = useCallback((rowDelta: number, colDelta: number, shift: boolean) => {
    const rows = activeRowsRef.current;
    const cols = colCountRef.current;
    const idx = rowIndexRef.current;
    const prev = focusedCellRef.current;

    if (!prev) {
      const newCell = rows.length > 0 ? { rowId: rows[0].rowId, col: 0 } : null;
      setFocusedCell(newCell);
      if (shift && newCell) {
        setAnchor(a => a ?? newCell);
      } else if (!shift) {
        setAnchor(null);
      }
      return;
    }

    const ri = idx.get(prev.rowId);
    if (ri === undefined) return;
    const newRI = Math.max(0, Math.min(rows.length - 1, ri + rowDelta));
    const newCol = Math.max(0, Math.min(cols - 1, prev.col + colDelta));
    const newCell = { rowId: rows[newRI].rowId, col: newCol };

    setFocusedCell(newCell);
    if (shift) {
      setAnchor(a => a ?? prev);
    } else {
      setAnchor(null);
    }
  }, []);

  const handleCellClick = useCallback((rowId: string, col: number, shiftKey: boolean) => {
    if (editingRef.current) return;
    const cell = { rowId, col };
    if (shiftKey) {
      setAnchor(a => a ?? focusedCellRef.current ?? cell);
      setFocusedCell(cell);
      setEditing(false);
      setInitialKey(null);
    } else {
      setFocusedCell(cell);
      setAnchor(null);
      setEditing(false);
      setInitialKey(null);
    }
  }, []);

  const handleCellDblClick = useCallback((rowId: string, col: number) => {
    const rows = activeRowsRef.current;
    const row = rows.find(r => r.rowId === rowId);
    if (!row?.editable) return;
    setFocusedCell({ rowId, col });
    setAnchor(null);
    setEditing(true);
    setInitialKey(null);
    selectionAtEditStartRef.current = null; // dblclick = single cell edit
  }, []);

  // Click-drag handlers
  const handleCellMouseDown = useCallback((rowId: string, col: number, shiftKey: boolean) => {
    if (editingRef.current) return;
    isDragging.current = true;
    const cell = { rowId, col };
    if (shiftKey) {
      setAnchor(a => a ?? focusedCellRef.current ?? cell);
      setFocusedCell(cell);
    } else {
      setFocusedCell(cell);
      setAnchor(cell); // set anchor for drag start
    }
    setEditing(false);
    setInitialKey(null);
  }, []);

  const handleCellMouseEnter = useCallback((rowId: string, col: number) => {
    if (!isDragging.current) return;
    setFocusedCell({ rowId, col });
    // anchor stays at drag start — buildSelectedSet computes rectangle
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // If anchor === focus (no drag distance), clear anchor so it's treated as single-cell
    const a = anchorRef.current;
    const f = focusedCellRef.current;
    if (a && f && a.rowId === f.rowId && a.col === f.col) {
      setAnchor(null);
    }
  }, []);

  // Helper to begin editing with selection snapshot
  const beginEditing = useCallback((key: string | null) => {
    const sc = selectedCellsRef.current;
    selectionAtEditStartRef.current = sc.size > 0 ? new Set(sc) : null;
    setEditing(true);
    setInitialKey(key);
  }, []);

  // Refocus the table container so keyboard navigation keeps working after edit
  const refocusTable = useCallback(() => {
    requestAnimationFrame(() => tableRef.current?.focus());
  }, [tableRef]);

  const commitEdit = useCallback((direction: 'down' | 'right', committedValue?: number) => {
    // Multi-cell commit: if we had a selection at edit start and have a value, apply to all
    const selSnap = selectionAtEditStartRef.current;
    if (selSnap && selSnap.size > 0 && committedValue !== undefined) {
      onMultiCellCommitRef.current?.(selSnap, committedValue);
    }
    selectionAtEditStartRef.current = null;

    setEditing(false);
    setInitialKey(null);
    if (direction === 'down') {
      moveFocus(1, 0, false);
    } else {
      const prev = focusedCellRef.current;
      if (!prev) return;
      const rows = activeRowsRef.current;
      const cols = colCountRef.current;
      const ri = rowIndexRef.current.get(prev.rowId);
      if (ri === undefined) return;
      if (prev.col < cols - 1) {
        setFocusedCell({ rowId: prev.rowId, col: prev.col + 1 });
      } else if (ri < rows.length - 1) {
        setFocusedCell({ rowId: rows[ri + 1].rowId, col: 0 });
      }
      setAnchor(null);
    }
    refocusTable();
  }, [moveFocus, refocusTable]);

  const cancelEdit = useCallback(() => {
    selectionAtEditStartRef.current = null;
    setEditing(false);
    setInitialKey(null);
    refocusTable();
  }, [refocusTable]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingRef.current) return;

    const rows = activeRowsRef.current;
    const idx = rowIndexRef.current;
    const fc = focusedCellRef.current;
    const sc = selectedCellsRef.current;
    const anch = anchorRef.current;
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl combos
    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case 'z': {
          e.preventDefault();
          if (e.shiftKey) {
            onRedoRef.current?.();
          } else {
            onUndoRef.current?.();
          }
          return;
        }
        case 'y': {
          e.preventDefault();
          onRedoRef.current?.();
          return;
        }
        case 'c': {
          e.preventDefault();
          if (fc) copySelection(rows, idx, fc, anch, sc, colCountRef.current);
          return;
        }
        case 'x': {
          e.preventDefault();
          if (fc) {
            copySelection(rows, idx, fc, anch, sc, colCountRef.current);
            // Delete selected cells
            const cells: CellCoord[] = [];
            if (sc.size > 0) {
              for (const key of sc) {
                const [rowId, colStr] = key.split(':');
                const col = Number(colStr);
                const r = rows.find(rr => rr.rowId === rowId);
                if (r?.editable) cells.push({ rowId, col });
              }
            } else {
              const r = rows.find(rr => rr.rowId === fc.rowId);
              if (r?.editable) cells.push(fc);
            }
            if (cells.length > 0) onDeleteRef.current?.(cells);
          }
          return;
        }
        case 'v': {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            onPasteRef.current?.(text);
          }).catch(() => {});
          return;
        }
        case 'a': {
          e.preventDefault();
          if (rows.length > 0) {
            const cols = colCountRef.current;
            setAnchor({ rowId: rows[0].rowId, col: 0 });
            setFocusedCell({ rowId: rows[rows.length - 1].rowId, col: cols - 1 });
          }
          return;
        }
      }
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1, 0, e.shiftKey);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1, 0, e.shiftKey);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(0, -1, e.shiftKey);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(0, 1, e.shiftKey);
        break;
      case 'Tab': {
        e.preventDefault();
        if (!fc) break;
        const ri = idx.get(fc.rowId);
        if (ri === undefined) break;
        const cols = colCountRef.current;
        if (e.shiftKey) {
          if (fc.col > 0) {
            setFocusedCell({ rowId: fc.rowId, col: fc.col - 1 });
          } else if (ri > 0) {
            setFocusedCell({ rowId: rows[ri - 1].rowId, col: cols - 1 });
          }
        } else {
          if (fc.col < cols - 1) {
            setFocusedCell({ rowId: fc.rowId, col: fc.col + 1 });
          } else if (ri < rows.length - 1) {
            setFocusedCell({ rowId: rows[ri + 1].rowId, col: 0 });
          }
        }
        setAnchor(null);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (!fc) break;
        const row = rows.find(r => r.rowId === fc.rowId);
        if (row?.editable) {
          beginEditing(null);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        setFocusedCell(null);
        setAnchor(null);
        setInitialKey(null);
        break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        if (!fc) break;
        const cells: CellCoord[] = [];
        if (sc.size > 0) {
          for (const key of sc) {
            const [rowId, colStr] = key.split(':');
            const col = Number(colStr);
            const r = rows.find(rr => rr.rowId === rowId);
            if (r?.editable) cells.push({ rowId, col });
          }
        } else {
          const r = rows.find(rr => rr.rowId === fc.rowId);
          if (r?.editable) cells.push(fc);
        }
        if (cells.length > 0) onDeleteRef.current?.(cells);
        break;
      }
      default: {
        // Printable character → type-to-edit
        if (
          e.key.length === 1 &&
          !ctrl &&
          !e.altKey &&
          fc
        ) {
          const row = rows.find(r => r.rowId === fc.rowId);
          if (row?.editable) {
            e.preventDefault();
            beginEditing(e.key);
          }
        }
        break;
      }
    }
  }, [moveFocus, beginEditing]);

  const isFocused = useCallback(
    (rowId: string, col: number) =>
      focusedCell?.rowId === rowId && focusedCell?.col === col,
    [focusedCell]
  );

  const isSelected = useCallback(
    (rowId: string, col: number) => selectedCells.has(cellKey(rowId, col)),
    [selectedCells]
  );

  return {
    focusedCell,
    editing,
    initialKey,
    selectedCells,
    isDragging,
    handleKeyDown,
    handleCellClick,
    handleCellDblClick,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
    commitEdit,
    cancelEdit,
    isFocused,
    isSelected,
  };
}

function copySelection(
  rows: NavRow[],
  rowIndex: Map<string, number>,
  focus: CellCoord,
  anchor: CellCoord | null,
  selectedCells: Set<string>,
  _colCount: number
) {
  const a = anchor ?? focus;
  const ai = rowIndex.get(a.rowId) ?? 0;
  const fi = rowIndex.get(focus.rowId) ?? 0;
  const rMin = Math.min(ai, fi);
  const rMax = Math.max(ai, fi);
  const cMin = Math.min(a.col, focus.col);
  const cMax = Math.max(a.col, focus.col);

  const lines: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    const cols: string[] = [];
    for (let c = cMin; c <= cMax; c++) {
      const el = document.querySelector(
        `td[data-row="${CSS.escape(rows[r].rowId)}"][data-col="${c}"]`
      );
      cols.push(el?.textContent?.trim() ?? '');
    }
    lines.push(cols.join('\t'));
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).catch(() => {});
}
