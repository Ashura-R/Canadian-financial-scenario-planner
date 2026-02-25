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

### Account Modelling
- **RRSP** — contribution room tracking, deduction scheduling, RRIF conversion at configurable age with CRA minimum withdrawal factors (ages 71–95+)
- **TFSA** — full room tracking with carry-forward accumulation and withdrawal room restoration
- **FHSA** — annual/lifetime limits, unused room carry-forward (up to $8K), disposition options (home purchase, RRSP transfer, taxable close-out)
- **Non-registered & savings accounts**
- **Per-account asset allocation** (equity / fixed income / cash) with configurable return assumptions
- **EOY balance overrides** for manual adjustments

### Retirement & Benefits
- **CPP pension** — configurable monthly amount and start age, inflation-indexed
- **OAS pension** — configurable monthly amount and start age, inflation-indexed, with clawback modelling
- **RRIF conversion** — automatic at configurable age, CRA minimum withdrawal enforcement

### Multi-Year Planning
- **Up to 50-year projections** with year-by-year data entry
- **Scheduled items** — recurring income/contributions/withdrawals with start/end years
- **Conditional scheduling** — rules that trigger based on computed values (income thresholds, net worth, age)
- **Growth rates** — fixed % or inflation-linked growth on scheduled amounts
- **Per-year rate overrides** — override inflation, equity returns, etc. for specific years
- **Real (inflation-adjusted) values** — toggle between nominal and real on all pages

### Contribution Room Tracking
- **RRSP unused room** — carry-forward from prior years, earned from income
- **TFSA unused room** — carry-forward accumulation, withdrawal room restoration next year
- **FHSA unused room** — accumulates up to $8K annual cap
- **Capital loss carry-forward** — tracked and applicable against future gains
- **Opening carry-forwards** — specify pre-existing room from before the start year

### Scenario Comparison
- **Multiple scenarios** — create, duplicate, rename, and manage side-by-side
- **Metrics diff table** — lifetime and final-year metrics with colour-coded best/worst
- **Overlay charts** — net worth, cash flow, tax burden across scenarios
- **Per-year tax and account comparison** tabs
- **localStorage persistence** — all scenarios saved automatically

### Pages

| Page | Description |
|------|-------------|
| **Overview** | Year snapshot KPIs, contribution room, account balances, 4 charts, YoY summary table |
| **Tax Detail** | Full bracket breakdowns, credits, deductions, waterfall, CPP/EI detail, Ontario surtax, OAS clawback |
| **Accounts** | Account flow tables, room tracking, net worth composition, blended returns |
| **Timeline** | Spreadsheet-style year-by-year data entry with fill-all, computed rows, contribution room |
| **Scheduling** | Rule-based recurring items with conditions, growth rates |
| **Assumptions** | All CRA parameters (lockable), brackets, rates, opening balances & carry-forwards, retirement settings |

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

## Architecture

```
cdn-tax-app/
├── src/
│   ├── engine/            # Pure computation functions (no UI dependencies)
│   │   ├── index.ts       # Main compute loop — orchestrates year-by-year calculation
│   │   ├── taxEngine.ts   # Federal/provincial tax, CPP, EI, surtax, OAS clawback
│   │   ├── accountEngine.ts  # Account balances, returns, asset allocation
│   │   ├── analyticsEngine.ts # Lifetime aggregates and cumulative series
│   │   └── validationEngine.ts # Input validation and warnings
│   ├── types/
│   │   ├── scenario.ts    # Input types (Scenario, YearData, Assumptions)
│   │   └── computed.ts    # Output types (ComputedYear, ComputedTax, etc.)
│   ├── store/
│   │   ├── ScenarioContext.tsx  # React Context + useReducer state management
│   │   └── defaults.ts    # Default assumptions, province presets, factory functions
│   ├── pages/             # Full-page views (Overview, TaxDetail, Accounts, etc.)
│   ├── components/        # Shared UI components (TopBar, PageNav, CompareModal, etc.)
│   └── utils/             # Formatters, hooks
```

### Design Decisions
- **No router** — single-page app with tab navigation (no URL routing needed)
- **Context + useReducer** — lightweight state management, no Redux
- **Pure engine functions** — all tax/account calculations are pure functions with no side effects, making them easy to test and reason about
- **localStorage persistence** — scenarios auto-save under key `cdn-tax-scenarios-v1`
- **Two-pass scheduling** — unconditional items applied first, then conditional items evaluated against pass-1 results

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

All CRA parameters are fully configurable in the Assumptions page (with lock/unlock protection for regulatory defaults).

## Tech Stack

- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[React 18](https://react.dev/)** — UI framework
- **[TypeScript](https://www.typescriptlang.org/)** — type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling
- **[Recharts](https://recharts.org/)** — charting library

## License

MIT
