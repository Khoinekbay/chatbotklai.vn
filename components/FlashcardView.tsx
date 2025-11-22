
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Flashcard } from '../types';
import { XIcon, ShuffleIcon, RestoreIcon, PlusIcon } from './Icons';

interface FlashcardViewProps {
  flashcards: Flashcard[];
  onClose: () => void;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ flashcards, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cards, setCards] = useState(flashcards);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none');
  
  // Adding new card state
  const [isAdding, setIsAdding] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newDefinition, setNewDefinition] = useState('');

  // Touch handling refs
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const ignoreClickRef = useRef(false);

  useEffect(() => {
    setCards(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSlideDirection('none');
  }, [flashcards]);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setSlideDirection('right');
      setTimeout(() => setCurrentIndex(prev => prev + 1), 50);
    }
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setSlideDirection('left');
      setTimeout(() => setCurrentIndex(prev => prev - 1), 50);
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isAdding) return;
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
    }
    if (e.key === 'Escape') onClose();
  }, [handleNext, handlePrev, onClose, isAdding]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSlideDirection('none');
  };

  const handleReset = () => {
    setCards(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSlideDirection('none');
  };
  
  const handleAddCard = () => {
      if (!newTerm.trim() || !newTranslation.trim()) return;
      
      const newCard: Flashcard = { 
          term: newTerm.trim(), 
          translation: newTranslation.trim(),
          definition: newDefinition.trim() 
      };
      setCards(prev => [...prev, newCard]);
      setNewTerm('');
      setNewTranslation('');
      setNewDefinition('');
      setIsAdding(false);
      
      setIsFlipped(false);
      setSlideDirection('right');
      setTimeout(() => setCurrentIndex(cards.length), 50);
  };

  // --- Touch & Swipe Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY
      };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current || isAdding) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartRef.current.x - touchEndX;
      const diffY = touchStartRef.current.y - touchEndY;
      
      touchStartRef.current = null;

      // Swipe Detection (Threshold 50px, dominant horizontal)
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          if (diffX > 0) handleNext(); // Swipe Left -> Next
          else handlePrev(); // Swipe Right -> Prev
          
          ignoreClickRef.current = true;
          setTimeout(() => ignoreClickRef.current = false, 300);
      } 
      // Tap Detection (Movement < 10px)
      else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
          setIsFlipped(prev => !prev);
          ignoreClickRef.current = true;
          setTimeout(() => ignoreClickRef.current = false, 300);
      }
  };

  const handleClick = (e: React.MouseEvent) => {
      if (isAdding) return;
      if (ignoreClickRef.current) return;
      
      e.preventDefault();
      setIsFlipped(prev => !prev);
  };

  const progress = ((currentIndex + 1) / cards.length) * 100;

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-slide-in-up">
      <div className="w-full max-w-3xl flex flex-col gap-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center text-white">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">📚</span> 
            <div>
                <span className="block text-lg font-semibold leading-tight">Học Flashcard</span>
                <span className="text-sm text-white/80 font-medium bg-white/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                    Thẻ {currentIndex + 1} / {cards.length}
                </span>
            </div>
          </h2>
          <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
             <button onClick={() => setIsAdding(true)} className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white" title="Thêm thẻ mới">
                <PlusIcon className="w-5 h-5" />
             </button>
             <button onClick={handleReset} className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white" title="Khôi phục gốc">
                <RestoreIcon className="w-5 h-5" />
             </button>
             <button onClick={handleShuffle} className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white" title="Trộn thẻ">
                <ShuffleIcon className="w-5 h-5" />
             </button>
             <div className="w-[1px] h-5 bg-white/20 mx-1"></div>
             <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/80 transition-colors text-white">
                <XIcon className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
        </div>

        {/* Card Container */}
        <div className="perspective-1000 w-full h-[400px] relative group touch-pan-y">
          
          {isAdding && (
              <div className="absolute inset-0 z-20 bg-card rounded-3xl p-6 md:p-8 flex flex-col gap-3 shadow-2xl border-2 border-brand animate-message-pop-in overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold text-text-primary text-center mb-2">Thêm thẻ mới</h3>
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-text-secondary uppercase">Từ vựng (English)</label>
                      <input autoFocus type="text" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="w-full p-3 bg-input-bg border border-border rounded-xl focus:ring-2 focus:ring-brand outline-none text-text-primary" placeholder="VD: Apple" />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-text-secondary uppercase">Nghĩa (Tiếng Việt)</label>
                      <input type="text" value={newTranslation} onChange={(e) => setNewTranslation(e.target.value)} className="w-full p-3 bg-input-bg border border-border rounded-xl focus:ring-2 focus:ring-brand outline-none text-text-primary font-medium" placeholder="VD: Quả táo" />
                  </div>
                  <div className="space-y-1 flex-1">
                      <label className="text-xs font-bold text-text-secondary uppercase">Ví dụ / Giải thích thêm (Optional)</label>
                      <textarea value={newDefinition} onChange={(e) => setNewDefinition(e.target.value)} className="w-full h-full min-h-[80px] p-3 bg-input-bg border border-border rounded-xl focus:ring-2 focus:ring-brand outline-none resize-none text-text-primary" placeholder="VD: A round fruit..." />
                  </div>
                  <div className="flex gap-3 mt-2">
                      <button onClick={() => setIsAdding(false)} className="flex-1 py-3 bg-sidebar hover:bg-card-hover text-text-primary font-bold rounded-xl transition-colors">Hủy</button>
                      <button onClick={handleAddCard} disabled={!newTerm.trim() || !newTranslation.trim()} className="flex-1 py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl transition-colors disabled:opacity-50">Thêm</button>
                  </div>
              </div>
          )}

          <div 
            key={currentIndex}
            className={`
                relative w-full h-full transform-style-3d shadow-2xl rounded-3xl cursor-pointer flip-transition
                hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${isFlipped ? 'rotate-y-180' : ''}
                ${slideDirection === 'right' ? 'animate-slide-right' : slideDirection === 'left' ? 'animate-slide-left' : ''}
                select-none touch-manipulation
            `}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-card border border-border rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-inner">
               <div className="flex-1 flex flex-col items-center justify-center w-full animate-content-pop">
                   <span className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-6 px-3 py-1 bg-sidebar rounded-full border border-border">Từ vựng</span>
                   <h3 className="text-4xl md:text-6xl font-bold text-text-primary leading-tight break-words max-w-full">{cards[currentIndex].term}</h3>
               </div>
               <p className="mt-auto text-xs text-text-secondary animate-pulse flex items-center gap-1 pt-4 opacity-60">👆 Chạm để lật - Vuốt để chuyển</p>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-brand/5 to-purple-500/5 border-2 border-brand/30 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-card shadow-lg">
               <div className="flex-1 flex flex-col items-center justify-center w-full">
                   <span className="text-xs font-bold text-brand uppercase tracking-widest mb-4 px-3 py-1 bg-brand/10 rounded-full">Nghĩa</span>
                   <h3 className="text-3xl md:text-5xl font-bold text-text-primary leading-tight break-words max-w-full mb-6">{cards[currentIndex].translation}</h3>
                   {cards[currentIndex].definition && (
                       <div className="relative w-full max-w-md">
                           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-border"></div>
                           <p className="text-lg md:text-xl text-text-secondary leading-relaxed italic mt-6 px-4">"{cards[currentIndex].definition}"</p>
                       </div>
                   )}
               </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 w-full max-w-lg mx-auto px-2">
          <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0 || isAdding} 
            className="flex-1 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-white border border-white/10 flex items-center justify-center"
          >
            ← <span className="hidden sm:inline ml-2">Quay lại</span>
          </button>
          
          <button 
            onClick={() => setIsFlipped(p => !p)} 
            disabled={isAdding} 
            className="flex-1 py-3 rounded-xl font-bold bg-brand/80 hover:bg-brand text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-white/10"
          >
             <span className="text-xl font-serif">↺</span> <span className="text-sm">Lật</span>
          </button>

          <button 
            onClick={handleNext} 
            disabled={currentIndex === cards.length - 1 || isAdding} 
            className="flex-1 py-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 flex items-center justify-center"
          >
            <span className="hidden sm:inline mr-2">Tiếp theo</span> →
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardView;
