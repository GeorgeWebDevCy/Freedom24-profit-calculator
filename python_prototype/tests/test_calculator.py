
import pytest
from datetime import datetime
from src.models import Trade, TradeDirection
from src.calculator import ProfitCalculator

@pytest.fixture
def calculator():
    return ProfitCalculator()

def create_trade(date_str, ticker, direction, qty, price, fee=0.0):
    return Trade(
        date=datetime.strptime(date_str, "%Y-%m-%d"),
        ticker=ticker,
        direction=direction,
        quantity=qty,
        price=price,
        fee=fee,
        amount=qty*price
    )

def test_fifo_simple(calculator):
    # Buy 10 @ 100, Sell 10 @ 150
    t1 = create_trade("2023-01-01", "AAPL", TradeDirection.BUY, 10, 100.0, 5.0) # Cost basis = 1000 + 5 = 1005 (100.5/share)
    t2 = create_trade("2023-01-02", "AAPL", TradeDirection.SELL, 10, 150.0, 5.0) # Proceeds = 1500 - 5 = 1495
    
    calculator.trades = [t1, t2]
    calculator.calculate(method='FIFO')
    
    assert len(calculator.realized_profits) == 1
    profit = calculator.realized_profits[0]
    
    # Expected: 1495 - 1005 = 490
    assert profit.realized_profit == 490.0

def test_fifo_multiple_buys(calculator):
    # Buy 10 @ 100 (Fee 0)
    # Buy 10 @ 200 (Fee 0)
    # Sell 15 @ 180 (Fee 0)
    
    # FIFO Cost Basis:
    # 10 shares from Lot 1 @ 100 = 1000
    # 5 shares from Lot 2 @ 200 = 1000
    # Total Cost = 2000
    
    # Proceeds: 15 * 180 = 2700
    # Profit: 700
    
    t1 = create_trade("2023-01-01", "AAPL", TradeDirection.BUY, 10, 100.0)
    t2 = create_trade("2023-01-02", "AAPL", TradeDirection.BUY, 10, 200.0)
    t3 = create_trade("2023-01-03", "AAPL", TradeDirection.SELL, 15, 180.0)
    
    calculator.trades = [t1, t2, t3]
    calculator.calculate(method='FIFO')
    
    assert calculator.realized_profits[0].realized_profit == 700.0
    
def test_avg_cost(calculator):
    # Buy 10 @ 100
    # Buy 10 @ 200
    # Average Cost = (1000 + 2000) / 20 = 150 per share
    
    # Sell 15 @ 180
    # Cost Basis = 15 * 150 = 2250
    # Proceeds = 2700
    # Profit = 450
    
    t1 = create_trade("2023-01-01", "AAPL", TradeDirection.BUY, 10, 100.0)
    t2 = create_trade("2023-01-02", "AAPL", TradeDirection.BUY, 10, 200.0)
    t3 = create_trade("2023-01-03", "AAPL", TradeDirection.SELL, 15, 180.0)
    
    calculator.trades = [t1, t2, t3]
    calculator.calculate(method='AVG')
    
    assert calculator.realized_profits[0].realized_profit == 450.0

