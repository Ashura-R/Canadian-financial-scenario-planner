# Tax & Investment Algorithm Reference

> Formula reference for all computations in the engine, with ITA references and worked numerical examples.
> Source files: `taxEngine.ts`, `accountEngine.ts`, `index.ts`, `acbEngine.ts`, `assumptionResolver.ts`.

---

## 1. Computation Flow Overview

```
Employment/SE/Other Income
    │
    ├── Dividend Gross-Up (ITA s. 82)
    ├── Taxable Capital Gains (ITA s. 38)
    ├── RRSP/RRIF Withdrawals, LIF, Pension, CPP/OAS Benefits
    │
    ▼
Total Income Before Deductions
    │
    ├── RRSP Deduction (ITA s. 146)
    ├── FHSA Deduction (ITA s. 146.6)
    ├── CPP SE Employer Half (ITA s. 60(e))
    ├── Union Dues, Child Care, Moving Expenses, Other
    │
    ▼
Net Taxable Income
    │
    ├──► Federal Tax (ITA s. 117(2)) ──► Non-Refundable Credits ──► Federal Tax Payable
    ├──► Provincial Tax ──► Provincial Credits ──► Provincial Tax Payable
    ├──► Ontario Surtax + Health Premium (if ON)
    ├──► AMT Check (ITA s. 127.5)
    ├──► Quebec Abatement (if QC)
    ├──► OAS Clawback (ITA s. 180.2)
    ├──► Foreign Tax Credit (ITA s. 126)
    ├──► Canada Workers Benefit (ITA s. 122.7)
    │
    ▼
Total Income Tax
    │
    ├── CPP Contributions (employee + SE)
    ├── EI Premiums
    │
    ▼
After-Tax Income
    │
    ├── Living Expenses (housing, groceries, etc.)
    │
    ▼
After Expenses
    │
    ├── Account Contributions (RRSP, TFSA, FHSA, Non-Reg, RESP, LI)
    ├── Account Withdrawals
    │
    ▼
Net Cash Flow
```

Source: `accountEngine.ts:computeWaterfall()`, `index.ts:computeOneYear()`

---

## 2. Income Aggregation

### Total Income Before Deductions

```
totalIncomeBeforeDeductions =
    employmentIncome
  + selfEmploymentIncome − selfEmploymentExpenses    (net SE, min 0)
  + rrspWithdrawal                                    (fully taxable)
  + lifWithdrawal                                     (fully taxable)
  + cppBenefitIncome                                  (CPP pension received)
  + oasIncome                                         (OAS pension received)
  + eligibleDividends × (1 + 0.38)                    (grossed-up, ITA s. 82)
  + nonEligibleDividends × (1 + 0.15)                 (grossed-up, ITA s. 82)
  + interestIncome
  + taxableCapitalGains                               (see §2.1)
  + otherTaxableIncome
  + pensionIncome
  + foreignIncome
  + (rentalGrossIncome − rentalExpenses)              (net rental)
```

Source: `taxEngine.ts:computeTax()` lines 154–168

### 2.1 Taxable Capital Gains (ITA s. 38)

**Standard mode:**
```
netGains = max(0, capitalGainsRealized − capitalLossApplied − lcgeClaimAmount)
taxableCapitalGains = netGains × capitalGainsInclusionRate
```

**Two-tier mode** (optional, for proposed post-2024 rules):
```
tier1Gains = min(netGains, threshold)        // default threshold = $250,000
tier2Gains = max(0, netGains − threshold)
taxableCapitalGains = tier1Gains × tier1Rate + tier2Gains × tier2Rate
                    = tier1Gains × 0.50 + tier2Gains × 0.667
```

Source: `taxEngine.ts` lines 130–143

---

## 3. Deductions

```
netTaxableIncome = max(0,
    totalIncomeBeforeDeductions
  − rrspDeductionClaimed         (ITA s. 146)
  − fhsaDeductionClaimed         (ITA s. 146.6)
  − cppSEEmployerHalfDed         (ITA s. 60(e)) — half of SE CPP+CPP2
  − unionDues                    (line 21200)
  − childCareExpenses            (line 21400)
  − movingExpenses               (line 21900)
  − otherDeductions
)
```

