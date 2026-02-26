import { useMemo } from 'react';
import { useTheme } from './useTheme';

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useChartColors() {
  const { theme } = useTheme();

  return useMemo(() => {
    const gridStroke = getCSSVar('--app-chart-grid') || '#f1f5f9';
    const tickFill = getCSSVar('--app-chart-tick') || '#94a3b8';
    const tooltipBg = getCSSVar('--app-tooltip-bg') || '#ffffff';
    const tooltipBorder = getCSSVar('--app-tooltip-border') || '#e2e8f0';
    const textColor = getCSSVar('--app-text') || '#0f172a';
    const text3 = getCSSVar('--app-text3') || '#64748b';

    return {
      gridStroke,
      tickFill,
      axisTick: { fill: tickFill, fontSize: 10 } as const,
      tooltipStyle: {
        background: tooltipBg,
        border: `1px solid ${tooltipBorder}`,
        borderRadius: 6,
        fontSize: 11,
        color: textColor,
      } as const,
      labelStyle: { color: textColor } as const,
      legendStyle: { fontSize: 11, color: text3 } as const,
      legendStyle10: { fontSize: 10, color: text3 } as const,
    };
  }, [theme]);
}
