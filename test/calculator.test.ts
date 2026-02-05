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
})