Source: `taxEngine.ts` lines 173–188

---

## 4. CPP Contributions

Reference: CPP Act s. 11.1, s. 18

### CPP1 (Employee)

```
maxPensionable = max(0, YMPE − basicExemption)
empPensionable = max(0, min(employmentIncome, YMPE) − basicExemption)
cppEmployee    = empPensionable × employeeRate
```

### CPP1 (Self-Employed)

Self-employed pay both halves. Shares the YMPE ceiling with employment.

```
remainingPensionable = max(0, maxPensionable − empPensionable)
sePensionableRaw     = max(0, min(selfEmploymentIncome, YMPE) − basicExemption)
sePensionable        = min(sePensionableRaw, remainingPensionable)
cppSE                = sePensionable × employeeRate × 2
```

### CPP2 (2024+)

CPP2 applies to earnings between YMPE and YAMPE.

```
empAboveYMPE  = max(0, min(employmentIncome, YAMPE) − YMPE)
cpp2Employee  = empAboveYMPE × cpp2Rate

remainingCPP2    = max(0, YAMPE − YMPE − empAboveYMPE)
seAboveYMPE      = min(max(0, min(seIncome, YAMPE) − YMPE), remainingCPP2)
cpp2SE           = seAboveYMPE × cpp2Rate × 2
```

### SE Employer Half Deduction (ITA s. 60(e))

```
cppSEEmployerHalfDed = (cppSE + cpp2SE) × 0.5
```

### CPP Credit Amount

For the non-refundable credit, only the employee half counts:

```
totalCPPForCredit = cppEmployee + cpp2Employee + (cppSE / 2) + (cpp2SE / 2)
```

Source: `taxEngine.ts:computeCPP()` lines 33–86

### Worked Example: $90,000 Earner in 2025

Using 2025 values: basicExemption=$3,500, YMPE=$71,300, YAMPE=$81,200, rate=5.95%, CPP2 rate=4%.

```
empPensionable = min(90000, 71300) − 3500 = 67,800
cppEmployee    = 67,800 × 0.0595 = $4,034.10

empAboveYMPE   = min(90000, 81200) − 71300 = 9,900
cpp2Employee   = 9,900 × 0.04 = $396.00

totalCPPPaid   = 4,034.10 + 396.00 = $4,430.10
```

---

## 5. EI Premiums

Reference: EI Act s. 67–68

```
eiEmployment = min(employmentIncome, maxInsurableEarnings) × employeeRate
eiSE         = seOptIn ? min(selfEmploymentIncome, maxInsurable) × employeeRate : 0
totalEI      = eiEmployment + eiSE
```

Source: `taxEngine.ts:computeEI()` lines 88–105

### Worked Example: $90,000 Earner in 2025

Using 2025: maxInsurable=$65,700, rate=1.64%.

```
eiEmployment = min(90000, 65700) × 0.0164 = 65,700 × 0.0164 = $1,077.48
```

---

## 6. Federal Tax

Reference: ITA s. 117(2)

### Bracket Application

```
federalTaxBeforeCredits = Σ (incomeInBracket_i × rate_i)
```

Where `incomeInBracket_i = max(0, min(netTaxableIncome, bracket_i.max) − bracket_i.min)`.

Source: `taxEngine.ts:applyBrackets()` lines 5–14

### Non-Refundable Credits

All federal non-refundable credits are computed at the lowest bracket rate (`bpaCreditRate = federalBrackets[0].rate`):

