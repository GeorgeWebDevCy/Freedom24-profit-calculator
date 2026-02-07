
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { CalculationResult } from './types';

export const exportToPDF = (data: CalculationResult, year: string) => {
    const doc = new jsPDF();
    const title = year === 'All'
        ? 'Freedom24 Portfolio Report - All Time'
        : `Freedom24 Portfolio Report - ${year}`;

    // Title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    // KPI Summary
    const netProfit = data.net_profit;
    const realized = data.total_realized_profit;
    const dividends = data.total_dividends;
    const fees = data.total_fees_paid;
    const positions = Object.keys(data.open_positions).length;

    const summaryData = [
        ['Metric', 'Value'],
        ['Net Profit', `$${netProfit.toFixed(2)}`],
        ['Realized Profit', `$${realized.toFixed(2)}`],
        ['Dividends', `$${dividends.toFixed(2)}`],
        ['Fees', `$${fees.toFixed(2)}`],
        ['Open Positions', positions.toString()]
    ];

    autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Closed Trades
    doc.text('Closed Trades', 14, currentY);
    const tradesData = data.closed_trades.map(t => [
        t.date.toLocaleDateString(),
        t.ticker,
        t.quantity.toString(),
        t.sell_price.toFixed(2),
        t.cost_basis.toFixed(2),
        t.realized_profit.toFixed(2)
    ]);

    autoTable(doc, {
        head: [['Date', 'Ticker', 'Qty', 'Sell Price', 'Cost Basis', 'Profit']],
        body: tradesData,
        startY: currentY + 5,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Dividends
    if (data.dividends.length > 0) {
        // Check if new page needed
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.text('Dividends', 14, currentY);
        const dividendData = data.dividends.map(d => [
            d.date.toLocaleDateString(),
            d.description.substring(0, 50),
            d.amount.toFixed(2)
        ]);

        autoTable(doc, {
            head: [['Date', 'Description', 'Amount']],
            body: dividendData,
            startY: currentY + 5,
            theme: 'striped',
            headStyles: { fillColor: [39, 174, 96] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Fees
    if (data.fees.length > 0) {
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.text('Fees', 14, currentY);
        const feeData = data.fees.map(f => [
            f.date.toLocaleDateString(),
            f.description.substring(0, 50),
            f.amount.toFixed(2)
        ]);

        autoTable(doc, {
            head: [['Date', 'Description', 'Amount']],
            body: feeData,
            startY: currentY + 5,
            theme: 'striped',
            headStyles: { fillColor: [142, 68, 173] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Open Positions
    if (currentY > 250) {
        doc.addPage();
        currentY = 20;
    }

    doc.text('Open Positions', 14, currentY);
    const positionData = Object.entries(data.open_positions).map(([ticker, lots]) => {
        const totalQty = lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const totalCost = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
        return [
            ticker,
            totalQty.toString(),
            avgCost.toFixed(2),
            totalCost.toFixed(2)
        ];
    });

    autoTable(doc, {
        head: [['Ticker', 'Quantity', 'Avg Cost', 'Total Cost']],
        body: positionData,
        startY: currentY + 5,
        theme: 'striped',
        headStyles: { fillColor: [243, 156, 18] }
    });

    doc.save(`freedom24_report_${year.toLowerCase()}.pdf`);
};

export const exportToExcel = (data: CalculationResult, year: string) => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
        ['Metric', 'Value'],
        ['Net Profit', data.net_profit],
        ['Realized Profit', data.total_realized_profit],
        ['Dividends', data.total_dividends],
        ['Fees', data.total_fees_paid],
        ['Open Positions', Object.keys(data.open_positions).length]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Closed Trades
    const tradesData = data.closed_trades.map(t => ({
        Date: t.date,
        Ticker: t.ticker,
        Quantity: t.quantity,
        Sell_Price: t.sell_price,
        Cost_Basis: t.cost_basis,
        Profit: t.realized_profit
    }));
    const wsTrades = XLSX.utils.json_to_sheet(tradesData);
    XLSX.utils.book_append_sheet(wb, wsTrades, 'Closed Trades');

    // Dividends
    const dividendsData = data.dividends.map(d => ({
        Date: d.date,
        Description: d.description,
        Amount: d.amount,
        Currency: d.currency
    }));
    const wsDividends = XLSX.utils.json_to_sheet(dividendsData);
    XLSX.utils.book_append_sheet(wb, wsDividends, 'Dividends');

    // Fees
    const feesData = data.fees.map(f => ({
        Date: f.date,
        Description: f.description,
        Amount: f.amount,
        Currency: f.currency
    }));
    const wsFees = XLSX.utils.json_to_sheet(feesData);
    XLSX.utils.book_append_sheet(wb, wsFees, 'Fees');

    // Open Positions
    const positionsData = Object.entries(data.open_positions).map(([ticker, lots]) => {
        const totalQty = lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const totalCost = lots.reduce((sum, lot) => sum + lot.quantity * lot.unit_cost, 0);
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
        return {
            Ticker: ticker,
            Quantity: totalQty,
            Avg_Cost: avgCost,
            Total_Cost: totalCost
        };
    });
    const wsPositions = XLSX.utils.json_to_sheet(positionsData);
    XLSX.utils.book_append_sheet(wb, wsPositions, 'Open Positions');

    XLSX.writeFile(wb, `freedom24_report_${year.toLowerCase()}.xlsx`);
};
