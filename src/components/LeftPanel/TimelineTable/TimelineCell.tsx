import React, { useState, useRef, useEffect } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  pct?: boolean;
  hasWarning?: boolean;
  hasOverride?: boolean;
  dimmed?: boolean;
  onNext?: () => void;
  scheduledValue?: number;
  // Grid navigation props
  isFocused?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  initialEditKey?: string | null;
  onCellClick?: (shiftKey: boolean) => void;
  onCellDblClick?: () => void;
  onEditCommit?: (direction: 'down' | 'right', value?: number) => void;
  onEditCancel?: () => void;
}

export const TimelineCell = React.memo(function TimelineCell({
  value, onChange, readOnly, pct, hasWarning, hasOverride, dimmed,
  onNext, scheduledValue,
  isFocused, isSelected, isEditing, initialEditKey,
  onCellClick, onCellDblClick, onEditCommit, onEditCancel,
}: Props) {
  const [localEditing, setLocalEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  // Determine if we're in grid-nav mode (parent controls editing) or legacy mode
  const gridMode = onCellClick !== undefined;
  const editing = gridMode ? (isEditing ?? false) : localEditing;

  const hasSchedule = scheduledValue !== undefined && scheduledValue !== 0;
  const isScheduleFilling = hasSchedule && value === 0;
  const isUserOverride = hasSchedule && value !== 0;
  const displayValue = isScheduleFilling ? scheduledValue : value;

  // When parent-controlled editing starts, populate raw and focus
  useEffect(() => {
    if (gridMode && isEditing) {
      committedRef.current = false;
      if (initialEditKey) {
        setRaw(initialEditKey);
      } else {
        const editVal = isScheduleFilling ? scheduledValue : value;
        setRaw(pct ? (editVal * 100).toFixed(0) : String(Math.round(editVal)));
      }
      // Focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing, gridMode]);

  // Legacy mode: select on local edit start
  useEffect(() => {
    if (!gridMode && localEditing) inputRef.current?.select();
  }, [localEditing, gridMode]);

  function fmt(v: number) {
    if (pct) return (v * 100).toFixed(0) + '%';
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
    if (v === 0) return '—';
    return '$' + v.toLocaleString('en-CA', { maximumFractionDigits: 0 });
  }

  function startEdit() {
    if (readOnly) return;
    setLocalEditing(true);
    const editVal = isScheduleFilling ? scheduledValue : value;
    setRaw(pct ? (editVal * 100).toFixed(0) : String(Math.round(editVal)));
  }

  /** Parse and apply the edit, returning the final numeric value (or undefined if invalid) */
  function commit(): number | undefined {
    const n = parseFloat(raw.replace(/[$,%\s,]/g, ''));
    if (!isNaN(n)) {
      const final = pct ? n / 100 : n;
      onChange(final);
      if (!gridMode) setLocalEditing(false);
      return final;
    }
    if (!gridMode) setLocalEditing(false);
    return undefined;
  }

  function undoOverride(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(0);
  }

  function handleClick(e: React.MouseEvent) {
    if (gridMode) {
      onCellClick?.(e.shiftKey);
    } else {
      startEdit();
    }
  }

  function handleDblClick() {
    if (gridMode) {
      onCellDblClick?.();
    }
  }

  const baseCls = [
    'w-full text-right text-[10px] px-1 py-px rounded transition-colors select-none relative group',
    readOnly ? 'cursor-default' : 'cursor-pointer',
    isScheduleFilling ? 'text-blue-600' : isUserOverride ? 'text-slate-900 font-medium' : dimmed ? 'text-slate-400' : 'text-slate-700',
    hasWarning ? 'bg-red-50 text-red-600' : '',
    hasOverride && !hasWarning ? 'bg-blue-50' : '',
    isScheduleFilling && !hasWarning ? 'bg-blue-50/40' : '',
    !readOnly && !hasWarning ? 'hover:bg-slate-100' : '',
    // Grid navigation visual styles
    isFocused ? 'ring-2 ring-blue-500 ring-inset !rounded' : '',
    isSelected && !isFocused ? 'bg-blue-100' : '',
  ].join(' ');

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full text-right text-[10px] px-1 py-px bg-blue-50 border border-blue-400 rounded outline-none text-slate-800"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => {
          if (gridMode) {
            if (!committedRef.current) {
              committedRef.current = true;
              const val = commit();
              onEditCommit?.('down', val);
            }
          } else {
            commit();
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (gridMode) {
              committedRef.current = true;
              const val = commit();
              onEditCommit?.('down', val);
            } else {
              commit();
              onNext?.();
            }
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            if (gridMode) {
              committedRef.current = true;
              const val = commit();
              onEditCommit?.('right', val);
            } else {
              commit();
              onNext?.();
            }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            if (gridMode) {
              committedRef.current = true;
              onEditCancel?.();
            } else {
              setLocalEditing(false);
            }
          }
        }}
      />
    );
  }

  return (
    <div
      className={baseCls}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      title={
        hasWarning ? '⚠ Validation warning'
        : isScheduleFilling ? '⚡ From schedule rule — click to override'
        : isUserOverride ? '✎ Manual override — click ✕ to revert to schedule'
        : hasOverride ? 'EOY Override active'
        : undefined
      }
    >
      {hasWarning && <span className="mr-0.5 text-red-500">!</span>}
      {hasOverride && !hasWarning && !isUserOverride && <span className="mr-0.5 text-blue-500">↗</span>}
      {isScheduleFilling && !hasWarning && <span className="mr-0.5 text-blue-400">⚡</span>}
      {fmt(displayValue)}
      {isUserOverride && !readOnly && (
        <button
          className="absolute -top-0.5 -right-0.5 hidden group-hover:flex items-center justify-center w-3 h-3 rounded-full bg-slate-400 hover:bg-red-500 text-white text-[7px] leading-none transition-colors"
          onClick={undoOverride}
          title="Revert to schedule value"
        >
          ×
        </button>
      )}
    </div>
  );
});