| Credit | Formula | ITA |
|--------|---------|-----|
| Basic Personal Amount | BPA × bpaCreditRate | s. 118(1)(c) |
| CPP/EI | totalCPPForCredit × bpaCreditRate, totalEI × bpaCreditRate | s. 118(1) |
| Employment Amount | min(empIncome, $1,501) × bpaCreditRate | s. 118(10) |
| Pension Income | min(eligiblePension, $2,000) × bpaCreditRate | s. 118(3) |
| Age Amount (65+) | max(0, $8,396 − 0.15 × max(0, income − $42,335)) × bpaCreditRate | s. 118(2) |
| Charitable Donations | first $200 × 15% + remainder × 29% (or 33% if top bracket) | s. 118.1 |
| Disability Tax Credit | $9,428 × bpaCreditRate | s. 118.3 |
| Medical Expenses | max(0, medExpenses − min(3% × income, $2,759)) × bpaCreditRate | s. 118.2 |
| Student Loan Interest | studentLoanInterest × bpaCreditRate | s. 118.62 |
| Home Buyers' Amount | $10,000 × bpaCreditRate (purchase year only) | s. 118.05 |
| Eligible Dividend Credit | grossedUpEligible × 15.0198% | s. 121 |
| Non-Eligible Dividend Credit | grossedUpNonEligible × 9.0301% | s. 121 |

```
federalTaxPayable = max(0, federalTaxBeforeCredits − totalFederalCredits)
```

Source: `taxEngine.ts:computeTax()` lines 190–262

### Worked Example: $120,000 Income in 2026

Using 2026 federal brackets and BPA=$16,452.

```
Bracket 1: 58,523 × 0.14     =  $8,193.22
Bracket 2: (117,045−58,523) × 0.205 = 58,522 × 0.205 = $11,997.01
Bracket 3: (120,000−117,045) × 0.26 =  2,955 × 0.26  =    $768.30
─────────────────────────────────────────────────────────
Federal tax before credits    = $20,958.53

BPA credit: 16,452 × 0.14    =  $2,303.28
CPP credit (assume $4,430):    4,430 × 0.14 = $620.20
EI credit (assume $1,123):     1,123 × 0.14 = $157.22
Employment amount:         min(120000, 1501) × 0.14 = $210.14
─────────────────────────────────────────────────────────
Total credits (minimum)       =  $3,290.84

Federal tax payable           = $20,958.53 − $3,290.84 = $17,667.69
```

---

## 7. Provincial Tax (Ontario)

Reference: Ontario Taxation Act, 2007

### Bracket Application

Same `applyBrackets()` function as federal, using provincial brackets and BPA.

### Provincial Credits

Computed at the lowest provincial rate (5.05% for Ontario):

- Provincial BPA: $12,989 × 5.05% = $655.94
- CPP: totalCPPForCredit × 5.05%
- EI: totalEI × 5.05%
- Provincial employment amount: $0 for ON (only YT has $1,501)
- Provincial pension, age, donation, DTC, medical, student loan credits
- Provincial dividend credits: eligible × 10.00%, non-eligible × 2.9863%

### Ontario Surtax

```
surtax = 0.20 × max(0, basicProvTax − 4991)
       + 0.36 × max(0, basicProvTax − 6387)
```

Source: `taxEngine.ts` lines 326–329

### Ontario Health Premium (OHPA)

Piecewise levy on taxable income. Thresholds are NOT indexed to inflation.

```
if income ≤ $20,000:                    $0
if income ≤ $25,000:         6% × (income − $20,000)
if income ≤ $36,000:                    $300
if income ≤ $38,500:  $300 + 6% × (income − $36,000)
if income ≤ $48,000:                    $450
if income ≤ $48,600:  $450 + 25% × (income − $48,000)
if income ≤ $72,000:                    $600
if income ≤ $72,600:  $600 + 25% × (income − $72,000)
if income ≤ $200,000:                   $750
if income ≤ $200,600: $750 + 25% × (income − $200,000)
if income > $200,600:                   $900
```

The maximum Ontario Health Premium is $900/year.

Source: `taxEngine.ts` lines 332–361

### Worked Example: $85,000 Income (Ontario, 2026)

