import React, { useState, useRef } from 'react';
import { useScenario } from '../../store/ScenarioContext';
import { makeDefaultScenario } from '../../store/defaults';

interface Props {
  onCompare: () => void;
}

export function TopBar({ onCompare }: Props) {
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
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      {/* App title */}
      <div className="flex items-center gap-2 mr-4 shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-600" />
        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">CDN Tax & Investment Model</span>
      </div>

      {/* Scenario tabs */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {state.scenarios.map(sc => (
          <div
            key={sc.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm cursor-pointer shrink-0 border transition-colors ${
              sc.id === state.activeId
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            onClick={() => dispatch({ type: 'SET_ACTIVE', id: sc.id })}
            onDoubleClick={() => startRename(sc.id, sc.name)}
          >
            {editingId === sc.id ? (
              <input
                ref={inputRef}
                className="bg-white border border-blue-400 text-slate-800 rounded px-1 py-0 text-sm outline-none w-28"
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
                className="ml-1 text-slate-400 hover:text-red-500 leading-none transition-colors"
                onClick={e => { e.stopPropagation(); deleteScenario(sc.id); }}
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={addScenario}
          className="px-3 py-1.5 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >+ New</button>
        <button
          onClick={duplicateActive}
          className="px-3 py-1.5 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >Duplicate</button>
        <button
          onClick={onCompare}
          disabled={state.scenarios.length < 2}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            state.scenarios.length >= 2
              ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >Compare</button>
      </div>
    </div>
  );
}
