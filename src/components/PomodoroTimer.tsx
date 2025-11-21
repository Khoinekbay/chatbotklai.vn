
import React, { useState, useEffect, useRef } from 'react';
import { XIcon, MinimizeIcon, RestoreIcon } from './Icons';

interface PomodoroTimerProps {
  onClose: () => void;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onClose }) => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Use a ref to persist audio context
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
      if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
              audioContextRef.current = new AudioContext();
          }
      }
      // Resume context if suspended (browser policy)
      if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
      }
  };

  const playNotificationSound = () => {
    try {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        // Different tones for work vs break
        osc.frequency.value = mode === 'work' ? 523.25 : 880; // C5 vs A5
        
        gain.gain.value = 0.1;
        
        osc.start();
        // Fade out
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    let interval: number | null = null;

    if (isActive) {
      interval = window.setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
             // Timer finished
             setIsActive(false);
             playNotificationSound();
             
             if (mode === 'work') {
                 if (Notification.permission === 'granted') {
                     new Notification("Hết giờ học!", { body: "Hãy nghỉ ngơi 5 phút nhé." });
                 }
                 setMode('break');
                 setMinutes(5);
             } else {
                 if (Notification.permission === 'granted') {
                     new Notification("Hết giờ nghỉ!", { body: "Quay lại học tập nào." });
                 }
                 setMode('work');
                 setMinutes(25);
             }
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    } else if (!isActive && interval) {
      clearInterval(interval);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isActive, minutes, seconds, mode]);
  
  useEffect(() => {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
      }
  }, []);

  const toggleTimer = () => {
      if (!isActive) {
          // Initialize audio on user interaction (Click Start)
          initAudio();
      }
      setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'work') {
        setMinutes(25);
    } else {
        setMinutes(5);
    }
    setSeconds(0);
  };

  const switchMode = (newMode: 'work' | 'break') => {
      setMode(newMode);
      setIsActive(false);
      setSeconds(0);
      if (newMode === 'work') setMinutes(25);
      else setMinutes(5);
  };

  const formatTime = (time: number) => time < 10 ? `0${time}` : time;

  if (isMinimized) {
      return (
          <div className="fixed bottom-20 right-4 z-50 animate-slide-in-up">
              <button 
                  onClick={() => setIsMinimized(false)}
                  className="bg-brand text-white w-14 h-14 rounded-full shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
              >
                  <span className="text-xs font-bold">{formatTime(minutes)}:{formatTime(seconds)}</span>
                  <span className="text-[8px] uppercase">{mode === 'work' ? 'Học' : 'Nghỉ'}</span>
              </button>
          </div>
      );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-in-up">
        <div className={`p-3 flex items-center justify-between ${mode === 'work' ? 'bg-brand text-white' : 'bg-green-600 text-white'}`}>
            <span className="font-bold text-sm flex items-center gap-2">
                {mode === 'work' ? '📚 Giờ Học' : '☕ Giờ Nghỉ'}
            </span>
            <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/20 rounded"><MinimizeIcon className="w-3 h-3" /></button>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><XIcon className="w-3 h-3" /></button>
            </div>
        </div>
        
        <div className="p-5 flex flex-col items-center">
            <div className="text-4xl font-mono font-bold text-text-primary mb-4 tracking-widest">
                {formatTime(minutes)}:{formatTime(seconds)}
            </div>
            
            <div className="flex gap-2 w-full mb-4">
                <button 
                    onClick={toggleTimer}
                    className={`flex-1 py-2 rounded-lg font-medium text-white transition-all ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-brand hover:bg-brand/90'}`}
                >
                    {isActive ? 'Dừng' : 'Bắt đầu'}
                </button>
                <button 
                    onClick={resetTimer}
                    className="px-3 py-2 rounded-lg bg-sidebar hover:bg-card-hover text-text-secondary border border-border transition-colors"
                >
                    Reset
                </button>
            </div>

            <div className="flex gap-2 text-xs w-full">
                 <button 
                    onClick={() => switchMode('work')}
                    className={`flex-1 py-1 rounded border ${mode === 'work' ? 'bg-brand/10 border-brand text-brand' : 'bg-transparent border-border text-text-secondary'}`}
                 >
                     25p Học
                 </button>
                 <button 
                    onClick={() => switchMode('break')}
                    className={`flex-1 py-1 rounded border ${mode === 'break' ? 'bg-green-500/10 border-green-500 text-green-600' : 'bg-transparent border-border text-text-secondary'}`}
                 >
                     5p Nghỉ
                 </button>
            </div>
        </div>
    </div>
  );
};

export default PomodoroTimer;