```
Provincial brackets:
  0–53,891 × 5.05%   = $2,721.50
  53,891–85,000 × 9.15% = 31,109 × 9.15% = $2,846.47
──────────────────────────────────────
Provincial tax before credits = $5,567.97

BPA credit: 12,989 × 5.05%  = $655.94
CPP credit (assume $4,430 × 5.05%) = $223.72
EI credit (assume $1,077 × 5.05%)  = $54.39
──────────────────────────────────────
Credits (minimum)            = $934.05

Basic provincial tax         = $5,567.97 − $934.05 = $4,633.92

Ontario Surtax:
  20% × max(0, 4633.92 − 4991) = 20% × 0 = $0
  36% × max(0, 4633.92 − 6387) = 36% × 0 = $0
  Surtax = $0

Ontario Health Premium:
  $85,000 > $72,600 → $750 (flat)

Total ON tax = $4,633.92 + $0 + $750 = $5,383.92
```

---

## 8. Special Tax Provisions

### Quebec Abatement (ITA s. 120(2))

Quebec residents get a 16.5% reduction of basic federal tax:

```
if province == 'QC':
    quebecAbatement = federalTaxPayable × 0.165
    federalTaxPayable -= quebecAbatement
```

### Alternative Minimum Tax (ITA s. 127.5)

Redesigned in 2024. The AMT adjusted income adds back capital gains and donation deductions:

```
cgAddBack       = fullCapitalGains − taxableCapitalGains   (100% vs partial inclusion)
donationAddBack = donations × 0.50
amtAdjustedIncome = netTaxableIncome + cgAddBack + donationAddBack
amtTaxableIncome  = max(0, amtAdjustedIncome − $173,205)  (AMT exemption)
amtGross          = amtTaxableIncome × 20.5%
amtCredits        = bpaCredit                               (only BPA allowed)
amtTax            = max(0, amtGross − amtCredits)

if amtTax > regularFederalTax:
    additionalAMT = amtTax − regularFederalTax
    federalTaxPayable += additionalAMT
```

Source: `taxEngine.ts` lines 370–388

### OAS Clawback (ITA s. 180.2)

15% recovery tax on net income above threshold:

```
oasClawback = min(oasIncome, 0.15 × max(0, netTaxableIncome − oasClawbackThreshold))
```

