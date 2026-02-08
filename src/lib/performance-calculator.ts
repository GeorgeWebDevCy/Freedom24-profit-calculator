
import { ClosedTrade, CashTransaction } from './types';

export interface PerformanceMetrics {
    roi: number; // Return on Investment as percentage
    annualizedReturn: number; // Annualized return as percentage
    winLossRatio: {
        wins: number;
        losses: number;
        ratio: number; // wins / (wins + losses)
        winRate: number; // percentage
    };
    averageHoldingPeriod: number; // in days
    bestTrades: ClosedTrade[];
    worstTrades: number;
    totalInvested: number;
    currentValue: number;
}

/**
 * Calculate total amount invested (deposits - withdrawals)
 */
export function calculateTotalInvested(cashTransactions: CashTransaction[]): number {
    return cashTransactions.reduce((sum, trans) => {
        if (trans.type === 'DEPOSIT') {
            return sum + trans.amount;
        } else {
            return sum - trans.amount;
        }
    }, 0);
}

/**
 * Calculate Return on Investment (ROI)
 * ROI = ((Current Value - Total Invested) / Total Invested) * 100
 */
export function calculateROI(
    totalInvested: number,
    currentValue: number
): number {
    if (totalInvested <= 0) return 0;
    return ((currentValue - totalInvested) / totalInvested) * 100;
}

/**
 * Calculate annualized return
 * Annualized Return = ((1 + Total Return) ^ (1 / Years)) - 1
 */
export function calculateAnnualizedReturn(
    totalReturn: number,
    startDate: Date,
    endDate: Date
): number {
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365.25;

    if (years <= 0) return 0;
    if (totalReturn <= -100) return -100; // Total loss

    const annualized = (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
    return annualized;
}

/**
 * Calculate win/loss ratio from closed trades
 */
export function calculateWinLossRatio(trades: ClosedTrade[]): {
    wins: number;
    losses: number;
    ratio: number;
    winRate: number;
} {
    let wins = 0;
    let losses = 0;

    for (const trade of trades) {
        if (trade.realized_profit > 0) {
            wins++;
        } else if (trade.realized_profit < 0) {
            losses++;
        }
        // Break-even trades (profit === 0) are not counted
    }

    const total = wins + losses;
    const ratio = total > 0 ? wins / total : 0;
    const winRate = ratio * 100;

    return { wins, losses, ratio, winRate };
}

/**
 * Calculate average holding period in days
 * Note: This requires knowing when positions were opened.
 * For closed trades, we can estimate based on FIFO assumption.
 */
export function calculateAverageHoldingPeriod(
    trades: ClosedTrade[],
    allTrades: { date: Date; ticker: string; direction: string }[]
): number {
    if (trades.length === 0) return 0;

    let totalDays = 0;
    let count = 0;

    for (const closedTrade of trades) {
        // Find the earliest buy for this ticker (FIFO assumption)
        const buyTrades = allTrades.filter(
            t => t.ticker === closedTrade.ticker && t.direction === 'Buy' && t.date <= closedTrade.date
        );

        if (buyTrades.length > 0) {
            // Use earliest buy date
            const earliestBuy = buyTrades.reduce((earliest, t) =>
                t.date < earliest.date ? t : earliest
            );

            const holdingPeriod = (closedTrade.date.getTime() - earliestBuy.date.getTime()) / (1000 * 60 * 60 * 24);
            totalDays += holdingPeriod;
            count++;
        }
    }

    return count > 0 ? totalDays / count : 0;
}

/**
 * Get best and worst trades by realized profit
 */
export function getBestWorstTrades(
    trades: ClosedTrade[],
    count: number = 5
): { best: ClosedTrade[]; worst: ClosedTrade[] } {
    const sorted = [...trades].sort((a, b) => b.realized_profit - a.realized_profit);

    return {
        best: sorted.slice(0, count),
        worst: sorted.slice(-count).reverse()
    };
}

/**
 * Calculate all performance metrics
 */
export function calculatePerformanceMetrics(
    closedTrades: ClosedTrade[],
    allTrades: { date: Date; ticker: string; direction: string }[],
    cashTransactions: CashTransaction[],
    totalRealizedProfit: number,
    totalDividends: number,
    totalFees: number,
    openPositionsMarketValue: number,
    cashBalance: number
): PerformanceMetrics {
    const totalInvested = calculateTotalInvested(cashTransactions);

    // Current value = cash + open positions value
    const currentValue = cashBalance + openPositionsMarketValue;

    // Total return includes realized profit + dividends - fees + unrealized (current value - invested)
    const totalReturn = currentValue - totalInvested;
    const roi = calculateROI(totalInvested, currentValue);

    // Get date range for annualized return
    const startDate = cashTransactions.length > 0
        ? cashTransactions.reduce((earliest, t) => t.date < earliest ? t.date : earliest, cashTransactions[0].date)
        : new Date();
    const endDate = new Date();

    const annualizedReturn = calculateAnnualizedReturn(roi, startDate, endDate);
    const winLossRatio = calculateWinLossRatio(closedTrades);
    const averageHoldingPeriod = calculateAverageHoldingPeriod(closedTrades, allTrades);
    const { best, worst } = getBestWorstTrades(closedTrades, 5);

    return {
        roi,
        annualizedReturn,
        winLossRatio,
        averageHoldingPeriod,
        bestTrades: best,
        worstTrades: worst.length,
        totalInvested,
        currentValue
    };
}
