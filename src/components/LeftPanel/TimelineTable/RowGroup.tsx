import React, { useState } from 'react';

const STORAGE_KEY = 'cdn-tax-rowgroup-state';

function loadGroupState(): Record<string, boolean> {
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
}

export function RowGroup({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(() => {
    const saved = loadGroupState();
    return saved[title] !== undefined ? saved[title] : defaultOpen;
  });

  function toggle() {
    setOpen(o => {
      const next = !o;
      saveGroupState(title, next);
      return next;
    });
  }

  return (
    <>
      <tr
        className="cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors border-y border-slate-200"
        onClick={toggle}
      >
        <td colSpan={999} className="py-1.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          <span className="mr-1.5 text-slate-400">{open ? '▼' : '▶'}</span>
          {title}
        </td>
      </tr>
      {open && children}
    </>
  );
}
