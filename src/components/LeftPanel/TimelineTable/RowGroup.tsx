import React, { useState } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function RowGroup({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <tr
        className="cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors border-y border-slate-200"
        onClick={() => setOpen(o => !o)}
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
