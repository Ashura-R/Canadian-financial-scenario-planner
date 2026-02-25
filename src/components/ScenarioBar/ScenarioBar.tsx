import React, { useState, useRef } from 'react';
import { useScenario } from '../../store/ScenarioContext';
import { makeDefaultScenario } from '../../store/defaults';

interface Props {
  onCompare: () => void;
}

const btnCls = "px-2.5 py-1 text-[11px] rounded-md border border-slate-200/80 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors";

export function ScenarioBar({ onCompare }: Props) {
  const { state, dispatch } = useScenario();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function commitRename() {
    if (editingId && editName.trim()) {
      dispatch({ type: 'RENAME_SCENARIO', id: editingId, name: editName.trim() });
    }
    setEditingId(null);
  }

  function addScenario() {
    const n = state.scenarios.length + 1;
    dispatch({ type: 'ADD_SCENARIO', scenario: makeDefaultScenario(`Scenario ${n}`) });
  }

  function duplicateActive() {
    if (state.activeId) dispatch({ type: 'DUPLICATE_SCENARIO', id: state.activeId });
  }

  function deleteScenario(id: string) {
    if (state.scenarios.length <= 1) return;
    dispatch({ type: 'DELETE_SCENARIO', id });
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-slate-100/80 border-b border-slate-200 shrink-0">
      {/* Scenario tabs + action buttons — centered as a group */}
      <div className="flex items-center gap-1.5">
        {state.scenarios.map(sc => {
          const active = sc.id === state.activeId;
          return (
            <div
              key={sc.id}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-[12px] cursor-pointer shrink-0 border transition-colors ${
                active
                  ? 'bg-slate-50 border-slate-300 text-slate-800 font-medium'
                  : 'bg-white border-slate-200/80 text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
              onClick={() => dispatch({ type: 'SET_ACTIVE', id: sc.id })}
              onDoubleClick={() => startRename(sc.id, sc.name)}
            >
              {editingId === sc.id ? (
                <input
                  ref={inputRef}
                  className="bg-white border border-blue-400 text-slate-800 rounded px-1 py-0 text-[12px] outline-none w-24"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span>{sc.name}</span>
              )}
              {state.scenarios.length > 1 && (
                <button
                  className="ml-0.5 leading-none transition-colors text-[11px] text-slate-300 hover:text-red-500"
                  onClick={e => { e.stopPropagation(); deleteScenario(sc.id); }}
                >×</button>
              )}
            </div>
          );
        })}

        {/* Separator */}
        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Action buttons — same style family */}
        <button onClick={addScenario} className={btnCls}>+ New</button>
        <button onClick={duplicateActive} className={btnCls}>Duplicate</button>
        <button onClick={onCompare} className={btnCls}>Compare</button>
      </div>
    </div>
  );
}
