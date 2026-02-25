import type { ComputedYear, ComputedAnalytics } from '../types/computed';

export function computeAnalytics(years: ComputedYear[]): ComputedAnalytics {
  let lifetimeGrossIncome = 0;
  let lifetimeTotalTax = 0;
  let lifetimeCPPEI = 0;
  let lifetimeAfterTaxIncome = 0;
  let lifetimeCashFlow = 0;

  const annualCashFlow: number[] = [];
  const cumulativeCashFlow: number[] = [];
  const cumulativeGrossIncome: number[] = [];
  const cumulativeAfterTaxIncome: number[] = [];
  const cumulativeTotalTax: number[] = [];
  const cumulativeRealCashFlow: number[] = [];
  let runningCumulative = 0;
  let runningGross = 0;
  let runningAfterTax = 0;
  let runningTax = 0;
  let runningRealCF = 0;

  for (const yr of years) {
    lifetimeGrossIncome += yr.waterfall.grossIncome;
    lifetimeTotalTax += yr.tax.totalIncomeTax;
    lifetimeCPPEI += yr.cpp.totalCPPPaid + yr.ei.totalEI;
    lifetimeAfterTaxIncome += yr.waterfall.afterTaxIncome;
    lifetimeCashFlow += yr.waterfall.netCashFlow;

    annualCashFlow.push(yr.waterfall.netCashFlow);
    runningCumulative += yr.waterfall.netCashFlow;
    cumulativeCashFlow.push(runningCumulative);

    runningGross += yr.waterfall.grossIncome;
    cumulativeGrossIncome.push(runningGross);

    runningAfterTax += yr.waterfall.afterTaxIncome;
    cumulativeAfterTaxIncome.push(runningAfterTax);

    runningTax += yr.tax.totalIncomeTax;
    cumulativeTotalTax.push(runningTax);

    runningRealCF += yr.realNetCashFlow;
    cumulativeRealCashFlow.push(runningRealCF);
  }

  const lifetimeAvgTaxRate = lifetimeGrossIncome > 0 ? lifetimeTotalTax / lifetimeGrossIncome : 0;
  const lifetimeAvgAllInRate = lifetimeGrossIncome > 0
    ? (lifetimeTotalTax + lifetimeCPPEI) / lifetimeGrossIncome
    : 0;

  return {
    lifetimeGrossIncome,
    lifetimeTotalTax,
    lifetimeCPPEI,
    lifetimeAfterTaxIncome,
    lifetimeAvgTaxRate,
    lifetimeAvgAllInRate,
    lifetimeCashFlow,
    annualCashFlow,
    cumulativeCashFlow,
    cumulativeGrossIncome,
    cumulativeAfterTaxIncome,
    cumulativeTotalTax,
    cumulativeRealCashFlow,
  };
}
