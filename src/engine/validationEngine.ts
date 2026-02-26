import type { YearData, Assumptions, OpeningBalances } from '../types/scenario';
import type { ValidationWarning } from '../types/computed';

export function validateYear(
  yd: YearData,
  ass: Assumptions,
  rrspUnusedRoom: number,
  fhsaContribLifetime: number,
  capitalLossCF: number,
  tfsaAvailableRoom: number = Infinity,
  prevBalances?: OpeningBalances,
  isRRIF: boolean = false,
  fhsaDisposed: boolean = false,
  fhsaUnusedRoom: number = 0,
  fhsaOpeningYear: number | null = null,
  age: number | null = null,
  year: number = 0,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // === Negative value checks ===
  const nonNegFields: { field: keyof YearData; label: string }[] = [
    { field: 'employmentIncome', label: 'Employment Income' },
    { field: 'selfEmploymentIncome', label: 'Self-Employment Income' },
    { field: 'eligibleDividends', label: 'Eligible Dividends' },
    { field: 'nonEligibleDividends', label: 'Non-Eligible Dividends' },
    { field: 'interestIncome', label: 'Interest Income' },
    { field: 'capitalGainsRealized', label: 'Capital Gains Realized' },
    { field: 'capitalLossesRealized', label: 'Capital Losses Realized' },
    { field: 'rrspContribution', label: 'RRSP Contribution' },
    { field: 'tfsaContribution', label: 'TFSA Contribution' },
    { field: 'fhsaContribution', label: 'FHSA Contribution' },
    { field: 'nonRegContribution', label: 'Non-Reg Contribution' },
    { field: 'rrspWithdrawal', label: 'RRSP Withdrawal' },
    { field: 'tfsaWithdrawal', label: 'TFSA Withdrawal' },
    { field: 'fhsaWithdrawal', label: 'FHSA Withdrawal' },
    { field: 'nonRegWithdrawal', label: 'Non-Reg Withdrawal' },
    { field: 'savingsDeposit', label: 'Savings Deposit' },
    { field: 'savingsWithdrawal', label: 'Savings Withdrawal' },
    { field: 'rrspDeductionClaimed', label: 'RRSP Deduction Claimed' },
    { field: 'fhsaDeductionClaimed', label: 'FHSA Deduction Claimed' },
    { field: 'capitalLossApplied', label: 'Capital Loss Applied' },
  ];
  for (const { field, label } of nonNegFields) {
    if ((yd[field] as number) < 0) {
      warnings.push({ field, message: `${label} cannot be negative`, severity: 'error' });
    }
  }

  // === Withdrawal exceeds balance checks ===
  if (prevBalances) {
    if (yd.rrspWithdrawal > prevBalances.rrsp + yd.rrspContribution && prevBalances.rrsp + yd.rrspContribution > 0) {
      warnings.push({
        field: 'rrspWithdrawal',
        message: `RRSP withdrawal $${yd.rrspWithdrawal.toLocaleString()} exceeds available balance $${(prevBalances.rrsp + yd.rrspContribution).toLocaleString()}`,
        severity: 'error',
      });
    }
    if (yd.rrspWithdrawal > 0 && prevBalances.rrsp === 0 && yd.rrspContribution === 0) {
      warnings.push({
        field: 'rrspWithdrawal',
        message: `Cannot withdraw from RRSP — balance is $0`,
        severity: 'error',
      });
    }

    if (yd.tfsaWithdrawal > prevBalances.tfsa + yd.tfsaContribution && prevBalances.tfsa + yd.tfsaContribution > 0) {
      warnings.push({
        field: 'tfsaWithdrawal',
        message: `TFSA withdrawal $${yd.tfsaWithdrawal.toLocaleString()} exceeds available balance $${(prevBalances.tfsa + yd.tfsaContribution).toLocaleString()}`,
        severity: 'error',
      });
    }
    if (yd.tfsaWithdrawal > 0 && prevBalances.tfsa === 0 && yd.tfsaContribution === 0) {
      warnings.push({
        field: 'tfsaWithdrawal',
        message: `Cannot withdraw from TFSA — balance is $0`,
        severity: 'error',
      });
    }

    if (yd.fhsaWithdrawal > prevBalances.fhsa + yd.fhsaContribution && prevBalances.fhsa + yd.fhsaContribution > 0) {
      warnings.push({
        field: 'fhsaWithdrawal',
        message: `FHSA withdrawal $${yd.fhsaWithdrawal.toLocaleString()} exceeds available balance $${(prevBalances.fhsa + yd.fhsaContribution).toLocaleString()}`,
        severity: 'error',
      });
    }
    if (yd.fhsaWithdrawal > 0 && prevBalances.fhsa === 0 && yd.fhsaContribution === 0) {
      warnings.push({
        field: 'fhsaWithdrawal',
        message: `Cannot withdraw from FHSA — balance is $0`,
        severity: 'error',
      });
    }

    if (yd.nonRegWithdrawal > prevBalances.nonReg + yd.nonRegContribution && prevBalances.nonReg + yd.nonRegContribution > 0) {
      warnings.push({
        field: 'nonRegWithdrawal',
        message: `Non-Reg withdrawal $${yd.nonRegWithdrawal.toLocaleString()} exceeds available balance $${(prevBalances.nonReg + yd.nonRegContribution).toLocaleString()}`,
        severity: 'error',
      });
    }
    if (yd.nonRegWithdrawal > 0 && prevBalances.nonReg === 0 && yd.nonRegContribution === 0) {
      warnings.push({
        field: 'nonRegWithdrawal',
        message: `Cannot withdraw from Non-Reg — balance is $0`,
        severity: 'error',
      });
    }

    if (yd.savingsWithdrawal > prevBalances.savings + yd.savingsDeposit && prevBalances.savings + yd.savingsDeposit > 0) {
      warnings.push({
        field: 'savingsWithdrawal',
        message: `Savings withdrawal $${yd.savingsWithdrawal.toLocaleString()} exceeds available balance $${(prevBalances.savings + yd.savingsDeposit).toLocaleString()}`,
        severity: 'error',
      });
    }
    if (yd.savingsWithdrawal > 0 && prevBalances.savings === 0 && yd.savingsDeposit === 0) {
      warnings.push({
        field: 'savingsWithdrawal',
        message: `Cannot withdraw from Savings — balance is $0`,
        severity: 'error',
      });
    }
  }

  // === RRSP room check ===
  const earnedIncome = yd.employmentIncome + yd.selfEmploymentIncome;
  const newRrspRoom = Math.min(
    earnedIncome * ass.rrspPctEarnedIncome,
    ass.rrspLimit
  );
  const totalRrspRoom = rrspUnusedRoom + newRrspRoom;
  if (yd.rrspContribution > totalRrspRoom + 2000) { // $2000 buffer allowed
    warnings.push({
      field: 'rrspContribution',
      message: `RRSP contribution $${yd.rrspContribution.toLocaleString()} exceeds available room $${totalRrspRoom.toLocaleString()} (+$2K buffer)`,
      severity: 'error',
    });
  }

  // === RRSP contribution after RRIF conversion ===
  if (isRRIF && yd.rrspContribution > 0) {
    warnings.push({
      field: 'rrspContribution',
      message: `Cannot contribute to RRSP — account has converted to RRIF`,
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

  // === TFSA room check ===
  if (yd.tfsaContribution > tfsaAvailableRoom) {
    warnings.push({
      field: 'tfsaContribution',
      message: `TFSA contribution $${yd.tfsaContribution.toLocaleString()} exceeds available room $${Math.round(tfsaAvailableRoom).toLocaleString()}`,
      severity: 'error',
    });
  }

  // === FHSA checks ===
  // FHSA annual limit (with carry-forward room)
  const fhsaTotalRoom = ass.fhsaAnnualLimit + Math.min(fhsaUnusedRoom, ass.fhsaAnnualLimit);
  if (yd.fhsaContribution > fhsaTotalRoom) {
    warnings.push({
      field: 'fhsaContribution',
      message: `FHSA contribution $${yd.fhsaContribution.toLocaleString()} exceeds available room $${fhsaTotalRoom.toLocaleString()} (annual + carry-forward)`,
      severity: 'error',
    });
  }

  // FHSA lifetime limit
  if (fhsaContribLifetime + yd.fhsaContribution > ass.fhsaLifetimeLimit) {
    warnings.push({
      field: 'fhsaContribution',
      message: `FHSA lifetime contributions would reach $${(fhsaContribLifetime + yd.fhsaContribution).toLocaleString()}, exceeds $${ass.fhsaLifetimeLimit.toLocaleString()} limit`,
      severity: 'error',
    });
  }

  // FHSA contribution after disposition
  if (fhsaDisposed && yd.fhsaContribution > 0) {
    warnings.push({
      field: 'fhsaContribution',
      message: `Cannot contribute to FHSA — account has been disposed/closed`,
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

  // === Capital loss applied ===
  if (yd.capitalLossApplied > capitalLossCF + yd.capitalLossesRealized) {
    warnings.push({
      field: 'capitalLossApplied',
      message: `Capital loss applied exceeds available C/F balance`,
      severity: 'error',
    });
  }

  // === Simultaneous contribution + withdrawal (same account, same year) ===
  if (yd.rrspContribution > 0 && yd.rrspWithdrawal > 0 && !isRRIF) {
    warnings.push({
      field: 'rrspContribution',
      message: `Contributing and withdrawing from RRSP in the same year — is this intentional?`,
      severity: 'warning',
    });
  }
  if (yd.tfsaContribution > 0 && yd.tfsaWithdrawal > 0) {
    warnings.push({
      field: 'tfsaContribution',
      message: `Contributing and withdrawing from TFSA in the same year — is this intentional?`,
      severity: 'warning',
    });
  }
  if (yd.fhsaContribution > 0 && yd.fhsaWithdrawal > 0) {
    warnings.push({
      field: 'fhsaContribution',
      message: `Contributing and withdrawing from FHSA in the same year — is this intentional?`,
      severity: 'warning',
    });
  }

  // === Asset allocation checks (each account must sum to ~100%) ===
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

  // === EOY override indicators ===
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

  // === FHSA 15-year / age-71 limit warning ===
  if (fhsaOpeningYear !== null && !fhsaDisposed && year > 0) {
    const yearsOpen = year - fhsaOpeningYear;
    if (yearsOpen >= 14) { // warn 1 year before forced close
      warnings.push({
        field: 'fhsaContribution',
        message: `FHSA has been open ${yearsOpen} years — must close by year ${fhsaOpeningYear + 15}`,
        severity: 'warning',
      });
    }
    if (age !== null && age >= 70) {
      warnings.push({
        field: 'fhsaContribution',
        message: `FHSA must close by end of year holder turns 71 (age ${age} now)`,
        severity: 'warning',
      });
    }
  }

  return warnings;
}
