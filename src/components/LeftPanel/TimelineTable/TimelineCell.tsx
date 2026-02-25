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
  scheduledValue?: number; // value from a schedule rule (shown in blue when raw is 0)
}

export function TimelineCell({ value, onChange, readOnly, pct, hasWarning, hasOverride, dimmed, onNext, scheduledValue }: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const hasSchedule = scheduledValue !== undefined && scheduledValue !== 0;
  const isScheduleFilling = hasSchedule && value === 0;
  const isUserOverride = hasSchedule && value !== 0;
  const displayValue = isScheduleFilling ? scheduledValue : value;

  function fmt(v: number) {
    if (pct) return (v * 100).toFixed(0) + '%';
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
    if (v === 0) return '—';
    return '$' + v.toLocaleString('en-CA', { maximumFractionDigits: 0 });
  }

  function startEdit() {
    if (readOnly) return;
    setEditing(true);
    const editVal = isScheduleFilling ? scheduledValue : value;
    setRaw(pct ? (editVal * 100).toFixed(0) : String(Math.round(editVal)));
  }

  function commit() {
    const n = parseFloat(raw.replace(/[$,%\s,]/g, ''));
    if (!isNaN(n)) onChange(pct ? n / 100 : n);
    setEditing(false);
  }

  function undoOverride(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(0);
  }

  const baseCls = [
    'w-full text-right text-[10px] px-1 py-px rounded transition-colors select-none relative group',
    readOnly ? 'cursor-default' : 'cursor-pointer',
    isScheduleFilling ? 'text-blue-600' : isUserOverride ? 'text-slate-900 font-medium' : dimmed ? 'text-slate-400' : 'text-slate-700',
    hasWarning ? 'bg-red-50 text-red-600' : '',
    hasOverride && !hasWarning ? 'bg-blue-50' : '',
    isScheduleFilling && !hasWarning ? 'bg-blue-50/40' : '',
    !readOnly && !hasWarning ? 'hover:bg-slate-100' : '',
  ].join(' ');

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full text-right text-[10px] px-1 py-px bg-blue-50 border border-blue-400 rounded outline-none text-slate-800"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit(); onNext?.(); }
          if (e.key === 'Tab') { e.preventDefault(); commit(); onNext?.(); }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={baseCls} onClick={startEdit} title={
      hasWarning ? '⚠ Validation warning'
      : isScheduleFilling ? '⚡ From schedule rule — click to override'
      : isUserOverride ? '✎ Manual override — click ✕ to revert to schedule'
      : hasOverride ? 'EOY Override active'
      : undefined
    }>
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
}
