
import pandas as pd
import os

def create_dummy_data():
    os.makedirs('data', exist_ok=True)
    
    # Trades (1).xlsx structure
    # Number, Date, Settlement Date, Ticker, Direction, Quantity, Price, Amount, Profit, Fee
    
    trades_data = [
        {
            "Number": "1", "Date": "01.01.2023", "Settlement Date": "03.01.2023",
            "Ticker": "AAPL", "Direction": "Buy", "Quantity": 10, "Price": 100.0,
            "Amount": 1000.0, "Profit": 0, "Fee": 2.0
        },
        {
            "Number": "2", "Date": "15.01.2023", "Settlement Date": "17.01.2023",
            "Ticker": "AAPL", "Direction": "Buy", "Quantity": 10, "Price": 110.0,
            "Amount": 1100.0, "Profit": 0, "Fee": 2.0
        },
        {
            "Number": "3", "Date": "01.02.2023", "Settlement Date": "03.02.2023",
            "Ticker": "AAPL", "Direction": "Sell", "Quantity": 5, "Price": 120.0,
            "Amount": 600.0, "Profit": 0, "Fee": 2.0
        },
        # Add a standalone fee in the fees file, but maybe some more trades?
        {
             "Number": "4", "Date": "01.03.2023", "Ticker": "MSFT", "Direction": "Buy",
             "Quantity": 1, "Price": 300, "Amount": 300, "Profit": 0, "Fee": 1.5
        }
    ]
    
    df_trades = pd.DataFrame(trades_data)
    df_trades.to_excel('data/dummy_trades.xlsx', index=False)
    
    # tradernet_table.xlsx structure
    # Date, Direction, Comment, Amount, Currency
    
    fees_data = [
        {
            "Date": "05.01.2023", "Direction": "Trading fee", 
            "Comment": "Monthly platform fee", "Amount": -1.20, "Currency": "EUR"
        },
        {
            "Date": "05.01.2023", "Direction": "Bank transfer", 
            "Comment": "Deposit", "Amount": 1000.00, "Currency": "EUR"
        }
    ]
    
    df_fees = pd.DataFrame(fees_data)
    df_fees.to_excel('data/dummy_fees.xlsx', index=False)
    
    print("Dummy data created in 'data/' directory.")

if __name__ == "__main__":
    create_dummy_data()
