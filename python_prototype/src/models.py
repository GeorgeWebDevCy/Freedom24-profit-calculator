from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

class TradeDirection(Enum):
    BUY = "Buy"
    SELL = "Sell"

@dataclass
class Trade:
    date: datetime
    ticker: str
    direction: TradeDirection
    quantity: float
    price: float
    fee: float
    amount: float
    datetime_str: str = "" # Original string for debugging

@dataclass
class Lot:
    date: datetime
    quantity: float
    unit_cost: float
    price_paid: float  # Original price * quantity
    fees_paid: float   # Fees allocable to this lot

@dataclass
class ClosedTrade:
    ticker: str
    date: datetime
    quantity: float
    sell_price: float
    sell_fees: float
    cost_basis: float
    realized_profit: float
    sale_proceeds: float
    method: str  # 'FIFO' or 'AVG'
