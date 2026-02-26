import React, { useState } from 'react';
import type { Scenario } from '../types/scenario';
import type { ComputedScenario } from '../types/computed';
import { generatePDFReport, type PDFSections } from '../utils/pdfReport';

interface Props {
  scenario: Scenario;
  computed: ComputedScenario;
  onClose: () => void;
}

const SECTION_LABELS: { key: keyof PDFSections; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'taxDetail', label: 'Tax Detail' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'settings', label: 'Settings' },
];

const allTrue = (): PDFSections => ({
  overview: true, taxDetail: true, accounts: true,
  timeline: true, scheduling: true, analysis: true, settings: true,
});

const allFalse = (): PDFSections => ({
  overview: false, taxDetail: false, accounts: false,
  timeline: false, scheduling: false, analysis: false, settings: false,
});

export function PDFReportModal({ scenario, computed, onClose }: Props) {
  const [sections, setSections] = useState<PDFSections>(allTrue);
  const allChecked = Object.values(sections).every(Boolean);
  const noneChecked = Object.values(sections).every(v => !v);

  function toggle(key: keyof PDFSections) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleGenerate() {
    generatePDFReport({ scenario, computed, sections });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-app-surface border border-app-border rounded-lg shadow-xl w-80 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-app-text mb-3">PDF Report Sections</h3>

        <button
          className="text-[11px] text-app-accent hover:underline mb-3"
          onClick={() => setSections(allChecked ? allFalse() : allTrue())}
        >
          {allChecked ? 'None' : 'All'}
        </button>

        <div className="space-y-1.5 mb-4">
          {SECTION_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-[12px] text-app-text2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggle(key)}
                className="accent-emerald-500"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-[11px] rounded-md border border-app-border bg-app-surface text-app-text3 hover:text-app-text transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-[11px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40"
            onClick={handleGenerate}
            disabled={noneChecked}
          >
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}
