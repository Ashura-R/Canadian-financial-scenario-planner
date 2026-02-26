import React, { useState, useRef } from 'react';

const STORAGE_KEY = 'cdn-tax-rowgroup-state';

export function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveGroupState(id: string, open: boolean) {
  try {
    const state = loadGroupState();
    state[id] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  draggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function RowGroup({
  title, defaultOpen = true, children,
  open: controlledOpen, onToggle,
  draggable: isDraggable, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const didDragRef = useRef(false);

  const [internalOpen, setInternalOpen] = useState(() => {
    const saved = loadGroupState();
    return saved[title] !== undefined ? saved[title] : defaultOpen;
  });

  const open = isControlled ? controlledOpen : internalOpen;

  function toggle() {
    // Suppress click after drag
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen(o => {
        const next = !o;
        saveGroupState(title, next);
        return next;
      });
    }
  }

  function handleDragStart(e: React.DragEvent) {
    didDragRef.current = true;
    onDragStart?.(e);
  }

  function handleDragEnd(e: React.DragEvent) {
    onDragEnd?.(e);
    // Keep didDragRef true — the click event fires after dragEnd
    // It will be reset in toggle()
  }

  return (
    <>
      <tr
        className={`cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors border-y border-slate-200 ${isDragOver ? 'border-t-2 border-t-blue-500' : ''}`}
        onClick={toggle}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={handleDragEnd}
      >
        <td colSpan={999} className="py-0 px-0 text-[10px] font-semibold text-slate-500 uppercase tracking-wider relative">
          <div className="sticky left-0 inline-flex items-center gap-1.5 py-1.5 px-3 bg-inherit">
            {isDraggable && (
              <span
                className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing text-[9px] leading-none"
                title="Drag to reorder"
              >⠿</span>
            )}
            <span className="text-slate-400">{open ? '▼' : '▶'}</span>
            {title}
          </div>
        </td>
      </tr>
      {open && children}
    </>
  );
}
