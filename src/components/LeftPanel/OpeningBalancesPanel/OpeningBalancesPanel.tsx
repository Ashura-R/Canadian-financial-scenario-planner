import React from 'react';
import { useScenario, useUpdateScenario } from '../../../store/ScenarioContext';
import { formatCAD } from '../../../utils/formatters';

interface BalanceRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function BalanceRow({ label, value, onChange }: BalanceRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState('');

  function start() {
    setEditing(true);
    setRaw(String(value));
  }

  function commit() {
    const n = parseFloat(raw.replace(/[$,\s]/g, ''));
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-app-border last:border-0">
      <span className="text-xs text-app-text3">{label}</span>
      {editing ? (
        <input
          autoFocus
          className="w-28 text-right text-xs bg-app-surface2 border border-app-accent rounded px-2 py-0.5 text-app-text outline-none"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <span
          className="text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors"
          onClick={start}
          title="Click to edit"
        >
          {formatCAD(value)}
        </span>
      )}
    </div>
  );
}

export function OpeningBalancesPanel() {
  const { activeScenario } = useScenario();
  const update = useUpdateScenario();

  if (!activeScenario) return null;
  const ob = activeScenario.openingBalances;

  function setBalance(key: keyof typeof ob, val: number) {
    update(s => ({ ...s, openingBalances: { ...s.openingBalances, [key]: val } }));
  }

  return (
    <div className="bg-app-surface border border-app-border rounded-lg">
      <div className="px-3 py-2 border-b border-app-border">
        <h3 className="text-xs font-semibold text-app-text uppercase tracking-wider">Opening Balances</h3>
      </div>
      <div className="px-3 py-1">
        <BalanceRow label="RRSP" value={ob.rrsp} onChange={v => setBalance('rrsp', v)} />
        <BalanceRow label="TFSA" value={ob.tfsa} onChange={v => setBalance('tfsa', v)} />
        <BalanceRow label="FHSA" value={ob.fhsa} onChange={v => setBalance('fhsa', v)} />
        <BalanceRow label="Non-Registered" value={ob.nonReg} onChange={v => setBalance('nonReg', v)} />
        <BalanceRow label="Savings" value={ob.savings} onChange={v => setBalance('savings', v)} />
      </div>
    </div>
  );
}
