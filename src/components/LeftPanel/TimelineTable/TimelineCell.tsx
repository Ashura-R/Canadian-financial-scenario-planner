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
}

export function TimelineCell({ value, onChange, readOnly, pct, hasWarning, hasOverride, dimmed, onNext }: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function fmt(v: number) {
    if (pct) return (v * 100).toFixed(0) + '%';
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
    if (v === 0) return '—';
    return '$' + v.toLocaleString('en-CA', { maximumFractionDigits: 0 });
  }

  function startEdit() {
    if (readOnly) return;
    setEditing(true);
    setRaw(pct ? (value * 100).toFixed(0) : String(Math.round(value)));
  }

  function commit() {
    const n = parseFloat(raw.replace(/[$,%\s,]/g, ''));
    if (!isNaN(n)) onChange(pct ? n / 100 : n);
    setEditing(false);
  }

  const baseCls = [
    'w-full text-right text-[10px] px-1 py-px rounded transition-colors select-none',
    readOnly ? 'cursor-default' : 'cursor-pointer',
    dimmed ? 'text-slate-400' : 'text-slate-700',
    hasWarning ? 'bg-red-50 text-red-600' : '',
    hasOverride && !hasWarning ? 'bg-blue-50' : '',
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
    <div className={baseCls} onClick={startEdit} title={hasWarning ? '⚠ Validation warning' : hasOverride ? 'EOY Override active' : undefined}>
      {hasWarning && <span className="mr-0.5 text-red-500">!</span>}
      {hasOverride && !hasWarning && <span className="mr-0.5 text-blue-500">↗</span>}
      {fmt(value)}
    </div>
  );
}
