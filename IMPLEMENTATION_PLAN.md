# Implementation Plan - Freedom24 Profit Calculator

## Goal Description
Implement the core logic for calculating realized profits, cost basis (FIFO/Avg), and fee tracking from Freedom24 Excel reports.

## User Review Required
> [!IMPORTANT]
> **Tech Stack Selection**: I am proposing **TypeScript** for the data processing engine inside the existing Electron + Vite + React app. This keeps all logic in one codebase and avoids a separate Python prototype.
> For verification, we can add unit tests with **Vitest** and use small fixture datasets in `data/`.
> **Does this sound good?**

## Proposed Changes

### Core Logic (`src/`)
#### [NEW] `src/lib/calculator.ts`
- Implements `ProfitCalculator` class.
- Methods: `load_data()`, `calculate_FIFO()`, `calculate_AvgCost()`.

#### [NEW] `src/lib/models.ts`
- TypeScript types for `Trade`, `Position`, `Report`.

### Testing (`tests/`)
#### [NEW] `test/calculator.test.ts`
- Unit tests for FIFO logic (buy, buy, sell partial, sell remainder).
- Unit tests for Avg Cost logic.
- Integration tests with dummy Excel files.

### Data
#### [NEW] `data/dummy_trades.xlsx` & `data/dummy_fees.xlsx`
- Handmade Excel files to verify calculations against known expected results.

## Verification Plan

### Automated Tests
- Run `npm test` to execute all unit tests.

### Manual Verification
1.  Run the script against the dummy data.
2.  Manually calculate the expected profit for a specific scenario (e.g., "Buy 10 @ $100, Buy 10 @ $200, Sell 10 @ $180").
3.  Compare script output with manual calculation.
