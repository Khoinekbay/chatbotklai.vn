
import React, { useState, useEffect } from 'react';
import { XIcon } from './Icons';

interface BreathingExerciseProps {
  onClose: () => void;
}

const BreathingExercise: React.FC<BreathingExerciseProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [seconds, setSeconds] = useState(4);
  const [instruction, setInstruction] = useState('Hít vào...');

  useEffect(() => {
    let interval: number | null = null;
    
    // 4-7-8 Breathing Technique
    // Inhale: 4s
    // Hold: 7s
    // Exhale: 8s

    const runCycle = () => {
        if (phase === 'inhale') {
            if (seconds > 1) {
                setSeconds(s => s - 1);
            } else {
                setPhase('hold');
                setSeconds(7);
                setInstruction('Giữ hơi...');
            }
        } else if (phase === 'hold') {
             if (seconds > 1) {
                setSeconds(s => s - 1);
            } else {
                setPhase('exhale');
                setSeconds(8);
                setInstruction('Thở ra...');
            }
        } else {
             if (seconds > 1) {
                setSeconds(s => s - 1);
            } else {
                setPhase('inhale');
                setSeconds(4);
                setInstruction('Hít vào...');
            }
        }
    };

    interval = window.setInterval(runCycle, 1000);
    return () => { if (interval) clearInterval(interval); };
  }, [seconds, phase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-slide-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <XIcon className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center gap-8">
             <div className={`relative flex items-center justify-center w-64 h-64 rounded-full border-4 border-white/30 transition-all duration-1000 ease-in-out
                 ${phase === 'inhale' ? 'scale-125 bg-blue-500/40 border-blue-400' : 
                   phase === 'hold' ? 'scale-125 bg-purple-500/40 border-purple-400' : 
                   'scale-90 bg-green-500/40 border-green-400'}
             `}>
                 <div className="absolute inset-0 rounded-full animate-pulse opacity-30 bg-white blur-2xl"></div>
                 <span className="text-5xl font-bold text-white relative z-10">{seconds}</span>
             </div>
             
             <div className="text-center space-y-2">
                 <h2 className="text-3xl font-bold text-white tracking-wider transition-all">{instruction}</h2>
                 <p className="text-white/60 text-sm">Kỹ thuật thở 4-7-8 giúp giảm căng thẳng</p>
             </div>
        </div>
    </div>
  );
};

export default BreathingExercise;