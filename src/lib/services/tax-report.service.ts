/**
 * Tax Report Service
 * Generates professional tax reports for filing and analysis
 */

import jsPDF from 'jspdf';
import { TaxCalculation, TaxLot, TaxReport, WashSaleWarning, HarvestingOpportunity } from '../types';
import * as XLSX from 'xlsx';

export class TaxReportService {
    
    /**
     * Generate comprehensive tax report PDF
     */
    generateTaxReportPDF(
        taxCalc: TaxCalculation,
        taxLots: Record<string, TaxLot[]>,
        washSales: WashSaleWarning[],
        harvestingOps: HarvestingOpportunity[]
    ): string {
        const pdf = new jsPDF();
        let yPosition = 20;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(0, 51, 102);
        pdf.text(`Tax Report - ${taxCalc.year}`, 20, yPosition);
        yPosition += 15;

        pdf.setFontSize(12);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
        yPosition += 10;
        pdf.text(`Country: ${taxCalc.residency.country}`, 20, yPosition);
        yPosition += 15;

        // Tax Summary Section
        pdf.setFontSize(16);
        pdf.setTextColor(0, 51, 102);
        pdf.text('Tax Summary', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        const summaryData = [
            ['Category', 'Amount', 'Tax Rate', 'Tax'],
            ['Short Term Gains', this.formatCurrency(taxCalc.shortTermGains), `${taxCalc.residency.taxRate.shortTerm}%`, this.formatCurrency(taxCalc.shortTermGains * taxCalc.residency.taxRate.shortTerm / 100)],
            ['Long Term Gains', this.formatCurrency(taxCalc.longTermGains), `${taxCalc.residency.taxRate.longTerm}%`, this.formatCurrency(taxCalc.longTermGains * taxCalc.residency.taxRate.longTerm / 100)],
            ['Dividend Income', this.formatCurrency(taxCalc.dividendIncome), `${taxCalc.residency.taxRate.dividend}%`, this.formatCurrency(taxCalc.dividendIncome * taxCalc.residency.taxRate.dividend / 100)],
            ['', '', '', ''],
            ['Total Taxable', this.formatCurrency(taxCalc.netTaxableGain), '', this.formatCurrency(taxCalc.estimatedTax)],
            ['Harvested Losses', this.formatCurrency(taxCalc.harvestedLosses), '', '-'],
            ['Effective Rate', '', '', `${taxCalc.effectiveRate.toFixed(1)}%`]
        ];

        summaryData.forEach(row => {
            pdf.text(row.join(' | '), 20, yPosition);
            yPosition += 7;
        });

        yPosition += 10;

        // Tax Lots Section
        pdf.setFontSize(16);
        pdf.setTextColor(0, 51, 102);
        pdf.text('Tax Lots', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(9);
        
        const lotHeaders = ['Ticker', 'Quantity', 'Acquired', 'Disposed', 'Cost Basis', 'Proceeds', 'Gain/Loss', 'Term'];
        pdf.text(lotHeaders.join(' | '), 20, yPosition);
        yPosition += 7;

        Object.values(taxLots).flat().slice(0, 20).forEach(lot => {
            if (lot.dispositionDate) {
                const gainLoss = lot.dispositionPrice! * lot.quantity - lot.acquisitionCost;
                const row = [
                    lot.ticker,
                    lot.quantity.toString(),
                    lot.acquisitionDate.toLocaleDateString(),
                    lot.dispositionDate.toLocaleDateString(),
                    this.formatCurrency(lot.acquisitionCost),
                    this.formatCurrency(lot.dispositionPrice! * lot.quantity),
                    this.formatCurrency(gainLoss),
                    lot.taxTreatment
                ];
                
                // Color code gains/losses
                if (gainLoss < 0) {
                    pdf.setTextColor(255, 0, 0);
                } else if (gainLoss > 0) {
                    pdf.setTextColor(0, 128, 0);
                } else {
                    pdf.setTextColor(0, 0, 0);
                }
                
                pdf.text(row.join(' | '), 20, yPosition);
                yPosition += 6;
            }
        });

        // New page for wash sales
        if (washSales.length > 0 && yPosition > 250) {
            pdf.addPage();
            yPosition = 20;
        }

        // Wash Sales Section
        if (washSales.length > 0) {
            yPosition += 10;
            pdf.setFontSize(16);
            pdf.setTextColor(0, 51, 102);
            pdf.text('Wash Sale Warnings', 20, yPosition);
            yPosition += 10;

            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            
            washSales.forEach(wash => {
                const washText = `âš ï¸ ${wash.ticker}: Loss of $${wash.potentialLoss.toFixed(2)} on ${wash.lossDate.toLocaleDateString()}, repurchased on ${wash.repurchaseDate.toLocaleDateString()}`;
                pdf.text(washText, 20, yPosition);
                yPosition += 8;
            });
        }

        // Footer
        yPosition = pdf.internal.pageSize.height - 30;
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text('This report is for informational purposes only. Consult with a tax professional for official tax advice.', 20, yPosition);

        return pdf.output('datauristring');
    }

    /**
     * Generate tax report Excel file
     */
    generateTaxReportExcel(
        taxCalc: TaxCalculation,
        taxLots: Record<string, TaxLot[]>,
        washSales: WashSaleWarning[]
    ): Blob {
        const workbook = XLSX.utils.book_new();

        // Tax Summary Sheet
        const summaryData = [
            ['Tax Summary', ''],
            ['Tax Year', taxCalc.year.toString()],
            ['Country', taxCalc.residency.country],
            ['Short Term Gains', taxCalc.shortTermGains.toString()],
            ['Long Term Gains', taxCalc.longTermGains.toString()],
            ['Dividend Income', taxCalc.dividendIncome.toString()],
            ['Harvested Losses', taxCalc.harvestedLosses.toString()],
            ['Net Taxable Gain', taxCalc.netTaxableGain.toString()],
            ['Estimated Tax', taxCalc.estimatedTax.toString()],
            ['Effective Rate', taxCalc.effectiveRate.toString() + '%']
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tax Summary');

        // Tax Lots Sheet
        const lotsData: any[][] = [['Ticker', 'Quantity', 'Acquisition Date', 'Disposal Date', 'Acquisition Price', 'Disposal Price', 'Cost Basis', 'Proceeds', 'Gain/Loss', 'Term']];
        
        Object.values(taxLots).flat().forEach(lot => {
            if (lot.dispositionDate) {
                const gainLoss = lot.dispositionPrice! * lot.quantity - lot.acquisitionCost;
                lotsData.push([
                    lot.ticker,
                    lot.quantity,
                    lot.acquisitionDate.toLocaleDateString(),
                    lot.dispositionDate.toLocaleDateString(),
                    lot.acquisitionPrice,
                    lot.dispositionPrice || 0,
                    lot.acquisitionCost,
                    (lot.dispositionPrice || 0) * lot.quantity,
                    gainLoss,
                    lot.taxTreatment
                ]);
            }
        });

        const lotsSheet = XLSX.utils.aoa_to_sheet(lotsData);
        XLSX.utils.book_append_sheet(workbook, lotsSheet, 'Tax Lots');

        // Wash Sales Sheet (if any)
        if (washSales.length > 0) {
            const washData: any[][] = [['Ticker', 'Loss Date', 'Repurchase Date', 'Potential Loss', 'Affected Lots']];
            washSales.forEach(wash => {
                washData.push([
                    wash.ticker,
                    wash.lossDate.toLocaleDateString(),
                    wash.repurchaseDate.toLocaleDateString(),
                    wash.potentialLoss,
                    wash.affectedLots.join(', ')
                ]);
            });

            const washSheet = XLSX.utils.aoa_to_sheet(washData);
            XLSX.utils.book_append_sheet(workbook, washSheet, 'Wash Sales');
        }

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    /**
     * Generate Form 8949 data (US Capital Gains and Losses)
     */
    generateForm8949(taxLots: Record<string, TaxLot[]>): any[][] {
        const formData = [
            ['Form 8949 - Sales and Other Dispositions of Capital Assets'],
            [''],
            ['(a) Description of property', '(b) Date acquired', '(c) Date sold or disposed', '(d) Proceeds', '(e) Cost or other basis', '(f) Adjustment', '(g) Gain or loss', '(h) Short-term or Long-term']
        ];

        Object.values(taxLots).flat().forEach(lot => {
            if (lot.dispositionDate) {
                const gainLoss = lot.dispositionPrice! * lot.quantity - lot.acquisitionCost;
                formData.push([
                    `${lot.quantity} shares of ${lot.ticker}`,
                    lot.acquisitionDate.toLocaleDateString(),
                    lot.dispositionDate.toLocaleDateString(),
                    (lot.dispositionPrice! * lot.quantity).toString(),
                    lot.acquisitionCost.toString(),
                    '',
                    gainLoss.toString(),
                    lot.taxTreatment === 'short_term' ? 'Short-term' : 'Long-term'
                ]);
            }
        });

        return formData;
    }

    /**
     * Generate Schedule D data (US Capital Gains)
     */
    generateScheduleD(taxCalc: TaxCalculation): any[][] {
        return [
            ['Schedule D - Capital Gains and Losses'],
            [''],
            ['Short-Term Capital Gains', taxCalc.shortTermGains.toString()],
            ['Long-Term Capital Gains', taxCalc.longTermGains.toString()],
            ['Capital Loss Carryover', taxCalc.taxLossCarryforward.toString()],
            ['Net Capital Gain', taxCalc.netTaxableGain.toString()],
            ['Tax on Net Capital Gain', taxCalc.estimatedTax.toString()]
        ];
    }

    /**
     * Generate tax projection for next year
     */
    generateTaxProjection(
        currentCalc: TaxCalculation,
        projectedIncome: number,
        projectedGains: number
    ): any[][] {
        const projectedTax = (projectedGains * currentCalc.residency.taxRate.shortTerm / 100) + 
                           (projectedIncome * currentCalc.residency.taxRate.dividend / 100);

        return [
            ['Tax Projection - Next Year'],
            [''],
            ['Projected Income', projectedIncome.toString()],
            ['Projected Capital Gains', projectedGains.toString()],
            ['Projected Tax Liability', projectedTax.toString()],
            ['Projected Effective Rate', (projectedTax / (projectedIncome + projectedGains) * 100).toString() + '%'],
            ['Recommendations', 'Consider tax deferral strategies if projected tax is high']
        ];
    }

    /**
     * Format currency for display
     */
    private formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Generate tax optimization summary
     */
    generateOptimizationSummary(
        optimizations: any[],
        totalSavings: number
    ): any[][] {
        const summary = [
            ['Tax Optimization Summary'],
            [''],
            ['Total Potential Savings', totalSavings.toString()],
            ['Number of Opportunities', optimizations.length.toString()],
            ['Implementation Priority', optimizations.map((opt, i) => `${i + 1}. ${opt.description}`).join('\n')]
        ];

        optimizations.forEach(opt => {
            summary.push([opt.type, opt.potentialSavings.toString(), opt.implementation.timeline, opt.implementation.risk]);
        });

        return summary;
    }

    /**
     * Export tax report with specific format
     */
    exportTaxReport(
        format: 'pdf' | 'excel' | 'csv',
        taxCalc: TaxCalculation,
        taxLots: Record<string, TaxLot[]>,
        washSales: WashSaleWarning[]
    ): string | Blob {
        switch (format) {
            case 'pdf':
                return this.generateTaxReportPDF(taxCalc, taxLots, washSales, []);
            case 'excel':
                return this.generateTaxReportExcel(taxCalc, taxLots, washSales);
            case 'csv':
                return this.generateTaxReportCSV(taxCalc, taxLots);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Generate CSV format for tax data
     */
    private generateTaxReportCSV(taxCalc: TaxCalculation, taxLots: Record<string, TaxLot[]>): Blob {
        const csvData = [
            'Ticker,Quantity,Acquisition Date,Disposal Date,Acquisition Price,Disposal Price,Cost Basis,Proceeds,Gain/Loss,Term'
        ];

        Object.values(taxLots).flat().forEach(lot => {
            if (lot.dispositionDate) {
                const gainLoss = (lot.dispositionPrice || 0) * lot.quantity - lot.acquisitionCost;
                csvData.push([
                    lot.ticker,
                    lot.quantity.toString(),
                    lot.acquisitionDate.toLocaleDateString(),
                    lot.dispositionDate.toLocaleDateString(),
                    lot.acquisitionPrice.toString(),
                    (lot.dispositionPrice || 0).toString(),
                    lot.acquisitionCost.toString(),
                    ((lot.dispositionPrice || 0) * lot.quantity).toString(),
                    gainLoss.toString(),
                    lot.taxTreatment
                ].join(','));
            }
        });

        const csvString = csvData.join('\n');
        return new Blob([csvString], { type: 'text/csv' });
    }
}
