
import React, { useState, useEffect, useRef } from 'react';
import { type User, type PetData } from '../types';
import { BoneIcon, BallIcon, BedIcon, XIcon, MinimizeIcon, GamepadIcon } from './Icons';

interface AIPetProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  onClose: () => void;
}

const DEFAULT_PET: PetData = {
    name: 'Mimi',
    type: 'cat',
    hunger: 80, // 0 = Starving, 100 = Full
    happiness: 80, // 0 = Depressed, 100 = Happy
    energy: 80, // 0 = Exhausted, 100 = Energetic
    lastInteraction: new Date().toISOString()
};

interface Particle {
    id: number;
    x: number;
    y: number;
    content: string;
    color: string;
}

const AIPet: React.FC<AIPetProps> = ({ user, onUpdateUser, onClose }) => {
  const [pet, setPet] = useState<PetData>(user.pet || DEFAULT_PET);
  const [status, setStatus] = useState<'idle' | 'eating' | 'playing' | 'sleeping' | 'refuse'>('idle');
  const [message, setMessage] = useState<string>('Meow!');
  const [isMinimized, setIsMinimized] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Draggable State
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 500 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const timerRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load initial pet data
  useEffect(() => {
      if (user.pet) {
          setPet(user.pet);
      }
      // Adjust initial position if out of bounds (mobile)
      if (window.innerWidth < 768) {
          setPosition({ x: window.innerWidth / 2 - 140, y: window.innerHeight / 2 - 200 });
      }
  }, []);

  // Game Loop (Decay stats)
  useEffect(() => {
      timerRef.current = window.setInterval(() => {
          if (status === 'sleeping') {
              setPet(prev => {
                  const newEnergy = Math.min(100, prev.energy + 5); // Sleep restores energy faster
                  const newHunger = Math.max(0, prev.hunger - 0.2); // Sleep reduces hunger slower
                  if (newEnergy >= 100 && status === 'sleeping') {
                      // Don't wake up automatically, just max out
                  }
                  return { ...prev, energy: newEnergy, hunger: newHunger };
              });
          } else {
              setPet(prev => ({
                  ...prev,
                  hunger: Math.max(0, prev.hunger - 0.8),
                  happiness: Math.max(0, prev.happiness - 0.5),
                  energy: Math.max(0, prev.energy - 0.3)
              }));
          }
      }, 5000);

      return () => {
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, [status]);

  // Update message based on low stats
  useEffect(() => {
      if (status === 'idle') {
          if (pet.hunger < 30) setMessage("Đói quá...");
          else if (pet.energy < 20) setMessage("Buồn ngủ...");
          else if (pet.happiness < 30) setMessage("Chán quá...");
          else setMessage(pet.type === 'cat' ? "Meow!" : "Gâu!");
      }
  }, [pet.hunger, pet.energy, pet.happiness, status, pet.type]);

  // Auto-save
  useEffect(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
          onUpdateUser({ pet: { ...pet, lastInteraction: new Date().toISOString() } });
      }, 10000);
      return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [pet, onUpdateUser]);

  // --- Draggable Handlers ---
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('button')) return; // Don't drag if clicking button
      setIsDragging(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      dragStartRef.current = { x: clientX - position.x, y: clientY - position.y };
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent | TouchEvent) => {
          if (!isDragging) return;
          const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
          
          // Boundary check
          const newX = Math.min(Math.max(0, clientX - dragStartRef.current.x), window.innerWidth - 280);
          const newY = Math.min(Math.max(0, clientY - dragStartRef.current.y), window.innerHeight - 400);
          
          setPosition({ x: newX, y: newY });
      };
      const handleMouseUp = () => setIsDragging(false);

      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          window.addEventListener('touchmove', handleMouseMove, { passive: false });
          window.addEventListener('touchend', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('touchmove', handleMouseMove);
          window.removeEventListener('touchend', handleMouseUp);
      };
  }, [isDragging]);

  // Visual Effects
  const spawnParticle = (content: string, color: string = 'text-white') => {
      const id = Date.now() + Math.random();
      setParticles(prev => [...prev, { id, x: 50, y: 50, content, color }]);
      setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 1000);
  };

  // Actions
  const handleFeed = () => {
      if (status === 'sleeping') { setMessage("Zzz..."); return; }
      if (pet.hunger >= 95) { 
          setStatus('refuse'); 
          setMessage("No quá rồi!"); 
          setTimeout(() => setStatus('idle'), 1000);
          return; 
      }
      
      setStatus('eating');
      setMessage("Yummy!");
      spawnParticle("🍖", "text-orange-500");
      spawnParticle("+No", "text-green-500");
      
      setPet(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + 25) }));
      setTimeout(() => setStatus('idle'), 2000);
  };

  const handlePlay = () => {
      if (status === 'sleeping') { setMessage("Zzz..."); return; }
      if (pet.energy < 20) { 
          setStatus('refuse');
          setMessage("Mệt lắm..."); 
          setTimeout(() => setStatus('idle'), 1000);
          return; 
      }
      if (pet.hunger < 20) { 
          setStatus('refuse');
          setMessage("Đói quá..."); 
          setTimeout(() => setStatus('idle'), 1000);
          return; 
      }

      setStatus('playing');
      setMessage("Vui quá!");
      spawnParticle("🎾", "text-yellow-500");
      spawnParticle("+Vui", "text-pink-500");
      
      setPet(prev => ({ 
          ...prev, 
          happiness: Math.min(100, prev.happiness + 20),
          energy: Math.max(0, prev.energy - 15),
          hunger: Math.max(0, prev.hunger - 10)
      }));
      setTimeout(() => setStatus('idle'), 2000);
  };

  const handleSleep = () => {
      if (status === 'sleeping') {
          setStatus('idle');
          setMessage("Chào buổi sáng!");
          spawnParticle("☀️", "text-yellow-400");
      } else {
          setStatus('sleeping');
          setMessage("Zzz...");
          spawnParticle("💤", "text-blue-400");
      }
  };

  // Visual Helpers
  const getBodyColor = () => {
      switch(pet.type) {
          case 'dog': return 'text-amber-600';
          case 'bunny': return 'text-pink-500';
          case 'robot': return 'text-slate-600';
          case 'cat': default: return 'text-orange-500';
      }
  };

  const getPetFace = () => {
      if (status === 'refuse') return (
          <g>
              <path d="M7 8 L9 10 M9 8 L7 10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M15 8 L17 10 M17 8 L15 10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 16 Q12 14 15 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
      );
      if (status === 'sleeping') return (
          <g className="animate-pulse">
              <path d="M8 14 Q12 17 16 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <text x="18" y="10" fontSize="8" fill="currentColor">Z</text>
              <text x="22" y="6" fontSize="6" fill="currentColor">z</text>
          </g>
      );
      if (status === 'eating') return (
          <g>
              <circle cx="8" cy="10" r="2" fill="currentColor"/>
              <circle cx="16" cy="10" r="2" fill="currentColor"/>
              <circle cx="12" cy="15" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          </g>
      );
      if (status === 'playing') return (
          <g>
              <path d="M7 10 Q8 7 9 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M15 10 Q16 7 17 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 15 Q12 18 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
      );
      // Sad State
      if (pet.happiness < 40 || pet.hunger < 30 || pet.energy < 20) return (
          <g>
              <circle cx="8" cy="11" r="1.5" fill="currentColor"/>
              <circle cx="16" cy="11" r="1.5" fill="currentColor"/>
              <path d="M9 17 Q12 15 15 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 7 L9 8" stroke="currentColor" strokeWidth="1" />
              <path d="M18 7 L15 8" stroke="currentColor" strokeWidth="1" />
          </g>
      );
      // Idle Happy
      return (
          <g>
              <circle cx="8" cy="10" r="2" fill="currentColor"/>
              <circle cx="16" cy="10" r="2" fill="currentColor"/>
              <path d="M10 15 Q12 17 14 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
      );
  };

  const ProgressBar = ({ value, icon, colorClass }: { value: number, icon: React.ReactNode, colorClass: string }) => (
      <div className="flex items-center gap-1.5 w-full group relative" title={`${Math.round(value)}%`}>
          <div className="w-4 h-4 text-gray-600 dark:text-gray-400">{icon}</div>
          <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-700 rounded-sm overflow-hidden border border-gray-400/30 relative">
              <div 
                  className={`h-full transition-all duration-500 ${value < 30 ? 'bg-red-500 animate-pulse' : colorClass}`} 
                  style={{ width: `${value}%` }}
              />
          </div>
      </div>
  );

  if (isMinimized) {
      return (
          <div className="fixed bottom-24 right-4 z-50 animate-slide-in-up">
              <button 
                  onClick={() => setIsMinimized(false)}
                  className="bg-white dark:bg-slate-800 border-4 border-brand w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform overflow-hidden relative group"
              >
                  <div className={`absolute inset-0 opacity-20 ${getBodyColor().replace('text', 'bg')}`}></div>
                  <svg viewBox="0 0 24 24" className={`w-10 h-10 ${getBodyColor()}`}>
                      <path d="M4 18 C4 18 3 6 12 6 C21 6 20 18 20 18 Z" fill="currentColor" />
                      <path d="M4 8 L2 2 L8 6 Z" fill="currentColor" />
                      <path d="M20 8 L22 2 L16 6 Z" fill="currentColor" />
                      <g transform="translate(0, 2)" className="text-black/70">{getPetFace()}</g>
                  </svg>
                  {(pet.hunger < 30 || pet.energy < 20) && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-white animate-pulse"></span>}
              </button>
          </div>
      );
  }

  return (
    <div 
        className="fixed z-50 font-mono animate-slide-in-up select-none"
        style={{ 
            left: position.x, 
            top: position.y, 
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'auto'
        }}
    >
        {/* Console Body */}
        <div className="w-72 bg-gray-100 dark:bg-slate-800 rounded-[30px] shadow-[0_10px_30px_rgba(0,0,0,0.3),inset_0_-4px_0_rgba(0,0,0,0.1)] border-4 border-gray-300 dark:border-slate-600 relative overflow-hidden pb-4">
            
            {/* Draggable Handle / Header */}
            <div 
                className="bg-gray-300 dark:bg-slate-700 h-8 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing border-b border-gray-400 dark:border-slate-600"
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <span className="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Tamagotchi AI</span>
                <div className="flex gap-1.5">
                    <button onClick={() => setIsMinimized(true)} className="hover:text-brand transition-colors"><MinimizeIcon className="w-3 h-3" /></button>
                    <button onClick={onClose} className="hover:text-red-500 transition-colors"><XIcon className="w-3 h-3" /></button>
                </div>
            </div>

            {/* LCD Screen */}
            <div className="mx-4 mt-4 p-1 bg-gray-400 rounded-lg shadow-inner">
                <div className="bg-[#9ea792] h-40 w-full rounded border-2 border-[#8b9380] shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] relative flex flex-col items-center justify-between py-2 overflow-hidden">
                    {/* Scanlines Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-10 opacity-20"></div>
                    
                    {/* Stats Overlay */}
                    <div className="w-full px-2 flex justify-between items-center z-20 text-[9px] font-bold text-[#4a5043] opacity-70">
                        <span>LV.{user.level}</span>
                        <div className="flex gap-1">
                            {status === 'sleeping' ? '🌙' : '☀️'}
                        </div>
                    </div>

                    {/* Message Bubble */}
                    <div className="relative z-20 mb-1 h-6">
                        <div className="bg-[#c4cfbb] border-2 border-[#4a5043] px-2 py-1 rounded-lg text-[10px] font-bold text-[#2d3326] shadow-sm animate-message-pop-in whitespace-nowrap">
                            {message}
                        </div>
                    </div>

                    {/* Pet Sprite */}
                    <div className={`relative w-20 h-20 z-20 transition-all duration-300 
                        ${status === 'playing' ? 'animate-bounce' : ''}
                        ${status === 'eating' ? 'scale-110' : ''}
                        ${status === 'sleeping' ? 'opacity-80 scale-95 translate-y-2' : ''}
                        ${status === 'refuse' ? 'animate-shake' : ''}
                    `}>
                        <svg viewBox="0 0 24 24" className={`w-full h-full drop-shadow-sm ${getBodyColor()}`}>
                            <path d="M4 18 C4 18 3 6 12 6 C21 6 20 18 20 18 Z" fill="currentColor" />
                            <path d="M4 8 L2 2 L8 6 Z" fill="currentColor" />
                            <path d="M20 8 L22 2 L16 6 Z" fill="currentColor" />
                            <g transform="translate(0, 2)" className="text-black/70">
                                {getPetFace()}
                            </g>
                        </svg>
                        
                        {/* Floating Particles */}
                        {particles.map(p => (
                            <div 
                                key={p.id}
                                className={`absolute text-lg font-bold ${p.color} animate-float-up`}
                                style={{ left: `${p.x}%`, top: `${p.y}%`, pointerEvents: 'none' }}
                            >
                                {p.content}
                            </div>
                        ))}
                    </div>
                    
                    {/* Name */}
                    <div className="z-20 text-[10px] font-bold text-[#2d3326] uppercase tracking-widest mt-auto">
                        {pet.name}
                    </div>
                </div>
            </div>

            {/* Control Panel */}
            <div className="p-4 space-y-3">
                {/* Status Bars */}
                <div className="space-y-1.5 bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                    <ProgressBar value={pet.hunger} icon={<BoneIcon className="w-3 h-3"/>} colorClass="bg-green-500" />
                    <ProgressBar value={pet.happiness} icon={<BallIcon className="w-3 h-3"/>} colorClass="bg-yellow-400" />
                    <ProgressBar value={pet.energy} icon={<BedIcon className="w-3 h-3"/>} colorClass="bg-blue-500" />
                </div>

                {/* Physical Buttons */}
                <div className="flex justify-between items-center gap-2 px-1">
                    <button 
                        onClick={handleFeed}
                        disabled={status === 'sleeping'}
                        className="group flex flex-col items-center gap-1 focus:outline-none disabled:opacity-50 transition-opacity"
                    >
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 shadow-[0_3px_0_#9ca3af] active:shadow-none active:translate-y-[3px] transition-all flex items-center justify-center border border-gray-300 dark:border-slate-500">
                            <BoneIcon className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Ăn</span>
                    </button>

                    <button 
                        onClick={handlePlay}
                        disabled={status === 'sleeping'}
                        className="group flex flex-col items-center gap-1 focus:outline-none mt-4 disabled:opacity-50 transition-opacity" 
                    >
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 shadow-[0_3px_0_#9ca3af] active:shadow-none active:translate-y-[3px] transition-all flex items-center justify-center border border-gray-300 dark:border-slate-500">
                            <BallIcon className="w-5 h-5 text-yellow-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Chơi</span>
                    </button>

                    <button 
                        onClick={handleSleep}
                        className="group flex flex-col items-center gap-1 focus:outline-none"
                    >
                        <div className={`w-10 h-10 rounded-full shadow-[0_3px_0_#9ca3af] active:shadow-none active:translate-y-[3px] transition-all flex items-center justify-center border border-gray-300 dark:border-slate-500 ${status === 'sleeping' ? 'bg-blue-100 dark:bg-blue-900/50 shadow-none translate-y-[3px]' : 'bg-gray-200 dark:bg-slate-700'}`}>
                            <BedIcon className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase">{status === 'sleeping' ? 'Dậy' : 'Ngủ'}</span>
                    </button>
                </div>
            </div>
        </div>
        
        {/* CSS for Particle Animation */}
        <style>{`
            @keyframes float-up {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                100% { transform: translateY(-30px) scale(1.5); opacity: 0; }
            }
            .animate-float-up { animation: float-up 1s ease-out forwards; }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
    </div>
  );
};

export default AIPet;
