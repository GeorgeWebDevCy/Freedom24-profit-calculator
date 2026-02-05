
import pandas as pd
from datetime import datetime
from typing import List, Dict, Tuple
from .models import Trade, TradeDirection, Lot, ClosedTrade

class ProfitCalculator:
    def __init__(self):
        self.trades: List[Trade] = []
        self.fees_correction: float = 0.0
        self.realized_profits: List[ClosedTrade] = []
        self.open_positions: Dict[str, List[Lot]] = {} # Ticker -> List[Lot]

    def load_trades(self, file_path: str):
        """Loads trades from the Freedom24 'Trades' Excel file."""
        df = pd.read_excel(file_path)
        
        # Expected columns based on README: 
        # Number, Date, Settlement Date, Ticker, Direction, Quantity, Price, Amount, Fee
        
        # Basic cleanup
        df.columns = df.columns.str.strip()
        
        trades = []
        for _, row in df.iterrows():
            if pd.isna(row['Ticker']): continue
            
            try:
                # Parse date - adjust format as needed based on actual file
                # Assuming pandas parses it or it's a string
                date_val = row['Date']
                if not isinstance(date_val, (datetime, pd.Timestamp)):
                   date_val = pd.to_datetime(date_val, dayfirst=True) # Freedom24 often uses DD.MM.YYYY

                direction_str = str(row['Direction']).strip().lower()
                direction = TradeDirection.BUY if 'buy' in direction_str else TradeDirection.SELL
                
                trade = Trade(
                    date=date_val,
                    ticker=str(row['Ticker']),
                    direction=direction,
                    quantity=abs(float(row['Quantity'])),
                    price=float(row['Price']),
                    fee=abs(float(row['Fee'])), # Fees are cost, usually negative in cash flow but positive scalar here
                    amount=abs(float(row['Amount'])),
                    datetime_str=str(row['Date'])
                )
                trades.append(trade)
            except Exception as e:
                print(f"Skipping row {row}: {e}")
                
        # Sort by date
        self.trades = sorted(trades, key=lambda x: x.date)

    def calculate(self, method: str = 'FIFO'):
        """
        Calculates realized profits using FIFO or AVG method.
        method: 'FIFO' or 'AVG'
        """
        self.realized_profits = []
        self.open_positions = {}
        
        # Group by ticker to process sequentially
        trades_by_ticker = {}
        for trade in self.trades:
            if trade.ticker not in trades_by_ticker:
                trades_by_ticker[trade.ticker] = []
            trades_by_ticker[trade.ticker].append(trade)
            
        for ticker, ticker_trades in trades_by_ticker.items():
            self._process_ticker(ticker, ticker_trades, method)

    def _process_ticker(self, ticker: str, trades: List[Trade], method: str):
        ledger: List[Lot] = []
        
        for trade in trades:
            if trade.direction == TradeDirection.BUY:
                # Add to ledger
                # Cost basis per share includes purchase price + commissions
                # Note: Freedom24 'Fee' is usually total for the trade.
                unit_cost = (trade.price * trade.quantity + trade.fee) / trade.quantity
                
                lot = Lot(
                    date=trade.date,
                    quantity=trade.quantity,
                    unit_cost=unit_cost,
                    price_paid=trade.price * trade.quantity,
                    fees_paid=trade.fee
                )
                ledger.append(lot)
                
            elif trade.direction == TradeDirection.SELL:
                qty_to_sell = trade.quantity
                cost_basis = 0.0
                
                if method == 'FIFO':
                    while qty_to_sell > 0 and ledger:
                        head_lot = ledger[0]
                        if head_lot.quantity <= qty_to_sell:
                            # Consume entire lot
                            cost_basis += head_lot.quantity * head_lot.unit_cost
                            qty_to_sell -= head_lot.quantity
                            ledger.pop(0)
                        else:
                            # Consume partial lot
                            cost_basis += qty_to_sell * head_lot.unit_cost
                            head_lot.quantity -= qty_to_sell
                            qty_to_sell = 0
                            
                elif method == 'AVG':
                    # Calculate weighted average unit cost of ALL current lots
                    total_qty = sum(l.quantity for l in ledger)
                    total_cost = sum(l.quantity * l.unit_cost for l in ledger)
                    
                    if total_qty > 0:
                        avg_unit_cost = total_cost / total_qty
                        cost_basis = qty_to_sell * avg_unit_cost
                        
                        # Reduce all lots proportionally
                        ratio = (total_qty - qty_to_sell) / total_qty
                        to_remove = []
                        for lot in ledger:
                            lot.quantity *= ratio
                            if lot.quantity < 1e-9: # precision cleanup
                                to_remove.append(lot)
                        for lot in to_remove:
                            ledger.remove(lot)
                            
                # Sale Proceeds = (Price * Qty) - Sell Fees
                sale_proceeds = (trade.price * trade.quantity) - trade.fee
                realized_profit = sale_proceeds - cost_basis
                
                closed_trade = ClosedTrade(
                    ticker=ticker,
                    date=trade.date,
                    quantity=trade.quantity,
                    sell_price=trade.price,
                    sell_fees=trade.fee,
                    cost_basis=cost_basis,
                    realized_profit=realized_profit,
                    sale_proceeds=sale_proceeds,
                    method=method
                )
                self.realized_profits.append(closed_trade)
                
        self.open_positions[ticker] = ledger

    def get_total_profit(self) -> float:
        return sum(t.realized_profit for t in self.realized_profits)
