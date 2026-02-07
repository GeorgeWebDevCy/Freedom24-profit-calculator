# Implementation Plan - Freedom24 Profit Calculator

## Goal Description
Implement the core logic for calculating realized profits, cost basis (FIFO/Avg), and fee tracking from Freedom24 Excel reports.

# Implementation Plan - Freedom24 Profit Calculator

## Goal Description
Implement the core logic for calculating realized profits, cost basis (FIFO/Avg), and fee tracking from Freedom24 Excel reports.

## User Review Required
> [!IMPORTANT]
> **Tech Stack Selection**: I am proposing **TypeScript** for the data processing engine inside the existing Electron + Vite + React app. This keeps all logic in one codebase and avoids a separate Python prototype.
> For verification, we can add unit tests with **Vitest** and use small fixture datasets in `data/`.
> **Does this sound good?**


### Feature 1: Dividend Tracking
#### [NEW] `src/lib/types.ts`
- Add `Dividend` interface.
- Add `dividends` to `CalculationResult`.

#### [MODIFY] `src/lib/calculator.ts`
- Update `loadFees` (or create `loadCashFlow`) to parse dividends.
- Look for "Dividend" in description/type.
- Sum up `total_dividends`.

#### [MODIFY] `src/components/Dashboard.tsx`
- Add a "Dividend Income" value card.
- Add a "Dividends" table below the trades table.

### Feature 2: Year-Based Filtering

## User Review Required
None. Logic updates are internal to Dashboard display.

## Proposed Changes

### `src/lib/types.ts`
#### [MODIFY] [types.ts](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/lib/types.ts)
- Add `fees: FeeRecord[]` to `CalculationResult`.

### `src/lib/calculator.ts`
#### [MODIFY] [calculator.ts](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/lib/calculator.ts)
- Return `fees` in `calculate` method.

### `src/components/Dashboard.tsx`
#### [MODIFY] [Dashboard.tsx](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/components/Dashboard.tsx)
- Extract unique years from data.
- Add Year Selector UI.
- Implement filtering logic for KPIs and Tables.
- Recalculate totals based on filtered data.

## Verification Plan

### Automated Tests
- Run `npm test` to ensure `fees` are correctly returned in `CalculationResult`.

### Manual Verification
- Upload data.
- Select different years.
- Verify that "Closed Trades", "Dividends", and "Fees" tables update.
- Verify that KPI cards update.
- Verify "All" option# Feature 3: Data Persistence

## User Review Required
None. Standard `localStorage` implementation.

## Proposed Changes

### `src/App.tsx`
#### [MODIFY] [App.tsx](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/App.tsx)
- Add `useEffect` to load data from `localStorage` on mount.
- Add `useEffect` to save data to `localStorage` on `data` change.
- Update `handleReset` to clear `localStorage`.

## Verification Plan

### Manual Verification
- Upload data.
- Reload page.
- Verify data is still displayed.
- Click "Upload New Files".
- Reload page.
- Verify user is returned to upload screen.t
#### [MODIFY] `src/components/Dashboard.tsx`
- Add a "Export Report" button.
- Use `jspdf` or `xlsx` library to generate a file containing the current view's data.

### Feature 5: Multi-Currency Support

## User Review Required
None. Internal logic update.

## Proposed Changes

### `src/lib/types.ts`
#### [MODIFY] [types.ts](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/lib/types.ts)
- Update `CalculationResult` to include `totals_by_currency: Record<string, { realized: number, dividends: number, fees: number, net: number }>`.

### `src/lib/calculator.ts`
#### [MODIFY] [calculator.ts](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/lib/calculator.ts)
- Implement `calculateTotalsByCurrency` method.
- Populate `totals_by_currency` in result.
- Handle trades, dividends, and fees per currency.

### `src/components/Dashboard.tsx`
#### [MODIFY] [Dashboard.tsx](file:///c:/Users/georg/OneDrive/Desktop/Freedom24-profit-calculator/src/components/Dashboard.tsx)
- Update KPI cards to show a breakdown by currency if multiple currencies exist, or a toggle.
- For simplicity, maybe just list the totals for each currency in the KPI card tooltip or a separate section.
- Or add a "Currency" filter dropdown next to Year.

## Verification Plan

### Automated Tests
- Test with mixed currency inputs (USD, EUR).
- Verify totals are separated correctly.

### Manual Verification
- Upload mixed currency files.
- Verify Dashboard shows correct values for each currency or converts them (if we had rates, but we don't, so separation is key).

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
