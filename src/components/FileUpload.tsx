
import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { ProfitCalculator } from '../lib/calculator';

interface FileUploadProps {
    onCalculationComplete: (result: any) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onCalculationComplete }) => {
    const [tradesFile, setTradesFile] = useState<File | null>(null);
    const [feesFile, setFeesFile] = useState<File | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [method, setMethod] = useState<'FIFO' | 'AVG'>('FIFO');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'trades' | 'fees') => {
        if (e.target.files && e.target.files[0]) {
            if (type === 'trades') setTradesFile(e.target.files[0]);
            else setFeesFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleCalculate = async () => {
        if (!tradesFile) {
            setError("Please upload the Trades Excel file.");
            return;
        }

        setIsCalculating(true);
        setError(null);

        try {
            const calculator = new ProfitCalculator();

            // Read files
            const tradesBuffer = await tradesFile.arrayBuffer();
            await calculator.loadTrades(tradesBuffer);

            if (feesFile) {
                const feesBuffer = await feesFile.arrayBuffer();
                await calculator.loadFees(feesBuffer);
            }

            const result = calculator.calculate(method);
            onCalculationComplete(result);
        } catch (err: any) {
            console.error(err);
            setError("Failed to process files. Please ensure they are valid Freedom24 reports.");
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto p-6 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Freedom24 Profit Calculator
                </h1>
                <p className="text-gray-400">
                    Upload your official reports to visualize realized profits.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Trades File Input */}
                <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${tradesFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-700 hover:border-gray-500'}`}>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => handleFileChange(e, 'trades')}
                        className="hidden"
                        id="trades-upload"
                    />
                    <label htmlFor="trades-upload" className="cursor-pointer flex flex-col items-center gap-4">
                        {tradesFile ? <CheckCircle className="w-12 h-12 text-emerald-400" /> : <FileSpreadsheet className="w-12 h-12 text-blue-400" />}
                        <span className="text-sm font-medium text-gray-300">
                            {tradesFile ? tradesFile.name : "Select Trades.xlsx"}
                        </span>
                    </label>
                </div>

                {/* Fees File Input */}
                <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${feesFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-700 hover:border-gray-500'}`}>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => handleFileChange(e, 'fees')}
                        className="hidden"
                        id="fees-upload"
                    />
                    <label htmlFor="fees-upload" className="cursor-pointer flex flex-col items-center gap-4">
                        {feesFile ? <CheckCircle className="w-12 h-12 text-emerald-400" /> : <FileSpreadsheet className="w-12 h-12 text-purple-400" />}
                        <span className="text-sm font-medium text-gray-300">
                            {feesFile ? feesFile.name : "Select fees.xlsx (Optional)"}
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex gap-4 items-center bg-gray-800/50 p-2 rounded-lg">
                <span className="text-sm text-gray-400 px-2">Cost Basis:</span>
                <button
                    onClick={() => setMethod('FIFO')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${method === 'FIFO' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                    FIFO
                </button>
                <button
                    onClick={() => setMethod('AVG')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${method === 'AVG' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                    Avg Cost
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <button
                onClick={handleCalculate}
                disabled={isCalculating || !tradesFile}
                className="w-full max-w-sm btn-primary py-4 text-lg shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isCalculating ? "Processing..." : "Calculate Profits 🚀"}
            </button>
        </div>
    );
};
