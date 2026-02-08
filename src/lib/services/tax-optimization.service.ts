/**
 * Tax Optimization Service
 * Advanced optimization algorithms and recommendation engine
 */

import { 
    TaxCalculation, 
    TaxOptimization, 
    TaxLot, 
    HarvestingOpportunity,
    Lot,
    TaxResidency
} from '../types';
import { TaxCalculatorService } from './tax-calculator.service';

export interface OptimizationStrategy {
    id: string;
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    potentialSavings: number;
    implementationComplexity: 'simple' | 'moderate' | 'complex';
}

export interface PortfolioTaxProfile {
    currentYearTax: number;
    projectedTax: number;
    harvestingOpportunities: number;
    washSaleRisks: number;
    taxEfficiencyScore: number;
    recommendations: TaxOptimization[];
}

export class TaxOptimizationService {
    private taxCalculator: TaxCalculatorService;

    constructor() {
        this.taxCalculator = new TaxCalculatorService();
    }

    /**
     * Generate comprehensive tax optimization recommendations
     */
    generateOptimizations(
        taxCalculations: Record<number, TaxCalculation>,
        openPositions: Record<string, Lot[]>,
        currentPrices: Map<string, { price: number; currency: string }>,
        settings: { harvestThreshold: number; riskTolerance: 'conservative' | 'moderate' | 'aggressive' }
    ): TaxOptimization[] {
        const optimizations: TaxOptimization[] = [];

        // 1. Tax Loss Harvesting Opportunities
        const harvestingOpportunities = this.taxCalculator.identifyHarvestingOpportunities(
            openPositions, 
            currentPrices, 
            settings.harvestThreshold
        );

        harvestingOpportunities.forEach((opp, index) => {
            if (this.passesRiskFilter(opp.riskLevel, settings.riskTolerance)) {
                optimizations.push({
                    id: `harvest_${index}_${Date.now()}`,
                    type: 'harvesting',
                    description: this.generateHarvestingDescription(opp),
                    potentialSavings: opp.potentialTaxSavings,
                    implementation: {
                        action: `Sell ${opp.quantity} shares of ${opp.ticker}`,
                        targetSecurity: opp.ticker,
                        timeline: 'Within 30 days',
                        risk: opp.riskLevel
                    }
                });
            }
        });

        // 2. Tax Deferral Strategies
        Object.values(taxCalculations).forEach(calc => {
            if (calc.year === new Date().getFullYear()) {
                const deferralOps = this.generateDeferralStrategies(calc);
                optimizations.push(...deferralOps);
            }
        });

        // 3. Asset Location Optimization
        const locationOps = this.generateAssetLocationStrategies(openPositions, currentPrices);
        optimizations.push(...locationOps);

        // 4. Tax Loss Carryforward Planning
        const carryforwardOps = this.generateCarryforwardStrategies(taxCalculations);
        optimizations.push(...carryforwardOps);

        // Sort by potential savings
        return optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);
    }

    /**
     * Generate tax loss harvesting description
     */
    private generateHarvestingDescription(opp: HarvestingOpportunity): string {
        const savingsText = `$${opp.potentialTaxSavings.toFixed(2)}`;
        const riskText = opp.riskLevel === 'low' ? 'Low Risk' : opp.riskLevel === 'medium' ? 'Medium Risk' : 'High Risk';
        
        return `Harvest $${opp.unrealizedLoss.toFixed(2)} loss on ${opp.ticker} to save ${savingsText} in taxes (${riskText})`;
    }

    /**
     * Generate tax deferral strategies
     */
    private generateDeferralStrategies(calc: TaxCalculation): TaxOptimization[] {
        const strategies: TaxOptimization[] = [];

        if (calc.shortTermGains > 10000) {
            strategies.push({
                id: `defer_short_term_${Date.now()}`,
                type: 'deferral',
                description: `Defer $${calc.shortTermGains.toFixed(2)} of short-term gains to next tax year`,
                potentialSavings: calc.shortTermGains * 0.10, // 10% savings assumption
                implementation: {
                    action: 'Postpone selling profitable positions',
                    targetSecurity: 'Short-term holdings',
                    timeline: 'After January 1st',
                    risk: 'medium'
                }
            });
        }

        if (calc.estimatedTax > 5000) {
            strategies.push({
                id: `defer_tax_${Date.now()}`,
                type: 'deferral',
                description: `Consider tax deferral strategies to reduce $${calc.estimatedTax.toFixed(2)} tax liability`,
                potentialSavings: calc.estimatedTax * 0.15,
                implementation: {
                    action: 'Implement tax deferral strategies',
                    targetSecurity: 'Multiple holdings',
                    timeline: 'Before year end',
                    risk: 'medium'
                }
            });
        }

        return strategies;
    }

    /**
     * Generate asset location optimization strategies
     */
    private generateAssetLocationStrategies(
        openPositions: Record<string, Lot[]>,
        currentPrices: Map<string, { price: number; currency: string }>
    ): TaxOptimization[] {
        const strategies: TaxOptimization[] = [];

        // Group positions by type (simplified for demonstration)
        const bondPositions = this.identifyAssetType(openPositions, 'bond');
        const stockPositions = this.identifyAssetType(openPositions, 'stock');

        if (Object.keys(bondPositions).length > 0) {
            const bondValue = this.calculatePortfolioValue(bondPositions, currentPrices);
            
            strategies.push({
                id: `location_bonds_${Date.now()}`,
                type: 'location',
                description: `Consider moving $${bondValue.toFixed(2)} in bonds to tax-advantaged accounts`,
                potentialSavings: bondValue * 0.03, // 3% annual tax savings assumption
                implementation: {
                    action: 'Transfer bonds to tax-advantaged account',
                    targetSecurity: 'Bond holdings',
                    timeline: 'Within 90 days',
                    risk: 'low'
                }
            });
        }

        return strategies;
    }

    /**
     * Generate tax loss carryforward strategies
     */
    private generateCarryforwardStrategies(taxCalculations: Record<number, TaxCalculation>): TaxOptimization[] {
        const strategies: TaxOptimization[] = [];

        Object.values(taxCalculations).forEach(calc => {
            if (calc.harvestedLosses > 3000) { // $3,000 annual limitation
                const excessLoss = calc.harvestedLosses - 3000;
                
                strategies.push({
                    id: `carryforward_${calc.year}_${Date.now()}`,
                    type: 'timing',
                    description: `Plan to use $${excessLoss.toFixed(2)} in excess losses for future tax years`,
                    potentialSavings: excessLoss * 0.25, // 25% tax rate assumption
                    implementation: {
                        action: 'Track carryforward losses for future gains',
                        targetSecurity: 'Multiple holdings',
                        timeline: 'Over next 3-5 years',
                        risk: 'low'
                    }
                });
            }
        });

        return strategies;
    }

    /**
     * Filter strategies by risk tolerance
     */
    private passesRiskFilter(strategyRisk: 'low' | 'medium' | 'high', riskTolerance: 'conservative' | 'moderate' | 'aggressive'): boolean {
        const allowedRisks = {
            conservative: ['low'],
            moderate: ['low', 'medium'],
            aggressive: ['low', 'medium', 'high']
        };

        return allowedRisks[riskTolerance].includes(strategyRisk);
    }

    /**
     * Identify positions by asset type (simplified)
     */
    private identifyAssetType(openPositions: Record<string, Lot[]>, type: 'bond' | 'stock'): Record<string, Lot[]> {
        const filtered: Record<string, Lot[]> = {};

        Object.entries(openPositions).forEach(([ticker, lots]) => {
            // Simple heuristic: bonds often have "bond" in ticker or are typical bond tickers
            const isBond = ticker.toLowerCase().includes('bond') || 
                          ['BND', 'AGG', 'TLT', 'IEF'].includes(ticker);
            
            if ((type === 'bond' && isBond) || (type === 'stock' && !isBond)) {
                filtered[ticker] = lots;
            }
        });

        return filtered;
    }

    /**
     * Calculate portfolio value for given positions
     */
    private calculatePortfolioValue(
        positions: Record<string, Lot[]>,
        currentPrices: Map<string, { price: number; currency: string }>
    ): number {
        let totalValue = 0;

        Object.entries(positions).forEach(([ticker, lots]) => {
            const currentPrice = currentPrices.get(ticker);
            if (currentPrice) {
                const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
                totalValue += totalQuantity * currentPrice.price;
            }
        });

        return totalValue;
    }

    /**
     * Generate portfolio tax profile
     */
    generatePortfolioTaxProfile(
        taxCalculations: Record<number, TaxCalculation>,
        harvestingOpportunities: HarvestingOpportunity[],
        washSaleWarnings: any[]
    ): PortfolioTaxProfile {
        const currentYear = new Date().getFullYear();
        const currentYearCalc = taxCalculations[currentYear];

        const currentYearTax = currentYearCalc ? currentYearCalc.estimatedTax : 0;
        const projectedTax = currentYearTax * 1.15; // 15% growth assumption
        
        const taxEfficiencyScore = currentYearCalc ? 
            this.taxCalculator.calculateTaxEfficiencyScore(currentYearCalc) : 50;

        return {
            currentYearTax,
            projectedTax,
            harvestingOpportunities: harvestingOpportunities.length,
            washSaleRisks: washSaleWarnings.length,
            taxEfficiencyScore,
            recommendations: [] // Will be populated by generateOptimizations
        };
    }

    /**
     * Generate tax projection for upcoming year
     */
    generateTaxProjection(
        currentCalc: TaxCalculation,
        projectedGains: number,
        projectedDividends: number
    ): TaxCalculation {
        const projectedShortTerm = currentCalc.shortTermGains * 1.20; // 20% growth assumption
        const projectedLongTerm = currentCalc.longTermGains * 1.15; // 15% growth assumption
        const projectedTaxableGains = projectedShortTerm + projectedLongTerm + projectedGains;

        const projectedTax = 
            (projectedShortTerm * (currentCalc.residency.taxRate.shortTerm / 100)) +
            (projectedLongTerm * (currentCalc.residency.taxRate.longTerm / 100)) +
            (projectedDividends * (currentCalc.residency.taxRate.dividend / 100));

        return {
            year: currentCalc.year + 1,
            residency: currentCalc.residency,
            shortTermGains: projectedShortTerm,
            longTermGains: projectedLongTerm,
            dividendIncome: projectedDividends,
            taxDeductibleExpenses: 0,
            estimatedTax: projectedTax,
            effectiveRate: projectedTaxableGains > 0 ? (projectedTax / projectedTaxableGains) * 100 : 0,
            taxLossCarryforward: 0,
            harvestedLosses: 0,
            netTaxableGain: projectedTaxableGains
        };
    }

    /**
     * Get optimization strategies summary
     */
    getOptimizationSummary(optimizations: TaxOptimization[]): {
        totalSavings: number;
        byType: Record<string, number>;
        byRisk: Record<string, number>;
        topRecommendations: TaxOptimization[];
    } {
        const byType: Record<string, number> = {};
        const byRisk: Record<string, number> = {};

        optimizations.forEach(opt => {
            // Group by type
            if (!byType[opt.type]) byType[opt.type] = 0;
            byType[opt.type] += opt.potentialSavings;

            // Group by risk level
            if (!byRisk[opt.implementation.risk]) byRisk[opt.implementation.risk] = 0;
            byRisk[opt.implementation.risk] += opt.potentialSavings;
        });

        return {
            totalSavings: optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0),
            byType,
            byRisk,
            topRecommendations: optimizations.slice(0, 5)
        };
    }
}