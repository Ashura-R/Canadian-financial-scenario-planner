# Canadian Financial Scenario Planner

A comprehensive Canadian tax and investment planning tool that models multi-year financial scenarios with full CRA tax calculations. Built for individuals who want to project their finances across decades, compare strategies, and understand the true impact of tax-sheltered accounts, investment returns, and retirement benefits.

![Vite](https://img.shields.io/badge/Vite-5.3-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-198_passing-brightgreen)

## Features

### Tax Engine
- **Federal & provincial tax** with full bracket calculations for all 13 provinces/territories
- **Historical CRA parameters (1990–2025)** — auto-loaded from `historicalAssumptions.ts`, merged as overrides so past years use actual CRA values
- **Auto-indexing** — future-year tax brackets, BPA, YMPE, etc. are automatically indexed to inflation; manual overrides per year are also supported
- **CPP/CPP2** contributions (employee + self-employed), including YAMPE second ceiling
- **EI** premiums with optional self-employed opt-in
- **Dividend gross-up & tax credits** — eligible and non-eligible, with province-specific credit rates
- **Capital gains** with configurable inclusion rate and loss carry-forward tracking
- **Ontario surtax** (20% on provincial tax > $4,991, 36% on > $6,387)
- **Ontario Health Premium** — income-based provincial health levy
- **Quebec abatement** — 16.5% federal tax reduction for Quebec residents
- **OAS clawback** — 15% recovery tax on net income above configurable threshold
- **Alternative Minimum Tax (AMT)** — computed and applied when it exceeds regular tax
- **Canada Workers Benefit (CWB)** — refundable credit for low-income earners
- **Foreign tax credit** — federal and provincial foreign tax credit calculation
- **Employment amount credit** — federal and provincial, applied automatically when employment income > 0
- **Disability Tax Credit (DTC)** — federal and provincial
- **Medical expense credit, student loan interest credit, Home Buyers' credit**
- **Donation credits** — tiered federal and provincial rates
- **Age credit** — income-tested, with clawback for higher earners
- **Pension income credit** — federal and provincial

### Account Modelling
- **RRSP** — contribution room tracking, deduction scheduling, RRIF conversion at configurable age with CRA minimum withdrawal factors (ages 71–95+)
- **TFSA** — full room tracking with carry-forward accumulation, withdrawal room restoration, and auto-computed accumulated room from age 18 using historical contribution limits
- **FHSA** — annual/lifetime limits, unused room carry-forward (up to $8K), disposition options (home purchase, RRSP transfer, taxable close-out), 15-year/age-71 auto-close
- **LIRA** — locked-in retirement account with LIF conversion, min/max withdrawal enforcement
- **RESP** — registered education savings plan with CESG grant tracking (lifetime limits)
- **Non-registered** — full ACB (adjusted cost base) tracking, per-unit ACB, realized capital gains on withdrawals
- **Savings account** — separate from non-reg, for cash/emergency funds
- **Life insurance** — cash value tracking with insurance-specific ACB (premiums, COI deductions, surrender gains)
- **Per-account asset allocation** (equity / fixed income / cash) with configurable return assumptions
- **Per-account P&L tracking** — book value, market value, unrealized gain, return percentage for every account every year
- **EOY balance overrides** for manual adjustments
- **Home Buyers' Plan (HBP)** — RRSP tax-free withdrawal with 15-year repayment tracking, shortfall added to taxable income

### Living Expenses & Debt
- **Expense categories** — housing, transportation, food, healthcare, personal, childcare, education, insurance, entertainment, miscellaneous, and custom categories
- **Budget vs. deductible views** — see total living expenses and tax-deductible portions
- **Debt tracking** — per-liability modelling with opening balance, interest rate, payment schedule, and deductible interest on investment loans
- **Waterfall integration** — expenses flow into the after-tax waterfall (after-tax income → after expenses → net cash flow)

### Retirement & Benefits
- **CPP pension** — configurable monthly amount and start age (60–70), inflation-indexed
- **OAS pension** — configurable monthly amount and start age (65–70), inflation-indexed, with clawback modelling
- **GIS (Guaranteed Income Supplement)** — income-tested benefit modelling
- **RRIF conversion** — automatic at configurable age, CRA minimum withdrawal enforcement
- **LIF conversion** — LIRA to LIF with min/max withdrawal enforcement (federal formula)
- **CPP/OAS deferral analysis** — compare cumulative benefits by start age, with break-even age calculations

### Multi-Year Planning
- **Up to 50-year projections** with year-by-year data entry
- **Scheduled items** — recurring income/contributions/withdrawals with start/end years
- **Conditional scheduling** — rules that trigger based on computed values (income thresholds, net worth, age, account balances, contribution room)
- **Percentage-based rules** — schedule amounts as a percentage of a reference value (e.g., 10% of gross income)
- **Growth rates** — fixed % or inflation-linked growth on scheduled amounts
- **Per-year assumption overrides** — override inflation, equity returns, fixed income returns, etc. for specific years with auto-indexing from a base
- **Real (inflation-adjusted) values** — toggle between nominal and real on all pages, with per-account deflation
- **Two-pass scheduling** — unconditional items applied first, then conditional items evaluated against pass-1 results

### Contribution Room Tracking
- **RRSP unused room** — carry-forward from prior years, earned from income
- **TFSA unused room** — carry-forward accumulation, withdrawal room restoration next year, historical room computed from age 18
- **FHSA unused room** — accumulates up to $8K annual cap, lifetime $40K cap
- **Capital loss carry-forward** — tracked and applicable against future gains

### Advanced Analysis
- **Lifetime tax efficiency** — cumulative tax vs. after-tax income, effective tax rate over time
- **Marginal rate timeline** — federal, provincial, and combined marginal rates over time
- **CPP/OAS deferral comparison** — cumulative benefit charts and tables for different start ages with break-even analysis
- **Sensitivity analysis** — equity return offset sweeps (-4% to +4%) showing net worth fan chart and impact on lifetime tax
- **Investment projection** — stacked area chart of per-account balances with toggles for after-inflation (real) and after-tax values, summary table with CAGR and net growth per account
- **Monte Carlo simulation** — seeded PRNG (xoshiro128**), normal distribution sampling, N-trial simulation (10–2000 trials) producing p10/p25/p50/p75/p90 percentile bands, fan charts for net worth and after-tax income, histogram of final net worth distribution, probability of ruin
- **Withdrawal strategy comparison** — RRIF-first, non-reg-first, TFSA-first, and equal-split strategies with lifetime tax, after-tax income, and final net worth comparison

### Scenario Management
- **Multiple scenarios** — create, duplicate, rename, and manage side-by-side
- **Comparison modal** — unified single-page view with transposed metrics tables and overlay charts, colour-coded best/worst indicators
- **Global What-If system** — ~45 adjustable controls across 7 collapsible sections (income, deductions, accounts, tax parameters, retirement, returns, expenses) with 7 built-in presets (e.g., "Job Loss", "Market Crash", "Early Retirement"), debounced compute, instant visual comparison
- **Undo/redo** — full undo/redo support for scenario edits
- **localStorage persistence** — all scenarios saved automatically under key `cdn-tax-scenarios-v1`
- **JSON import/export** — export scenarios to JSON files, import from file

### Visualization & Charts
- **Chart range selector** — 5Y / 10Y / 25Y / All controls on all chart pages
- **Tax waterfall chart** — gross income to net income breakdown
- **Income breakdown** — stacked area chart of income sources (deflated in real mode)
- **Net worth projection** — multi-year line chart (nominal and real)
- **Cumulative cash flow** — area chart tracking lifetime cash flow
- **Marginal rate chart** — federal + provincial + combined marginal rates over time
- **Account composition** — horizontal bar charts and donut pie charts showing account balances
- **Account flow charts** — grouped bars for contributions, returns, and withdrawals
- **P&L charts** — book value vs. market value and gain charts per account over time
- **Retirement income sources** — area chart of CPP, OAS, and GIS projections
- **Investment projection** — stacked area chart of per-account balances with real/after-tax toggles
- **Monte Carlo fan charts** — percentile band charts and final distribution histogram
- **Sensitivity fan chart** — net worth under different return assumptions
- **KPI sparklines** — mini trend charts in overview cards, responsive to chart range
- **Cashflow vs. expenses chart** — side-by-side comparison on the overview

### Export & Reporting
- **PDF report generation** — multi-section report with section picker modal, includes all pages (overview, timeline, tax detail, accounts, expenses, analysis, warnings)
- **CSV export** — export timeline and computed data

### UI & UX
- **Dark / light theme** — toggle between dark mode (Questrade-inspired) and light mode with CSS custom properties
- **Responsive tab navigation** — centered page tabs with active indicator
- **Disclaimer banner** — dismissible notice about estimates vs. professional advice
- **Timeline zoom** — 6 zoom levels (70%–125%) for the spreadsheet view
- **Row banding** — alternating row colours in timeline for readability
- **Keyboard navigation** — grid-style keyboard navigation in the timeline editor (arrow keys, Enter to edit, Escape to cancel, Ctrl+X cut support)
- **Drag-and-drop row groups** — reorder timeline sections by dragging
- **Schedule indicators** — visual distinction between manual, scheduled, and user-overridden values in timeline cells
- **Timeline warning tooltips** — hover over cells with validation issues to see details
- **Contextual KPI sub-text** — overview cards show helpful context (base year indicator, inflation note)
- **Persisted UI state** — chart ranges, toggle states, and collapsed sections persist across sessions

## Pages

| Page | Description |
|------|-------------|
| **Overview** | Hero KPIs (Gross Income, Total Tax, Net Cash Flow, Net Worth) with sparklines, contribution room, account balances, tax waterfall, income breakdown, net worth, cash flow, and cashflow-vs-expenses charts, YoY summary table |
| **Timeline** | Spreadsheet-style year-by-year data entry with fill-all, schedule overlays, computed rows, CRA assumptions group, contribution room tracking, P&L tracking, zoom controls, row banding, and warning tooltips |
| **Tax Detail** | Full bracket breakdowns, credits, deductions, marginal rate chart with range controls, CPP/EI detail, Ontario surtax, Quebec abatement, OAS clawback, AMT, single-year and all-years views |
| **Accounts** | Account flow tables, net worth donut chart, account composition bar chart, account flow grouped chart, P&L book vs. market charts, room tracking, blended returns |
| **Expenses** | Living expense categories (budget, deductible, debt views), per-year breakdown, total cost tracking, debt amortization |
| **Scheduling** | Rule-based recurring items with conditions, growth rates, percentage references, draft/save workflow, click-to-highlight |
| **Analysis** | Lifetime tax efficiency, marginal rate timeline, CPP/OAS deferral analysis, sensitivity analysis, investment projection (with real/after-tax toggles), Monte Carlo simulation, withdrawal strategy comparison |
| **Warnings** | Aggregated validation warnings and errors across all years, with severity indicators |
| **Settings** | All CRA parameters (lockable), tax brackets, rates, opening balances & carry-forwards, retirement benefit configuration, province selection, per-year assumption overrides |

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/Ashura-R/Canadian-financial-scenario-planner.git
cd Canadian-financial-scenario-planner/cdn-tax-app
npm install
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

### Production Build

```bash
npm run build
npm run preview
```

### Testing

```bash
npm test          # run all tests (198 tests across 14 suites)
npm run test:watch # watch mode
```

## Architecture

```
cdn-tax-app/
├── src/
│   ├── engine/                    # Pure computation functions (no UI dependencies)
│   │   ├── index.ts               # Main compute loop — orchestrates year-by-year calculation
│   │   ├── taxEngine.ts           # Federal/provincial tax, CPP, EI, surtax, OAS clawback, AMT
│   │   ├── accountEngine.ts       # Account balances, returns, asset allocation, P&L tracking
│   │   ├── acbEngine.ts           # Adjusted cost base tracking for non-reg and life insurance
│   │   ├── analyticsEngine.ts     # Lifetime aggregates and cumulative series
│   │   ├── assumptionResolver.ts  # Per-year assumption resolution (auto-indexing + overrides)
│   │   ├── monteCarloEngine.ts    # Monte Carlo simulation with seeded PRNG
│   │   ├── optimizerEngine.ts     # Withdrawal strategy comparison
│   │   ├── retirementAnalysis.ts  # CPP/OAS deferral analysis with break-even
│   │   ├── sensitivityEngine.ts   # Sensitivity analysis (return offset sweeps)
│   │   ├── tfsaRoom.ts            # Historical TFSA room computation from age 18
│   │   ├── validationEngine.ts    # Input validation and warnings
│   │   ├── whatIfEngine.ts        # What-If scenario forking and adjustment application
│   │   ├── whatIfPresets.ts        # 7 built-in What-If presets
│   │   └── __tests__/             # 14 Vitest test suites (198 tests)
│   ├── data/
│   │   └── historicalAssumptions.ts  # CRA parameters 1990–2025 (brackets, BPA, YMPE, etc.)
│   ├── types/
│   │   ├── scenario.ts            # Input types (Scenario, YearData, Assumptions, ScheduledItem, MonteCarloConfig)
│   │   └── computed.ts            # Output types (ComputedYear, ComputedTax, AccountPnL, etc.)
│   ├── store/
│   │   ├── ScenarioContext.tsx    # React Context + useReducer state management
│   │   └── defaults.ts            # Default assumptions, all 13 province presets, factory functions
│   ├── pages/
│   │   ├── OverviewPage.tsx       # KPIs, sparklines, charts, YoY summary
│   │   ├── TimelinePage.tsx       # Spreadsheet editor with scheduling overlays
│   │   ├── TaxDetailPage.tsx      # Tax breakdown analysis (single-year + all-years)
│   │   ├── AccountsPage.tsx       # Account balances, flows, P&L charts
│   │   ├── ExpensesPage.tsx       # Living expenses and debt tracking
│   │   ├── SchedulingPage.tsx     # Rule-based scheduling management
│   │   ├── AnalysisPage.tsx       # Advanced analysis (7 sections)
│   │   ├── AssumptionsPage.tsx    # Settings and CRA parameters
│   │   └── WarningsPage.tsx       # Validation warnings aggregation
│   ├── components/
│   │   ├── TopBar/                # App header with navigation tabs
│   │   ├── ScenarioBar/           # Scenario management bar (tabs, duplicate, compare, export/import)
│   │   ├── ScenarioEditor/        # Inline scenario editing
│   │   ├── WhatIfPanel/           # Global What-If comparison panel (~45 controls, 7 presets)
│   │   ├── CompareModal/          # Multi-scenario comparison (transposed tables, overlay charts)
│   │   ├── RightPanel/            # Dashboard charts (waterfall, income, net worth, cash flow)
│   │   ├── LeftPanel/             # Timeline table, assumptions panel, opening balances
│   │   ├── PageNav/               # Tab navigation types
│   │   ├── ChartRangeSelector.tsx # 5Y/10Y/25Y/All range controls
│   │   └── PDFReportModal.tsx     # PDF export with section picker
│   ├── hooks/
│   │   ├── useTheme.ts            # Dark/light theme toggle
│   │   ├── useUndoRedo.ts         # Undo/redo state management
│   │   ├── useGridNavigation.ts   # Keyboard navigation for timeline grid
│   │   └── useChartColors.ts      # Theme-aware chart colour palettes
│   └── utils/
│       ├── formatters.ts          # Currency, percentage, number formatting
│       ├── exportCSV.ts           # CSV export utility
│       ├── pdfReport.ts           # PDF generation with jsPDF
│       ├── usePersistedState.ts   # localStorage-backed React state
│       └── usePersistedYear.ts    # Persisted year selector
```

### Design Decisions
- **No router** — single-page app with tab navigation (no URL routing needed)
- **Context + useReducer** — lightweight state management, no Redux
- **Pure engine functions** — all tax/account calculations are pure functions with no side effects, making them easy to test and reason about
- **localStorage persistence** — scenarios auto-save under key `cdn-tax-scenarios-v1`
- **Two-pass scheduling** — unconditional items applied first, then conditional items evaluated against pass-1 results
- **Historical + auto-indexing** — past years use actual CRA values; future years auto-index from a base using the inflation rate, with manual overrides available per year
- **Theme system** — CSS custom properties (`--app-*`) for seamless dark/light switching
- **Persisted UI state** — chart ranges, toggles, and collapsed sections survive page refreshes via `usePersistedState`

## Tax Calculation Defaults (2026)

| Parameter | Value |
|-----------|-------|
| Federal BPA | $16,452 |
| Federal brackets | 14% / 20.5% / 26% / 29% / 33% |
| Ontario brackets | 5.05% / 9.15% / 11.16% / 12.16% / 13.16% |
| Ontario BPA | $12,989 |
| CPP1 rate | 5.95% (employee), YMPE $74,600 |
| CPP2 rate | 4% on YMPE→YAMPE ($85,000) |
| EI rate | 1.63%, max insurable $68,900 |
| RRSP annual cap | $33,810 (18% of earned income) |
| TFSA annual limit | $7,000 |
| FHSA annual limit | $8,000, lifetime $40,000 |
| Capital gains inclusion rate | 50% |
| OAS clawback threshold | $93,454 |
| Eligible dividend gross-up | 38%, federal credit 15.0198% |
| Non-eligible dividend gross-up | 15%, federal credit 9.0301% |
| Ontario surtax | 20% on prov tax > $4,991, +36% on > $6,387 |

All CRA parameters are fully configurable in the Settings page (with lock/unlock protection for regulatory defaults). Historical values for 1990–2025 are built in and applied automatically.

## Tech Stack

- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[React 18](https://react.dev/)** — UI framework
- **[TypeScript](https://www.typescriptlang.org/)** — type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling
- **[Recharts](https://recharts.org/)** — charting library
- **[jsPDF](https://github.com/parallax/jsPDF)** + **[jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)** — PDF report generation
- **[Vitest](https://vitest.dev/)** — unit testing framework (198 tests, 14 suites)

## License

MIT