2025 threshold: $93,454. See [CRA Parameters §7](cra-parameters.md#7-oas-clawback-threshold).

Source: `taxEngine.ts` lines 364–368

### Foreign Tax Credit (ITA s. 126)

```
foreignIncomeRatio = min(1, foreignIncome / netTaxableIncome)
fedFTC   = min(foreignTaxPaid, federalTaxPayable × foreignIncomeRatio)
provFTC  = min(foreignTaxPaid − fedFTC, provincialTaxPayable × foreignIncomeRatio)
```

Source: `taxEngine.ts` lines 391–403

### Canada Workers Benefit (ITA s. 122.7)

Refundable credit for low-income workers (single rates):

```
if earnedIncome > $3,000 and netTaxableIncome < $33,015:
    phaseIn   = (earnedIncome − $3,000) × 27%
    cwbBase   = min(phaseIn, $1,518)
    phaseOut  = max(0, netTaxableIncome − $23,495) × 15%
    cwbCredit = max(0, cwbBase − phaseOut)
```

Source: `taxEngine.ts` lines 406–416

### GIS (Guaranteed Income Supplement)

For seniors age 65+ receiving OAS. Tax-free benefit added after tax computation.

```
gisMaxAnnual = $12,780 × inflationFactor
incomeThreshold = $21,624 × inflationFactor
clawback = max(0, incomeForGIS − incomeThreshold) × 50%
gisIncome = max(0, gisMaxAnnual − clawback)
```

Source: `index.ts` lines 312–324

---

## 9. Account Balances

### Weighted Return Formula

Each account's return is a weighted blend of asset class returns:

```
accountReturn = equityPct × equityReturn + fixedPct × fixedIncomeReturn + cashPct × cashReturn
```

Source: `accountEngine.ts:calcReturn()` lines 5–12

### End-of-Year Balance

```
EOY = (openingBalance + contributions − withdrawals) × (1 + accountReturn)
```

All balances are floored at zero: `EOY = max(0, EOY)`.

Applies to: RRSP, TFSA, FHSA, Non-Reg, Savings, LIRA, RESP, Life Insurance.

Source: `accountEngine.ts:computeAccounts()` lines 21–98

### Net Worth

```
netWorth = rrspEOY + tfsaEOY + fhsaEOY + nonRegEOY + savingsEOY + liraEOY + respEOY + liCashValueEOY − totalDebt
```

### RRIF Minimum Withdrawal (ITA s. 146.3)

When age ≥ RRIF conversion age (default 71), RRSP converts to RRIF with mandatory minimum withdrawals:

```
rrspWithdrawal = max(userEnteredWithdrawal, rrspBalance × rrifFactor(age))
```

**RRIF Factor Table** (CRA prescribed factors, ages 71–95+):

| Age | Factor | Age | Factor | Age | Factor |
|-----|--------|-----|--------|-----|--------|
| 71 | 5.28% | 79 | 6.58% | 87 | 9.55% |
| 72 | 5.40% | 80 | 6.82% | 88 | 10.21% |
| 73 | 5.53% | 81 | 7.08% | 89 | 10.99% |
| 74 | 5.67% | 82 | 7.38% | 90 | 11.92% |
| 75 | 5.82% | 83 | 7.71% | 91 | 13.06% |
| 76 | 5.98% | 84 | 8.08% | 92 | 14.49% |
| 77 | 6.17% | 85 | 8.51% | 93 | 16.34% |
| 78 | 6.36% | 86 | 8.99% | 94 | 18.79% |
|    |        |     |        | 95+ | 20.00% |

Source: `index.ts` lines 15–27

### LIF Min/Max Withdrawal

Same minimum factors as RRIF. Maximum is capped:

```
lifMin = liraBalance × rrifFactor(age)
lifMax = age ≥ 90 ? liraBalance : liraBalance / (90 − age)    (at 0% reference rate)
lifWithdrawal = clamp(userValue, lifMin, lifMax)
```

Source: `index.ts` lines 276–288

---

## 10. Room Tracking

### RRSP Room (ITA s. 146)

```
newRrspRoom = min(priorYearEarnedIncome × 18%, rrspDollarLimit)
rrspUnusedRoom = max(0, previousUnusedRoom + newRrspRoom − rrspDeductionClaimed)
```

When RRIF is active, no new RRSP room is generated (`newRrspRoom = 0`).

Earned income for RRSP purposes = employment income + net self-employment income.

Source: `index.ts` lines 409–412

### TFSA Room (ITA s. 207.01)

```
tfsaRoomGenerated = tfsaAnnualLimit + priorYearTfsaWithdrawals    (if age ≥ 18)
tfsaUnusedRoom = max(0, previousUnusedRoom + tfsaRoomGenerated − tfsaContribution)
```

TFSA room only accrues from age 18. TFSA annual limit is rounded to nearest $500.

Prior-year withdrawals restore room the following year (not the current year).

**Accumulated room calculation** (`tfsaRoom.ts`): For the opening year, if no room or balance is specified, the engine auto-calculates lifetime accumulated TFSA room from age 18 using historical annual limits (2009–present).

Source: `index.ts` lines 694–698, 405

### FHSA Room (ITA s. 146.6)

```
fhsaAnnualRoom = $8,000 (fixed, NOT indexed)
fhsaLifetimeLimit = $40,000
unused carry-forward = min(unusedRoom + annualLimit − contribution, annualLimit)    (max 1 year)
```

FHSA must be closed within 15 years of opening or by age 71. Disposition options:
- **Home purchase**: tax-free withdrawal
- **Transfer to RRSP**: no tax, doesn't consume RRSP room
- **Taxable close**: full amount added to income

Source: `index.ts` lines 593–650

### Capital Loss Carry-Forward

```
lossCFBeforeApply = previousLossCF + currentYearLosses
lossApplied = min(userClaimedLossApplied, lossCFBeforeApply)
newCapitalLossCF = max(0, lossCFBeforeApply − lossApplied)
```

Source: `index.ts` lines 335–350

---

## 11. ACB Tracking

### Non-Registered Account ACB

Adjusted Cost Base tracks the cost basis of investments:

```
acbAdded = nonRegContribution
acbBeforeWithdrawal = openingACB + acbAdded

// Proportional removal on withdrawal
balanceBeforeWithdrawal = prevBalance + contribution + returns
withdrawalFraction = min(1, withdrawal / balanceBeforeWithdrawal)
acbRemoved = acbBeforeWithdrawal × withdrawalFraction

closingACB = max(0, acbBeforeWithdrawal − acbRemoved)
perUnitACB = closingACB / nonRegEOY    (if nonRegEOY > 0)
```

Capital gains are user-specified (from actual investment dispositions), not derived from withdrawal math:

```
computedCapitalGain = realizedGains − realizedLosses
```

Source: `acbEngine.ts:computeACB()` lines 12–62

### Life Insurance ACB

For whole/universal life policies:

```
acbAdded = premium
coiDeducted = costOfInsurance
acbBeforeWithdrawal = max(0, openingACB + premium − COI)

// On partial surrender:
fraction = min(1, withdrawal / balanceBeforeWithdrawal)
acbRemoved = acbBeforeWithdrawal × fraction
surrenderGain = withdrawalProceeds − acbRemoved    (taxed as regular income)

closingACB = max(0, acbBeforeWithdrawal − acbRemoved)
```

Source: `acbEngine.ts:computeInsuranceACB()` lines 71–111

---

## 12. Cash Flow Waterfall

The full waterfall from gross income to net cash flow:

```
grossIncome        = employment + SE(net) + rrspWithdrawal + lifWithdrawal
                   + cppBenefit + oasBenefit + dividends(actual) + interest
                   + capitalGains + otherTaxable + pension + foreign + rentalNet

afterRRSPDed       = grossIncome − rrspDeductionClaimed
afterFHSADed       = afterRRSPDed − fhsaDeductionClaimed
afterCPPSEHalf     = afterFHSADed − cppSEEmployerHalfDeduction
afterCapLoss       = afterCPPSEHalf − capitalLossApplied
netTaxableIncome   = (computed by tax engine, may differ slightly due to other deductions)

afterFederalTax    = netTaxableIncome − federalTaxPayable
afterProvincialTax = afterFederalTax − provincialTaxPayable
afterCPPEI         = afterProvincialTax − totalCPPPaid − totalEI
afterTaxIncome     = afterCPPEI + gisIncome                      (GIS is tax-free)

totalLivingExpenses = housing + groceries + transportation + utilities
                    + insurance + entertainment + personal + other

afterExpenses      = afterTaxIncome − totalLivingExpenses

totalContributions = rrsp + tfsa + fhsa + nonReg + savings + resp + liPremium
totalWithdrawals   = rrsp + tfsa + fhsa + nonReg + savings + lif + resp + liWithdrawal

netCashFlow        = afterExpenses − totalContributions + totalWithdrawals
```

Source: `accountEngine.ts:computeWaterfall()` lines 100–164

---

## 13. Inflation & Assumption Resolution

### Auto-Indexing Rules (ITA s. 117.1)

The engine auto-indexes 2026 base values for future years using cumulative inflation:

```
cumulativeInflationFactor = Π(1 + inflationRate_y)  for each year y > 2026

indexedValue = round(baseValue × cumulativeInflationFactor)
```

**What IS auto-indexed:**
- Federal & provincial bracket thresholds (dollar amounts, NOT rates)
- Federal & provincial BPA
- CPP basic exemption, YMPE, YAMPE
- EI max insurable earnings
- RRSP dollar limit
- TFSA annual limit (rounded to nearest $500)
- OAS clawback threshold
- Federal employment amount

**What is NOT auto-indexed:**
- Tax rates (federal, provincial)
- CPP/EI contribution rates
- FHSA limits ($8K annual, $40K lifetime — legislatively fixed)
- Ontario Health Premium thresholds
- Ontario surtax thresholds ($4,991 / $6,387)
- Ontario upper bracket thresholds ($150K / $220K)
- Dividend gross-up and credit rates

Source: `assumptionResolver.ts:resolveAssumptions()` lines 28–80

### Historical Override Priority

For years ≤ 2026, auto-indexing is disabled (`inflationFactor = 1`). Values come from:

1. **User overrides** (highest priority) — per-year values entered in the UI
2. **Historical CRA data** — from `historicalAssumptions.ts` (1990–2025)
3. **Base defaults** — from `defaults.ts` (2026)

Merge order: historical data is loaded first, then user overrides are layered on top.

Source: `index.ts` lines 537–543, 574–589

### Real Values

All nominal values are deflated by the cumulative inflation factor:

```
realValue = nominalValue / cumulativeInflationFactor
```

Computed for: gross income, after-tax income, net worth, net cash flow.

Source: `index.ts` lines 400–403

---

## 14. Retirement Benefits

### CPP Pension Benefit

When enabled and age ≥ startAge:

```
cppBenefit = monthlyAmount × 12 × (1 + inflationRate)^yearsReceiving
```

Benefits are indexed to inflation from the year they begin.

Source: `index.ts` lines 294–299

### OAS Pension Benefit

Same structure as CPP:

```
oasIncome = monthlyAmount × 12 × (1 + inflationRate)^yearsReceiving
```

Subject to clawback (see [§8 OAS Clawback](#oas-clawback-ita-s-1802)).

Source: `index.ts` lines 302–308

### Home Buyers' Plan (HBP)

Tax-free RRSP withdrawal for first-time home purchase:

```
Withdrawal year:
    hbpWithdrawal = min(withdrawalAmount, rrspBalance)
    // Tax-free — reduces RRSP without adding to taxable income

Repayment (starting repaymentStartDelay years later, default 2):
    annualRequired = ceil(originalAmount / 15)
    repaymentMade = min(rrspContribution, annualRequired)
    taxableShortfall = max(0, annualRequired − repaymentMade)
    // Shortfall added to taxable income
    // Repayment portion of RRSP contributions does NOT generate RRSP deduction
```

Source: `index.ts` lines 652–690

### RESP CESG (Canada Education Savings Grant)

```
matchableContribution = min(respContribution, $2,500)
cesg = min(matchableContribution × 20%, $500, max(0, $7,200 − lifetimeGrants))
```

- 20% match on first $2,500 contributed per year
- Maximum $500/year
- $7,200 lifetime cap

Source: `index.ts` lines 530–535, 712–717

---

## 15. Appendix: Marginal & Average Rate Definitions

### Marginal Rate

The rate applied to the next dollar of income:

```
marginalFederalRate  = rate of the bracket containing netTaxableIncome
marginalProvincialRate = rate of the provincial bracket containing netTaxableIncome
marginalCombinedRate = marginalFederalRate + marginalProvincialRate
```

Source: `taxEngine.ts:marginalRate()` lines 25–31

### Average Income Tax Rate

```
avgIncomeTaxRate = totalIncomeTax / grossIncome
```

### Average All-In Rate

Includes CPP and EI:

```
avgAllInRate = (totalIncomeTax + totalCPPPaid + totalEI) / grossIncome
```

Source: `taxEngine.ts` lines 433–436

### P&L Tracking

Per-account book value vs market value tracking:

```
gain      = marketValue − bookValue
returnPct = gain / bookValue    (if bookValue > 0)
```

Book value uses proportional removal on withdrawals:

```
fraction = withdrawal / balanceBeforeWithdrawal
bookRemoved = bookBeforeWithdrawal × fraction
newBookValue = max(0, bookBeforeWithdrawal − bookRemoved)
```

Source: `accountEngine.ts:computeAccountPnL()` lines 192–257

---

## Cross-References

- Parameter values for all formulas: [CRA Parameters Reference](cra-parameters.md)
- Federal brackets & BPA by year: [CRA Parameters §1](cra-parameters.md#1-federal-brackets--basic-personal-amount)
- Ontario brackets & surtax: [CRA Parameters §2](cra-parameters.md#2-ontario-provincial-brackets--basic-personal-amount)
- CPP/EI rates by year: [CRA Parameters §3–4](cra-parameters.md#3-cpp--cpp2-contributions)
- Account limits: [CRA Parameters §5](cra-parameters.md#5-registered-account-limits)
- Dividend rates: [CRA Parameters §8](cra-parameters.md#8-dividend-gross-up--credit-rates-2026)
