
import { describe, test, expect } from 'vitest'
import { ProfitCalculator } from '../src/lib/calculator'

describe('ProfitCalculator Multi-Currency', () => {
    test('separates totals by currency', async () => {
        const calculator = new ProfitCalculator()
        const { utils, write } = await import('xlsx')

        // Create a mock trades file with USD and EUR trades
        const tradesData = [
            { Date: '2023-01-01', Ticker: 'AAPL', Quantity: 10, Price: 150, Currency: 'USD', Direction: 'Buy' },
            { Date: '2023-01-05', Ticker: 'AAPL', Quantity: 10, Price: 160, Currency: 'USD', Direction: 'Sell' }, // Profit: 100 USD
            { Date: '2023-01-02', Ticker: 'VW', Quantity: 5, Price: 200, Currency: 'EUR', Direction: 'Buy' },
            { Date: '2023-01-06', Ticker: 'VW', Quantity: 5, Price: 220, Currency: 'EUR', Direction: 'Sell' }, // Profit: 100 EUR
        ]
        const wsTrades = utils.json_to_sheet(tradesData)
        const wbTrades = utils.book_new()
        utils.book_append_sheet(wbTrades, wsTrades, 'Trades')
        const bufTrades = write(wbTrades, { type: 'array', bookType: 'xlsx' })

        // Create a mock fees file
        const feesData = [
            { Date: '2023-01-01', Description: 'Fee USD', Amount: -1.0, Currency: 'USD', Direction: 'Fee' },
            { Date: '2023-01-02', Description: 'Fee EUR', Amount: -2.0, Currency: 'EUR', Direction: 'Fee' },
            { Date: '2023-01-10', Description: 'Div USD', Amount: 5.0, Currency: 'USD', Direction: 'Dividend' },
        ]
        const wsFees = utils.json_to_sheet(feesData)
        const wbFees = utils.book_new()
        utils.book_append_sheet(wbFees, wsFees, 'Fees')
        const bufFees = write(wbFees, { type: 'array', bookType: 'xlsx' })

        await calculator.loadTrades(bufTrades)
        await calculator.loadFees(bufFees)
        const result = calculator.calculate('FIFO')

        // Check totals by currency
        const totals = result.totals_by_currency

        expect(totals['USD']).toBeDefined()
        expect(totals['EUR']).toBeDefined()

        // USD: 100 profit - 1 fee + 5 div = 104
        expect(totals['USD'].realized_profit).toBe(100)
        expect(totals['USD'].fees_paid).toBe(1)
        expect(totals['USD'].dividends).toBe(5)
        expect(totals['USD'].net_profit).toBe(104)

        // EUR: 100 profit - 2 fee + 0 div = 98
        expect(totals['EUR'].realized_profit).toBe(100)
        expect(totals['EUR'].fees_paid).toBe(2)
        expect(totals['EUR'].dividends).toBe(0)
        expect(totals['EUR'].net_profit).toBe(98)
    })
})
