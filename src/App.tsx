
import { useLocalStorage } from './hooks/useLocalStorage';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { CalculationResult } from './lib/types';

function App() {
  const [result, setResult] = useLocalStorage<CalculationResult | null>('freedom24-data', null);

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