# Freedom24 Profit Calculator

Desktop app for calculating realized profit from Freedom24 Excel reports. Built with Electron + Vite + React.

## Features
- Import Freedom24 trade history and funds movement Excel files.
- Calculate realized profit using FIFO or Average Cost.
- Track commissions and standalone trading fees.
- Summaries by ticker and overall.

## Quick Start
```sh
npm install
npm run dev
```

## Project Scripts
- `npm run dev` starts Vite and launches the Electron app in development.
- `npm run build` builds the renderer, main/preload, and creates an Electron package.
- `npm run test` runs unit tests with Vitest.
- `npm run preview` previews the production renderer build.

## Data Inputs
Provide the two Freedom24 exports:
- Trade history report (`Trades (1).xlsx`).
- Funds movement report (`tradernet_table.xlsx`).

If your export names differ, the app will still work as long as the expected columns exist.
