import type { YearData, Assumptions } from '../types/scenario';
import type { ValidationWarning } from '../types/computed';

export function validateYear(
  yd: YearData,
  ass: Assumptions,
  rrspUnusedRoom: number,
  fhsaContribLifetime: number,
  capitalLossCF: number,
  tfsaAvailableRoom: number = Infinity
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // RRSP room check
  const earnedIncome = yd.employmentIncome + yd.selfEmploymentIncome;
  const newRrspRoom = Math.min(
    earnedIncome * ass.rrspPctEarnedIncome,
    ass.rrspLimit
  );
  const totalRrspRoom = rrspUnusedRoom + newRrspRoom;
  if (yd.rrspContribution > totalRrspRoom + 2000) { // $2000 buffer allowed
    warnings.push({
      field: 'rrspContribution',
      message: `RRSP contribution $${yd.rrspContribution.toLocaleString()} exceeds available room $${totalRrspRoom.toLocaleString()}`,
      severity: 'error',
    });
  }

  // RRSP deduction check
  const rrspDeductionRoom = yd.rrspContribution + rrspUnusedRoom;
  if (yd.rrspDeductionClaimed > rrspDeductionRoom) {
    warnings.push({
      field: 'rrspDeductionClaimed',
      message: `RRSP deduction claimed exceeds contributions + unused C/F`,
      severity: 'error',
    });
  }

  // TFSA room check (accounts for carry-forward + annual limit + restored room)
  if (yd.tfsaContribution > tfsaAvailableRoom) {
    warnings.push({
      field: 'tfsaContribution',
      message: `TFSA contribution $${yd.tfsaContribution.toLocaleString()} exceeds available room $${Math.round(tfsaAvailableRoom).toLocaleString()}`,
      severity: 'warning',
    });
  }

  // FHSA annual limit
  if (yd.fhsaContribution > ass.fhsaAnnualLimit) {
    warnings.push({
      field: 'fhsaContribution',
      message: `FHSA contribution $${yd.fhsaContribution.toLocaleString()} exceeds annual limit $${ass.fhsaAnnualLimit.toLocaleString()}`,
      severity: 'error',
    });
  }

  // FHSA lifetime limit
  if (fhsaContribLifetime + yd.fhsaContribution > ass.fhsaLifetimeLimit) {
    warnings.push({
      field: 'fhsaContribution',
      message: `FHSA lifetime contributions would exceed $${ass.fhsaLifetimeLimit.toLocaleString()} limit`,
      severity: 'error',
    });
  }

  // FHSA deduction
  if (yd.fhsaDeductionClaimed > yd.fhsaContribution) {
    warnings.push({
      field: 'fhsaDeductionClaimed',
      message: `FHSA deduction claimed exceeds contributions`,
      severity: 'error',
    });
  }

  // Capital loss applied
  if (yd.capitalLossApplied > capitalLossCF + yd.capitalLossesRealized) {
    warnings.push({
      field: 'capitalLossApplied',
      message: `Capital loss applied exceeds available C/F balance`,
      severity: 'error',
    });
  }

  // Asset allocation checks (each account must sum to ~100%)
  const accounts = [
    { name: 'RRSP', e: yd.rrspEquityPct, f: yd.rrspFixedPct, c: yd.rrspCashPct },
    { name: 'TFSA', e: yd.tfsaEquityPct, f: yd.tfsaFixedPct, c: yd.tfsaCashPct },
    { name: 'FHSA', e: yd.fhsaEquityPct, f: yd.fhsaFixedPct, c: yd.fhsaCashPct },
    { name: 'Non-Reg', e: yd.nonRegEquityPct, f: yd.nonRegFixedPct, c: yd.nonRegCashPct },
  ];
  for (const acct of accounts) {
    const sum = acct.e + acct.f + acct.c;
    if (Math.abs(sum - 1.0) > 0.005) {
      warnings.push({
        field: `${acct.name.toLowerCase()}Allocation`,
        message: `${acct.name} asset allocation sums to ${(sum * 100).toFixed(1)}%, must equal 100%`,
        severity: 'warning',
      });
    }
  }

  // EOY override indicators
  if (yd.rrspEOYOverride !== undefined) {
    warnings.push({ field: 'rrspEOYOverride', message: 'RRSP EOY Override active', severity: 'warning' });
  }
  if (yd.tfsaEOYOverride !== undefined) {
    warnings.push({ field: 'tfsaEOYOverride', message: 'TFSA EOY Override active', severity: 'warning' });
  }
  if (yd.fhsaEOYOverride !== undefined) {
    warnings.push({ field: 'fhsaEOYOverride', message: 'FHSA EOY Override active', severity: 'warning' });
  }
  if (yd.nonRegEOYOverride !== undefined) {
    warnings.push({ field: 'nonRegEOYOverride', message: 'Non-Reg EOY Override active', severity: 'warning' });
  }
  if (yd.savingsEOYOverride !== undefined) {
    warnings.push({ field: 'savingsEOYOverride', message: 'Savings EOY Override active', severity: 'warning' });
  }

  return warnings;
}
