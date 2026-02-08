/**
 * Tax Calculator Service
 * Comprehensive tax calculations and optimization algorithms for Freedom24 portfolio
 */

import { 
    Trade, 
    ClosedTrade, 
    Dividend, 
    TaxCalculation, 
    TaxResidency, 
    TaxLot, 
    TaxOptimization,
    WashSaleWarning,
    HarvestingOpportunity,
    Lot,
    TradeDirection
} from '../types';

export class TaxCalculatorService {
    
    /**
     * Generate tax lots from trades using FIFO method
     */
    generateTaxLots(trades: Trade[]): Record<string, TaxLot[]> {
        const taxLots: Record<string, TaxLot[]> = {};
        const holdings: Record<string, Lot[]> = {};

        // Group trades by ticker
        const tradesByTicker = trades.reduce((acc: Record<string, Trade[]>, trade) => {
            if (!acc[trade.ticker]) acc[trade.ticker] = [];
            acc[trade.ticker].push(trade);
            return acc;
        }, {});

        // Sort trades by date
        Object.keys(tradesByTicker).forEach(ticker => {
            tradesByTicker[ticker].sort((a, b) => a.date.getTime() - b.date.getTime());
        });

        // Process trades to generate tax lots
        Object.entries(tradesByTicker).forEach(([ticker, tickerTrades]) => {
            const lots: TaxLot[] = [];
            const openLots: Lot[] = [];

            tickerTrades.forEach((trade: Trade) => {
                if (trade.direction === TradeDirection.BUY) {
                    // Create new tax lot
                    const unitCost = (trade.price * trade.quantity + trade.fee) / trade.quantity;
                    const lot: Lot = {
                        date: trade.date,
                        quantity: trade.quantity,
                        unit_cost: unitCost,
                        price_paid: trade.price * trade.quantity,
                        fees_paid: trade.fee,
                        currency: trade.currency
                    };
                    openLots.push(lot);
                } else if (trade.direction === TradeDirection.SELL && openLots.length > 0) {
                    let qtyToSell = trade.quantity;
                    
                    while (qtyToSell > 0 && openLots.length > 0) {
                        const lot = openLots[0];
                        const sellQty = Math.min(qtyToSell, lot.quantity);
                        
                        // Create tax lot for this sale
                        const holdingPeriodDays = Math.floor(
                            (trade.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        
                        const taxLot: TaxLot = {
                            id: `${ticker}_${trade.date.getTime()}_${lot.date.getTime()}`,
                            ticker,
                            quantity: sellQty,
                            acquisitionDate: lot.date,
                            acquisitionPrice: lot.unit_cost,
                            acquisitionCost: lot.unit_cost * sellQty + (lot.fees_paid * (sellQty / lot.quantity)),
                            dispositionDate: trade.date,
                            dispositionPrice: trade.price,
                            holdingPeriodDays,
                            taxTreatment: holdingPeriodDays >= 365 ? 'long_term' : 'short_term',
                            currency: trade.currency
                        };
                        
                        lots.push(taxLot);
                        
                        lot.quantity -= sellQty;
                        if (lot.quantity <= 0) {
                            openLots.shift();
                        }
                        qtyToSell -= sellQty;
                    }
                }
            });

            taxLots[ticker] = lots;
        });

        return taxLots;
    }

    /**
     * Calculate tax liability for a specific year
     */
    calculateTaxLiability(
        year: number,
        residency: TaxResidency,
        taxLots: Record<string, TaxLot[]>,
        dividends: Dividend[]
    ): TaxCalculation {
        let shortTermGains = 0;
        let longTermGains = 0;
        let dividendIncome = 0;
        let harvestedLosses = 0;

        // Process tax lots for the specified year
        Object.values(taxLots).forEach(lots => {
            lots.forEach(lot => {
                if (lot.dispositionDate && lot.dispositionDate.getFullYear() === year) {
                    const gain = (lot.dispositionPrice! - lot.acquisitionPrice) * lot.quantity;
                    
                    if (gain < 0) {
                        harvestedLosses += Math.abs(gain);
                    }

                    if (lot.taxTreatment === 'short_term') {
                        shortTermGains += gain;
                    } else {
                        longTermGains += gain;
                    }
                }
            });
        });

        // Process dividend income
        dividends.forEach(div => {
            if (div.date.getFullYear() === year) {
                dividendIncome += div.amount;
            }
        });

        // Apply tax rates
        const shortTermTax = shortTermGains * (residency.taxRate.shortTerm / 100);
        const longTermTax = longTermGains * (residency.taxRate.longTerm / 100);
        const dividendTax = dividendIncome * (residency.taxRate.dividend / 100);
        
        const totalTaxableGains = Math.max(0, shortTermGains + longTermGains);
        const estimatedTax = shortTermTax + longTermTax + dividendTax;
        
        const effectiveRate = totalTaxableGains > 0 ? (estimatedTax / totalTaxableGains) * 100 : 0;

        return {
            year,
            residency,
            shortTermGains,
            longTermGains,
            dividendIncome,
            taxDeductibleExpenses: 0, // Could be implemented later
            estimatedTax,
            effectiveRate,
            taxLossCarryforward: 0, // Could be tracked over time
            harvestedLosses,
            netTaxableGain: totalTaxableGains - Math.min(harvestedLosses, totalTaxableGains)
        };
    }

    /**
     * Identify wash sale violations
     */
    detectWashSales(
        trades: Trade[],
        taxLots: Record<string, TaxLot[]>
    ): WashSaleWarning[] {
        const warnings: WashSaleWarning[] = [];
        const washSaleWindow = 30; // days

        Object.entries(taxLots).forEach(([ticker, lots]) => {
            lots.forEach(lot => {
                if (lot.dispositionDate && lot.acquisitionCost > lot.dispositionPrice! * lot.quantity) {
                    // Look for repurchases within wash sale window
                    const repurchaseWindowStart = new Date(lot.dispositionDate.getTime());
                    const repurchaseWindowEnd = new Date(lot.dispositionDate.getTime() + (washSaleWindow * 24 * 60 * 60 * 1000));

                    const repurchases = trades.filter(trade => 
                        trade.ticker === ticker &&
                        trade.direction === TradeDirection.BUY &&
                        trade.date >= repurchaseWindowStart &&
                        trade.date <= repurchaseWindowEnd
                    );

                    if (repurchases.length > 0) {
                        const potentialLoss = (lot.acquisitionPrice - lot.dispositionPrice!) * lot.quantity;
                        
                        warnings.push({
                            id: `wash_${ticker}_${lot.dispositionDate.getTime()}`,
                            ticker,
                            lossDate: lot.dispositionDate,
                            repurchaseDate: repurchases[0].date,
                            potentialLoss,
                            affectedLots: [lot.id]
                        });
                    }
                }
            });
        });

        return warnings;
    }

    /**
     * Identify tax loss harvesting opportunities
     */
    identifyHarvestingOpportunities(
        openPositions: Record<string, Lot[]>,
        currentPrices: Map<string, { price: number; currency: string }>,
        harvestThreshold: number = 1000
    ): HarvestingOpportunity[] {
        const opportunities: HarvestingOpportunity[] = [];

        Object.entries(openPositions).forEach(([ticker, lots]) => {
            const currentPrice = currentPrices.get(ticker);
            if (!currentPrice) return;

            const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
            const totalCost = lots.reduce((sum, lot) => sum + lot.price_paid, 0);
            const currentMarketValue = totalQuantity * currentPrice.price;
            const unrealizedLoss = currentMarketValue - totalCost;

            if (unrealizedLoss < -harvestThreshold) {
                // Calculate potential tax savings (assuming 25% tax rate)
                const potentialTaxSavings = Math.abs(unrealizedLoss) * 0.25;
                
                opportunities.push({
                    id: `harvest_${ticker}_${Date.now()}`,
                    ticker,
                    quantity: totalQuantity,
                    unrealizedLoss: Math.abs(unrealizedLoss),
                    potentialTaxSavings,
                    confidence: this.calculateHarvestingConfidence(lots, currentPrice.price),
                    riskLevel: this.assessHarvestingRisk(ticker, lots)
                });
            }
        });

        return opportunities.sort((a, b) => b.potentialTaxSavings - a.potentialTaxSavings);
    }

    /**
     * Generate tax optimization recommendations
     */
    generateTaxOptimizations(
        taxCalculations: Record<number, TaxCalculation>,
        harvestingOpportunities: HarvestingOpportunity[],
        washSales: WashSaleWarning[]
    ): TaxOptimization[] {
        const optimizations: TaxOptimization[] = [];

        // Tax loss harvesting recommendations
        harvestingOpportunities.slice(0, 5).forEach((opp, index) => {
            optimizations.push({
                id: `opt_harvest_${index}`,
                type: 'harvesting',
                description: `Harvest tax losses on ${opp.ticker} to save ~$${opp.potentialTaxSavings.toFixed(2)} in taxes`,
                potentialSavings: opp.potentialTaxSavings,
                implementation: {
                    action: 'Sell position',
                    targetSecurity: opp.ticker,
                    timeline: 'Within 30 days',
                    risk: opp.riskLevel
                }
            });
        });

        // Wash sale avoidance recommendations
        washSales.forEach(wash => {
            optimizations.push({
                id: `opt_wash_${wash.id}`,
                type: 'timing',
                description: `Avoid wash sale on ${wash.ticker} by waiting 31 days before repurchasing`,
                potentialSavings: wash.potentialLoss * 0.25, // Assuming 25% tax rate
                implementation: {
                    action: 'Delay repurchase',
                    targetSecurity: wash.ticker,
                    timeline: 'Wait 31 days',
                    risk: 'low'
                }
            });
        });

        // Tax deferral recommendations
        Object.values(taxCalculations).forEach(calc => {
            if (calc.year === new Date().getFullYear() && calc.estimatedTax > 5000) {
                optimizations.push({
                    id: `opt_deferral_${calc.year}`,
                    type: 'deferral',
                    description: `Consider tax deferral strategies to reduce current year tax liability`,
                    potentialSavings: calc.estimatedTax * 0.15,
                    implementation: {
                        action: 'Review tax deferral options',
                        targetSecurity: 'Multiple',
                        timeline: 'Before year end',
                        risk: 'medium'
                    }
                });
            }
        });

        return optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);
    }

    /**
     * Calculate confidence score for harvesting opportunity
     */
    private calculateHarvestingConfidence(lots: Lot[], currentPrice: number): number {
        const avgCost = lots.reduce((sum, lot) => sum + lot.unit_cost, 0) / lots.length;
        const priceDeviation = Math.abs(currentPrice - avgCost) / avgCost;
        
        // Higher confidence for significant losses
        return Math.min(100, priceDeviation * 100);
    }

    /**
     * Assess risk level for harvesting opportunity
     */
    private assessHarvestingRisk(ticker: string, lots: Lot[]): 'low' | 'medium' | 'high' {
        // Simple risk assessment based on position age and concentration
        const avgHoldingDays = lots.reduce((sum, lot) => {
            const days = (Date.now() - lot.date.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0) / lots.length;

        if (avgHoldingDays > 365) return 'low';
        if (avgHoldingDays > 30) return 'medium';
        return 'high';
    }

    /**
     * Get default tax residency configurations
     */
    static getDefaultTaxResidencies(): TaxResidency[] {
        const currentYear = new Date().getFullYear();
        
        return [
            {
                country: 'United States',
                taxYear: currentYear,
                taxRate: {
                    shortTerm: 35,    // Ordinary income rates
                    longTerm: 15,     // Qualified dividends & long-term gains
                    dividend: 15,      // Qualified dividends
                    capitalGains: 15
                }
            },
            {
                country: 'United Kingdom',
                taxYear: currentYear,
                taxRate: {
                    shortTerm: 20,    // Basic rate
                    longTerm: 10,     // Lower rate for long-term
                    dividend: 8.75,    // Dividend allowance + rates
                    capitalGains: 10
                }
            },
            {
                country: 'Germany',
                taxYear: currentYear,
                taxRate: {
                    shortTerm: 26.375, // 25% + solidarity surcharge
                    longTerm: 26.375,  // Same rate, but with allowances
                    dividend: 26.375,
                    capitalGains: 26.375
                }
            }
        ];
    }

    /**
     * Calculate tax efficiency score for a portfolio
     */
    calculateTaxEfficiencyScore(taxCalc: TaxCalculation): number {
        if (taxCalc.netTaxableGain <= 0) return 100; // No tax, perfect efficiency
        
        // Score based on ratio of long-term gains to total gains
        const totalGains = Math.abs(taxCalc.shortTermGains) + Math.abs(taxCalc.longTermGains);
        const longTermRatio = totalGains > 0 ? Math.abs(taxCalc.longTermGains) / totalGains : 0;
        
        // Bonus for harvested losses
        const lossHarvestBonus = taxCalc.harvestedLosses > 0 ? Math.min(20, taxCalc.harvestedLosses / 1000) : 0;
        
        return Math.min(100, (longTermRatio * 80) + lossHarvestBonus);
    }
}