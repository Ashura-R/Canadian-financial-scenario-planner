import React from 'react';
import { LeftPanel } from '../LeftPanel/LeftPanel';
import { RightPanel } from '../RightPanel/RightPanel';

export function ScenarioEditor() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[520px] shrink-0 border-r border-[#1e2d3d] overflow-hidden flex flex-col">
        <LeftPanel />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <RightPanel />
      </div>
    </div>
  );
}
