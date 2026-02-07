import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { ProfitCalculator } from '../src/lib/calculator'

const readAsArrayBuffer = (filePath: string): ArrayBuffer => {
  const buf = fs.readFileSync(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('ProfitCalculator', () => {
  test('calculates FIFO results with standalone fees', async () => {
    const calculator = new ProfitCalculator()
    const trades = readAsArrayBuffer(path.join(__dirname, '..', 'data', 'dummy_trades.xlsx'))
    const fees = readAsArrayBuffer(path.join(__dirname, '..', 'data', 'dummy_fees.xlsx'))

    await calculator.loadTrades(trades)
    await calculator.loadFees(fees)

    const result = calculator.calculate('FIFO')

    expect(result.closed_trades).toHaveLength(1)
    expect(result.total_realized_profit).toBeCloseTo(97, 6)
    expect(result.total_fees_paid).toBeCloseTo(1.2, 6)
    expect(result.net_profit).toBeCloseTo(95.8, 6)

    const aaplLots = result.open_positions['AAPL']
    expect(aaplLots).toBeDefined()
    const totalQty = aaplLots.reduce((sum, lot) => sum + lot.quantity, 0)
    expect(totalQty).toBeCloseTo(15, 6)
  })

  test('calculates AVG results with standalone fees', async () => {
    const calculator = new ProfitCalculator()
    const trades = readAsArrayBuffer(path.join(__dirname, '..', 'data', 'dummy_trades.xlsx'))
    const fees = readAsArrayBuffer(path.join(__dirname, '..', 'data', 'dummy_fees.xlsx'))

    await calculator.loadTrades(trades)
    await calculator.loadFees(fees)

    const result = calculator.calculate('AVG')

    expect(result.closed_trades).toHaveLength(1)
    expect(result.total_realized_profit).toBeCloseTo(72, 6)
    expect(result.total_fees_paid).toBeCloseTo(1.2, 6)
    expect(result.net_profit).toBeCloseTo(70.8, 6)
  })
  test('calculates dividends correctly', async () => {
    const calculator = new ProfitCalculator()
    const { utils, write } = await import('xlsx')

    // Create a mock fees file with dividends
    const data = [
      { Date: '2023-01-01', Description: 'Dividend Payment', Amount: 10.5, Currency: 'USD', Direction: 'Dividend' },
      { Date: '2023-01-02', Description: 'Tax on Dividend', Amount: -1.5, Currency: 'USD', Direction: 'Tax' }, // Should be ignored or treated as fee? Currently ignored unless "fee" in name
      { Date: '2023-01-03', Description: 'Monthly Fee', Amount: -2.0, Currency: 'USD', Direction: 'Fee' }
    ]
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Fees')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' })

    await calculator.loadFees(buf)
    const result = calculator.calculate('FIFO')

    expect(result.total_dividends).toBe(10.5)
    expect(result.dividends).toHaveLength(1)
    expect(result.total_fees_paid).toBe(3.5) // 2.0 fee + 1.5 tax
    expect(result.net_profit).toBe(7.0) // 0 realized + 10.5 div - 3.5 fees
  })
})
