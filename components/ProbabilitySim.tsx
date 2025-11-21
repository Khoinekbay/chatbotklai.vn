

import React, { useState } from 'react';

const ProbabilitySim: React.FC = () => {
  const [mode, setMode] = useState<'coin' | 'dice'>('coin');
  const [history, setHistory] = useState<(string | number)[]>([]);
  const [animating, setAnimating] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | number | null>(null);

  const roll = () => {
      if (animating) return;
      setAnimating(true);
      setCurrentResult(null);

      setTimeout(() => {
          let result: string | number;
          if (mode === 'coin') {
              result = Math.random() > 0.5 ? 'Ngửa' : 'Sấp';
          } else {
              result = Math.floor(Math.random() * 6) + 1;
          }
          
          setCurrentResult(result);
          setHistory(prev => [result, ...prev].slice(0, 20)); // Keep last 20
          setAnimating(false);
      }, 600);
  };

  const reset = () => {
      setHistory([]);
      setCurrentResult(null);
  };

  return (
    <div className="p-4 flex flex-col h-full gap-4">
        <div className="flex justify-center gap-4 border-b border-border pb-4">
            <button 
                onClick={() => { setMode('coin'); reset(); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'coin' ? 'bg-brand text-white' : 'bg-input-bg text-text-secondary'}`}
            >
                Tung Đồng Xu
            </button>
            <button 
                onClick={() => { setMode('dice'); reset(); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'dice' ? 'bg-brand text-white' : 'bg-input-bg text-text-secondary'}`}
            >
                Gieo Xúc Xắc
            </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[200px]">
            <div className={`w-32 h-32 flex items-center justify-center rounded-2xl shadow-xl text-4xl font-bold transition-all duration-300 ${animating ? 'animate-spin scale-90 bg-gray-300' : 'bg-card border-4 border-brand text-brand scale-100'}`}>
                {animating ? '...' : currentResult ?? '?'}
            </div>
            
            <button 
                onClick={roll}
                disabled={animating}
                className="px-8 py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
                {mode === 'coin' ? 'TUNG' : 'GIEO'}
            </button>
        </div>

        <div className="bg-input-bg rounded-lg p-3">
            <h4 className="text-xs font-bold text-text-secondary uppercase mb-2">Lịch sử (Gần nhất)</h4>
            <div className="flex flex-wrap gap-2">
                {history.map((h, i) => (
                    <span key={i} className="px-2 py-1 bg-card rounded border border-border text-sm">
                        {h}
                    </span>
                ))}
                {history.length === 0 && <span className="text-xs text-text-secondary italic">Chưa có dữ liệu</span>}
            </div>
        </div>
    </div>
  );
};

export default ProbabilitySim;