
import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { CalculationResult } from './lib/types';

function App() {
  const [result, setResult] = useState<CalculationResult | null>(null);

  return (
    <div className="bg-[#121212] w-screen h-screen text-white overflow-hidden">
      {result ? (
        <Dashboard data={result} onReset={() => setResult(null)} />
      ) : (
        <FileUpload onCalculationComplete={setResult} />
      )}
    </div>
  );
}

export default App;