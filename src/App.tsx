
import { useLocalStorage } from './hooks/useLocalStorage';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { CalculationResult } from './lib/types';

function App() {
  const [result, setResult] = useLocalStorage<CalculationResult | null>('freedom24-data', null);
  const handleReset = () => {
    localStorage.removeItem('freedom24-data');
    setResult(null);
  };

  return (
    <div className="bg-[#121212] w-screen h-screen text-white overflow-hidden">
      {result ? (
        <Dashboard data={result} onReset={handleReset} />
      ) : (
        <FileUpload onCalculationComplete={setResult} />
      )}
    </div>
  );
}

export default App;
