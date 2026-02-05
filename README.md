<<<<<<< HEAD
# electron-vite-react

[![awesome-vite](https://awesome.re/mentioned-badge.svg)](https://github.com/vitejs/awesome-vite)
![GitHub stars](https://img.shields.io/github/stars/caoxiemeihao/vite-react-electron?color=fa6470)
![GitHub issues](https://img.shields.io/github/issues/caoxiemeihao/vite-react-electron?color=d8b22d)
![GitHub license](https://img.shields.io/github/license/caoxiemeihao/vite-react-electron)
[![Required Node.JS >= 14.18.0 || >=16.0.0](https://img.shields.io/static/v1?label=node&message=14.18.0%20||%20%3E=16.0.0&logo=node.js&color=3f893e)](https://nodejs.org/about/releases)

English | [简体中文](README.zh-CN.md)

## 👀 Overview

📦 Ready out of the box  
🎯 Based on the official [template-react-ts](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts), project structure will be familiar to you  
🌱 Easily extendable and customizable  
💪 Supports Node.js API in the renderer process  
🔩 Supports C/C++ native addons  
🐞 Debugger configuration included  
🖥 Easy to implement multiple windows  

## 🛫 Quick Setup

```sh
# clone the project
git clone https://github.com/electron-vite/electron-vite-react.git

# enter the project directory
cd electron-vite-react

# install dependency
npm install

# develop
npm run dev
```

## 🐞 Debug

![electron-vite-react-debug.gif](/electron-vite-react-debug.gif)

## 📂 Directory structure

Familiar React application structure, just with `electron` folder on the top :wink:  
*Files in this folder will be separated from your React application and built into `dist-electron`*  

```tree
├── electron                                 Electron-related code
│   ├── main                                 Main-process source code
│   └── preload                              Preload-scripts source code
│
├── release                                  Generated after production build, contains executables
│   └── {version}
│       ├── {os}-{os_arch}                   Contains unpacked application executable
│       └── {app_name}_{version}.{ext}       Installer for the application
│
├── public                                   Static assets
└── src                                      Renderer source code, your React application
```

<!--
## 🚨 Be aware

This template integrates Node.js API to the renderer process by default. If you want to follow **Electron Security Concerns** you might want to disable this feature. You will have to expose needed API by yourself.  

To get started, remove the option as shown below. This will [modify the Vite configuration and disable this feature](https://github.com/electron-vite/vite-plugin-electron-renderer#config-presets-opinionated).

```diff
# vite.config.ts

export default {
  plugins: [
    ...
-   // Use Node.js API in the Renderer-process
-   renderer({
-     nodeIntegration: true,
-   }),
    ...
  ],
}
```
-->

## 🔧 Additional features

1. electron-updater 👉 [see docs](src/components/update/README.md)
1. playwright

## ❔ FAQ

- [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
- [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)
=======
Building a Freedom24 Profit‑Calculation App
Overview

Freedom24 provides two kinds of Excel reports that capture a user’s trading activity:

Report	Purpose	Key columns
Trade history (Trades (1).xlsx)	Contains every buy/sell order executed through the broker. Each row describes one trade.	Number, Date, Settlement Date, Ticker, Direction (buy or sell), Quantity, Price (per share), Amount (transaction value), Profit (always zero in the downloaded file), Fee (brokerage commission and exchange fees).
Funds movement (tradernet_table.xlsx)	Shows money movements into/out of the account and non‑trade charges.	Date, Direction (e.g., Trading fee, Bank transfer, Card payment, etc.), Comment (description), Amount (positive or negative cash flow), Currency. Entries with a negative amount labeled Trading fee correspond to commissions or other charges that are not included in the trade history, while Bank transfer entries are deposits/withdrawals.

The objective is to calculate the realized profit for each closed position and the overall portfolio by reading these two reports. Realized profit is the difference between what you received when selling shares and what you paid to acquire them, minus all associated fees. According to financial literature, the cost basis for a purchase is defined as the purchase price multiplied by the number of shares plus any commissions or fees. When you sell, the basic profit formula is:

Profit = (Sell price − Buy price) × Number of shares − Buy commission − Sell commission:contentReference[oaicite:1]{index=1}


Brokers often pool multiple purchase lots using average cost or FIFO. Freedom24 does not compute profits in the report, so the application must implement a consistent method itself. Average cost pools all purchases and computes a single per‑share cost; FIFO uses the oldest lot first. Both methods are acceptable; average cost is simpler, while FIFO may be required in some jurisdictions. The report uses euros; however the logic is currency‑agnostic.

Data ingestion

Parse the Excel files: Use a library capable of reading .xlsx files on the target platform:

JavaScript/TypeScript: use xlsx
 to read Excel files; it works in Node.js, React Native and browsers.

Dart/Flutter: use excel
 or syncfusion_flutter_xlsio to load spreadsheets.

Python: use pandas.read_excel() for prototyping or backend services.

.NET / C#: use EPPlus or ClosedXML.

Normalize columns:

Trim whitespace from Direction values (" Buy " / " Sell ") and convert to a consistent enumeration.

Convert date strings to Date objects, taking into account the user’s timezone (Asia/Nicosia) when necessary.

Parse numeric columns (Quantity, Price, Amount, Fee) as floating‑point numbers; multiply Quantity and Price to cross‑check against Amount because rounding differences may occur.

Aggregate trading fees:

The Fee column of the trade history includes per‑trade commissions; the tradernet_table.xlsx file also lists additional fees (e.g., platform fees) as negative amounts with Direction = Trading fee. Add these standalone fees to the total cost basis of the corresponding trades (matching by date or by trading period). A simple approach is to sum all entries labeled Trading fee and subtract them from the overall profit.

Profit‑calculation algorithm

The app should support both average cost and FIFO. The core steps are:

Group trades by ticker. Sort each group by Date (ascending).

Maintain a ledger of open positions. Each open position entry contains quantity, unit_cost and associated fees. When a buy order is encountered, append a new lot to the ledger with quantity and unit_cost = (price × quantity + fee) / quantity.

Handle a sell order:

Determine the number of shares to close (sell_quantity).

Retrieve lots from the ledger using either FIFO or weighted average:

FIFO: remove shares from the oldest lot(s) until the sell_quantity is depleted; for each lot, compute cost_of_sold_shares = unit_cost × shares_sold. Sum these costs to obtain the cost basis.

Average cost: compute the weighted average cost of all open lots: avg_cost = (sum(unit_cost × quantity) ÷ total_quantity). Multiply avg_cost by sell_quantity for the cost basis and reduce the total quantity accordingly.

Compute sale proceeds: sale_proceeds = sell_price × sell_quantity − sell_fee. Use the Fee column for sell_fee; if Freedom24 charges per‑trade fees separate from per‑share fees, multiply accordingly.

Realized profit for the sell transaction: sale_proceeds − cost_basis.

Adjust for standalone fees from the tradernet_table.xlsx file by subtracting the sum of Trading fee amounts.

Unrealized positions remain in the ledger after processing all trades; these represent open positions and should not be counted in realized profit.

Example implementation (pseudo‑code)
# trades: list of rows from Trades.xlsx
# fees: sum of standalone trading fees from tradernet_table.xlsx
ledger = []        # list of {quantity, unit_cost}
realized_profit = 0

for trade in trades_sorted_by_date:
    qty = trade.quantity
    fee = trade.fee
    if trade.direction == 'Buy':
        unit_cost = (trade.price * qty + fee) / qty
        ledger.append({ 'quantity': qty, 'unit_cost': unit_cost })
    else:  # Sell
        sell_price = trade.price
        sell_fee = fee
        remaining_qty = qty
        cost_basis = 0
        if method == 'FIFO':
            while remaining_qty > 0:
                lot = ledger[0]
                take_qty = min(remaining_qty, lot['quantity'])
                cost_basis += take_qty * lot['unit_cost']
                lot['quantity'] -= take_qty
                if lot['quantity'] == 0:
                    ledger.pop(0)
                remaining_qty -= take_qty
        else:  # average cost
            total_qty = sum(lot['quantity'] for lot in ledger)
            avg_cost = sum(lot['quantity'] * lot['unit_cost'] for lot in ledger) / total_qty
            cost_basis = avg_cost * qty
            # reduce quantities proportionally
            for lot in ledger:
                lot_share = lot['quantity'] / total_qty
                lot['quantity'] -= lot_share * qty
            ledger = [lot for lot in ledger if lot['quantity'] > 1e-8]
        sale_proceeds = sell_price * qty - sell_fee
        realized_profit += sale_proceeds - cost_basis

# subtract standalone fees
realized_profit -= fees

Handling dividends and other income

Freedom24 reports may include dividends or interest in other files. If you want to include total return, add dividends received to sale proceeds. The Bitget guide notes that total return should include dividends, fees and taxes. Adjust the cost basis when reinvested dividends purchase additional shares.

Application architecture

To make the application cross‑platform (desktop and mobile), consider these choices:

Front‑end framework
Framework	Pros	Cons
Flutter (Dart)	Builds native mobile and desktop apps from one codebase; strong support for charts, file pickers and Excel packages; compiled code gives good performance.	Larger binary size; fewer third‑party packages than JavaScript ecosystem.
React Native (JavaScript/TypeScript)	Large ecosystem; can share code between web, iOS and Android; libraries like react-native-fs and xlsx can handle file import and parsing.	Need to bridge some native modules; performance may lag for computation‑heavy tasks unless offloaded to a native module or WebAssembly.
Electron + React/Vue	Easiest route for desktop app; uses web technologies; packages like xlsx and chart.js provide Excel parsing and visualization.	Heavy memory footprint; not optimal for mobile.

For a single codebase across desktop and mobile, Flutter or React Native are recommended. Flutter’s excel package can read and write .xlsx files; React Native can leverage the SheetJS library.

Backend / business logic

It is advisable to implement the profit‑calculation logic in a plain language (TypeScript, Dart or Python) that is portable across platforms. Encapsulate this logic in a service module that takes parsed trade and fee records and returns:

Realized profit per ticker and overall.

List of open positions with average cost and quantity.

Cash flow summary (deposits, withdrawals, standalone fees).

This service can then be shared between the mobile/desktop front‑end and any backend (e.g., a serverless function or local Node.js script) to verify results.

User interface suggestions

File import: Provide a button allowing users to select the two Excel files. Validate that the files contain the expected columns. Optionally allow drag‑and‑drop.

Settings: Let users choose the cost‑basis method (Average cost vs. FIFO) and the base currency (if multi‑currency support is implemented). Provide an option to include or exclude standalone fees.

Results view:

Summary dashboard: show total realized profit, cash balance, and number of open positions.

Detailed table: list each closed trade with columns for ticker, quantity sold, sale proceeds, cost basis, fees and profit. Include filters by ticker or date range.

Charts: optional line or bar charts showing cumulative profit over time or per ticker.

Export: Allow exporting the calculated results to CSV or Excel for record‑keeping or tax reporting.

Final remarks

Building a profit‑calculation tool for Freedom24 requires careful handling of trade records, fees and cost‑basis methods. The sample Excel files show that each trade already contains transaction values and fees, but profit is not computed. By grouping trades, tracking lots and subtracting all related fees, the application can compute realized gains and produce meaningful reports. Refer to widely accepted financial formulas when implementing the calculations: cost basis includes purchase price and commissions, and realized profit equals sale proceeds minus purchase cost and fees. Always adjust for dividends and other income when calculating total return.
>>>>>>> 6a10b745a08c1746df4fa9a00e62eb5d6f0ba2f7
