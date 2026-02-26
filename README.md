# Canadian Financial Scenario Planner

A comprehensive Canadian tax and investment planning tool that models multi-year financial scenarios with full CRA tax calculations. Built for individuals who want to project their finances across decades, compare strategies, and understand the true impact of tax-sheltered accounts, investment returns, and retirement benefits.

![Vite](https://img.shields.io/badge/Vite-5.3-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)

## Features

### Tax Engine
- **Federal & provincial tax** with full bracket calculations for all 13 provinces/territories
- **CPP/CPP2** contributions (employee + self-employed), including YAMPE second ceiling
- **EI** premiums with optional self-employed opt-in
- **Dividend gross-up & tax credits** — eligible and non-eligible, with province-specific credit rates
- **Capital gains** with configurable inclusion rate and loss carry-forward tracking
- **Ontario surtax** (20% on provincial tax > $4,991, 36% on > $6,387)
- **OAS clawback** — 15% recovery tax on net income above configurable threshold
- **Employment amount credit** — federal and provincial, applied automatically when employment income > 0
- **Additional deductions & credits** — comprehensive set of CRA deductions and credits

### Account Modelling
- **RRSP** — contribution room tracking, deduction scheduling, RRIF conversion at configurable age with CRA minimum withdrawal factors (ages 71-95+)
- **TFSA** — full room tracking with carry-forward accumulation and withdrawal room restoration
- **FHSA** — annual/lifetime limits, unused room carry-forward (up to $8K), disposition options (home purchase, RRSP transfer, taxable close-out)
- **LIRA** — locked-in retirement account tracking
- **RESP** — registered education savings plan modelling
- **Non-registered & savings accounts**
- **Per-account asset allocation** (equity / fixed income / cash) with configurable return assumptions
- **EOY balance overrides** for manual adjustments
- **Adjusted Cost Base (ACB) tracking** for non-registered investments

### Retirement & Benefits
- **CPP pension** — configurable monthly amount and start age, inflation-indexed
- **OAS pension** — configurable monthly amount and start age, inflation-indexed, with clawback modelling
- **GIS (Guaranteed Income Supplement)** — income-tested benefit modelling
- **RRIF conversion** — automatic at configurable age, CRA minimum withdrawal enforcement
- **Retirement income analysis** — dedicated charts showing projected benefit income over time

### Multi-Year Planning
- **Up to 50-year projections** with year-by-year data entry
- **Scheduled items** — recurring income/contributions/withdrawals with start/end years
- **Conditional scheduling** — rules that trigger based on computed values (income thresholds, net worth, age, account balances, contribution room)
- **Percentage-based rules** — schedule amounts as a percentage of a reference value (e.g., 10% of gross income)
- **Growth rates** — fixed % or inflation-linked growth on scheduled amounts
- **Per-year rate overrides** — override inflation, equity returns, etc. for specific years
- **Real (inflation-adjusted) values** — toggle between nominal and real on all pages
- **Two-pass scheduling** — unconditional items applied first, then conditional items evaluated against pass-1 results

### Contribution Room Tracking
- **RRSP unused room** — carry-forward from prior years, earned from income
- **TFSA unused room** — carry-forward accumulation, withdrawal room restoration next year
- **FHSA unused room** — accumulates up to $8K annual cap
- **Capital loss carry-forward** — tracked and applicable against future gains
- **Opening carry-forwards** — specify pre-existing room from before the start year

### Scenario Management
- **Multiple scenarios** — create, duplicate, rename, and manage side-by-side
- **Comparison modal** — metrics diff table with colour-coded best/worst, overlay charts
- **Global What-If system** — toggle a What-If panel to fork any scenario with parameter overrides and instantly see the impact
- **Undo/redo** — full undo/redo support for scenario edits
- **localStorage persistence** — all scenarios saved automatically

### Visualization & Charts
- **Chart range selector** — 5Y / 10Y / 25Y / All controls on all chart pages
- **Tax waterfall chart** — gross income to net income breakdown
- **Income breakdown** — stacked area chart of income sources
- **Net worth projection** — multi-year line chart
- **Cumulative cash flow** — area chart tracking lifetime cash flow
- **Marginal rate chart** — federal + provincial + combined marginal rates over time
- **Account composition** — horizontal bar charts and donut pie charts showing account balances
- **Account flow charts** — grouped bars for contributions, returns, and withdrawals
- **Retirement income sources** — area chart of CPP, OAS, and GIS projections
- **KPI sparklines** — mini trend charts in overview cards, responsive to chart range

### Export & Reporting
- **PDF report generation** — multi-section report with section picker modal
- **CSV export** — export timeline and computed data

### UI & UX
- **Dark / light theme** — toggle between dark mode (Questrade-inspired) and light mode
- **Responsive tab navigation** — centered page tabs with active indicator
- **Timeline zoom** — 6 zoom levels (70%-125%) for the spreadsheet view
- **Row banding** — alternating row colours in timeline for readability
- **Keyboard navigation** — grid-style keyboard navigation in the timeline editor
- **Drag-and-drop row groups** — reorder timeline sections by dragging
- **Schedule indicators** — visual distinction between manual, scheduled, and user-overridden values in timeline cells

## Pages

| Page | Description |
|------|-------------|
| **Overview** | Hero KPIs (Gross Income, Total Tax, Net Cash Flow, Net Worth) with sparklines, contribution room, account balances, tax waterfall, income breakdown, net worth, and cash flow charts, YoY summary table |
| **Timeline** | Spreadsheet-style year-by-year data entry with fill-all, schedule overlays, computed rows, contribution room tracking, zoom controls, and row banding |
| **Tax Detail** | Full bracket breakdowns, credits, deductions, marginal rate chart with range controls, CPP/EI detail, Ontario surtax, OAS clawback, single-year and all-years views |
| **Accounts** | Account flow tables, net worth donut chart, account composition bar chart, account flow grouped chart, room tracking, blended returns |
| **Scheduling** | Rule-based recurring items with conditions, growth rates, percentage references, draft/save workflow, click-to-highlight |
| **Analysis** | Rate projections, sensitivity analysis, retirement income sources chart, optimizer suggestions |
| **Settings** | All CRA parameters (lockable), tax brackets, rates, opening balances & carry-forwards, retirement benefit configuration, province selection |

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
npm test          # run all tests
npm run test:watch # watch mode
```

## Architecture

```
cdn-tax-app/
├── src/
│   ├── engine/               # Pure computation functions (no UI dependencies)
│   │   ├── index.ts          # Main compute loop — orchestrates year-by-year calculation
│   │   ├── taxEngine.ts      # Federal/provincial tax, CPP, EI, surtax, OAS clawback
│   │   ├── accountEngine.ts  # Account balances, returns, asset allocation
│   │   ├── acbEngine.ts      # Adjusted cost base tracking for non-reg accounts
│   │   ├── analyticsEngine.ts    # Lifetime aggregates and cumulative series
│   │   ├── optimizerEngine.ts    # Optimization suggestions
│   │   ├── retirementAnalysis.ts # Retirement income projections
│   │   ├── sensitivityEngine.ts  # Sensitivity analysis (what-if parameter sweeps)
│   │   ├── validationEngine.ts   # Input validation and warnings
│   │   ├── whatIfEngine.ts       # What-If scenario forking and comparison
│   │   └── __tests__/           # Vitest test suites
│   ├── types/
│   │   ├── scenario.ts      # Input types (Scenario, YearData, Assumptions, ScheduledItem)
│   │   └── computed.ts       # Output types (ComputedYear, ComputedTax, etc.)
│   ├── store/
│   │   ├── ScenarioContext.tsx  # React Context + useReducer state management
│   │   └── defaults.ts      # Default assumptions, province presets, factory functions
│   ├── pages/                # Full-page views
│   │   ├── OverviewPage.tsx  # KPIs, charts, YoY summary
│   │   ├── TimelinePage.tsx  # Spreadsheet editor
│   │   ├── TaxDetailPage.tsx # Tax breakdown analysis
│   │   ├── AccountsPage.tsx  # Account balances and flows
│   │   ├── SchedulingPage.tsx    # Rule-based scheduling
│   │   ├── AnalysisPage.tsx  # Rates, sensitivity, retirement
│   │   └── AssumptionsPage.tsx   # Settings and CRA parameters
│   ├── components/           # Shared UI components
│   │   ├── TopBar/           # App header with navigation tabs
│   │   ├── ScenarioBar/      # Scenario management bar
│   │   ├── ScenarioEditor/   # Inline scenario editing
│   │   ├── WhatIfPanel/      # Global What-If comparison panel
│   │   ├── CompareModal/     # Multi-scenario comparison (diff table, overlay charts)
│   │   ├── RightPanel/       # Dashboard, charts (waterfall, income, net worth, cash flow)
│   │   ├── LeftPanel/        # Timeline table, assumptions panel, opening balances
│   │   ├── PageNav/          # Tab navigation types
│   │   ├── ChartRangeSelector.tsx  # 5Y/10Y/25Y/All range controls
│   │   └── PDFReportModal.tsx      # PDF export with section picker
│   ├── hooks/
│   │   ├── useTheme.ts       # Dark/light theme toggle
│   │   ├── useUndoRedo.ts    # Undo/redo state management
│   │   ├── useGridNavigation.ts  # Keyboard navigation for timeline grid
│   │   └── useChartColors.ts     # Theme-aware chart colour palettes
│   └── utils/
│       ├── formatters.ts     # Currency, percentage, number formatting
│       ├── exportCSV.ts      # CSV export utility
│       ├── pdfReport.ts      # PDF generation with jsPDF
│       ├── usePersistedState.ts  # localStorage-backed React state
│       └── usePersistedYear.ts   # Persisted year selector
```

### Design Decisions
- **No router** — single-page app with tab navigation (no URL routing needed)
- **Context + useReducer** — lightweight state management, no Redux
- **Pure engine functions** — all tax/account calculations are pure functions with no side effects, making them easy to test and reason about
- **localStorage persistence** — scenarios auto-save under key `cdn-tax-scenarios-v1`
- **Two-pass scheduling** — unconditional items applied first, then conditional items evaluated against pass-1 results
- **Theme system** — CSS custom properties (`--app-*`) for seamless dark/light switching

## Tax Calculation Defaults (2024)

| Parameter | Value |
|-----------|-------|
| Federal BPA | $15,705 |
| Federal brackets | 15% / 20.5% / 26% / 29% / 33% |
| Ontario brackets | 5.05% / 9.15% / 11.16% / 12.16% / 13.16% |
| CPP1 rate | 5.95% (employee), YMPE $68,500 |
| CPP2 rate | 4% on YMPE→YAMPE ($73,200) |
| EI rate | 1.66%, max insurable $63,200 |
| Eligible dividend gross-up | 38%, federal credit 15.0198% |
| Non-eligible dividend gross-up | 15%, federal credit 9.0301% |
| RRSP annual cap | $31,560 (18% of earned income) |
| TFSA annual limit | $7,000 |
| FHSA annual limit | $8,000, lifetime $40,000 |
| OAS clawback threshold | $86,912 |
| Ontario surtax | 20% on prov tax > $4,991, +36% on > $6,387 |

All CRA parameters are fully configurable in the Settings page (with lock/unlock protection for regulatory defaults).

## Tech Stack

- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[React 18](https://react.dev/)** — UI framework
- **[TypeScript](https://www.typescriptlang.org/)** — type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling
- **[Recharts](https://recharts.org/)** — charting library
- **[jsPDF](https://github.com/parallax/jsPDF)** + **[jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)** — PDF report generation
- **[Vitest](https://vitest.dev/)** — unit testing framework

## License

MIT
