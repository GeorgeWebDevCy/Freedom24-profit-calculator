# Implementation Plan - Freedom24 Profit Calculator

## Goal Description
Implement the core logic for calculating realized profits, cost basis (FIFO/Avg), and fee tracking from Freedom24 Excel reports.

## User Review Required
> [!IMPORTANT]
> **Tech Stack Selection**: I am proposing **Python** with **Pandas** for the data processing engine. It is robust, easy to test, and handles Excel files natively.
> For the User Interface, I propose starting with a **Command Line Interface (CLI)** to verify the math is 100% correct. Later, we can wrap this in a **Flet** (Flutter for Python) or **Streamlit** app for a nice GUI.
> **Does this sound good?**

## Proposed Changes

### Core Logic (`src/`)
#### [NEW] `src/calculator.py`
- Implements `ProfitCalculator` class.
- Methods: `load_data()`, `calculate_FIFO()`, `calculate_AvgCost()`.

#### [NEW] `src/models.py`
- Data classes for `Trade`, `Position`, `Report`.

### Testing (`tests/`)
#### [NEW] `tests/test_calculator.py`
- Unit tests for FIFO logic (buy, buy, sell partial, sell remainder).
- Unit tests for Avg Cost logic.
- Integration tests with dummy Excel files.

### Data
#### [NEW] `data/dummy_trades.xlsx` & `data/dummy_fees.xlsx`
- Handmade Excel files to verify calculations against known expected results.

## Verification Plan

### Automated Tests
- Run `pytest` to execute all unit tests.
- Example command: `pytest -v`

### Manual Verification
1.  Run the script against the dummy data.
2.  Manually calculate the expected profit for a specific scenario (e.g., "Buy 10 @ $100, Buy 10 @ $200, Sell 10 @ $180").
3.  Compare script output with manual calculation.
