
import React, { useState } from 'react';
import { TarotIcon, MagicIcon } from './Icons';

interface TarotReaderProps {
  onReadingRequest: (cardName: string, question: string) => void;
  onClose: () => void;
}

// Simplified Major Arcana list
const MAJOR_ARCANA = [
    "The Fool (Gã Khờ)", "The Magician (Ảo Thuật Gia)", "The High Priestess (Nữ Tu)", "The Empress (Hoàng Hậu)", 
    "The Emperor (Hoàng Đế)", "The Hierophant (Giáo Hoàng)", "The Lovers (Tình Nhân)", "The Chariot (Cỗ Xe)", 
    "Strength (Sức Mạnh)", "The Hermit (Ẩn Sĩ)", "Wheel of Fortune (Bánh Xe Số Phận)", "Justice (Công Lý)", 
    "The Hanged Man (Người Treo Ngược)", "Death (Cái Chết)", "Temperance (Sự Cân Bằng)", "The Devil (Ác Quỷ)", 
    "The Tower (Tòa Tháp)", "The Star (Ngôi Sao)", "The Moon (Mặt Trăng)", "The Sun (Mặt Trời)", 
    "Judgement (Phán Xét)", "The World (Thế Giới)"
];

const TarotReader: React.FC<TarotReaderProps> = ({ onReadingRequest, onClose }) => {
  const [question, setQuestion] = useState('');
  const [step, setStep] = useState<'input' | 'shuffle' | 'reveal'>('input');
  const [drawnCard, setDrawnCard] = useState<string | null>(null);

  const handleStart = () => {
      if (!question.trim()) return;
      setStep('shuffle');
      setTimeout(() => {
          const randomIndex = Math.floor(Math.random() * MAJOR_ARCANA.length);
          setDrawnCard(MAJOR_ARCANA[randomIndex]);
          setStep('reveal');
      }, 2000); // Shuffle animation time
  };

  const handleInterpret = () => {
      if (drawnCard) {
          onReadingRequest(drawnCard, question);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-slide-in-up">
        <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col items-center p-8 relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary">✕</button>
            
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
                <TarotIcon className="w-8 h-8 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center font-serif">Tarot Huyền Bí</h2>

            {step === 'input' && (
                <div className="w-full space-y-4 animate-slide-in-up">
                    <p className="text-center text-text-secondary text-sm">Hãy tập trung vào vấn đề của bạn và nhập câu hỏi bên dưới.</p>
                    <textarea 
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        className="w-full p-3 bg-input-bg border border-border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24"
                        placeholder="Ví dụ: Crush có thích mình không? Sắp tới công việc thế nào?..."
                    />
                    <button 
                        onClick={handleStart}
                        disabled={!question.trim()}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
                    >
                        🔮 Rút Bài
                    </button>
                </div>
            )}

            {step === 'shuffle' && (
                <div className="flex flex-col items-center gap-4 py-8">
                    <div className="relative w-32 h-48">
                        <div className="absolute inset-0 bg-purple-800 rounded-lg border-2 border-white/20 animate-ping opacity-20"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-purple-900 rounded-lg border-2 border-purple-400 flex items-center justify-center animate-pulse">
                             <span className="text-4xl">🎴</span>
                        </div>
                    </div>
                    <p className="text-purple-400 font-medium animate-pulse">Đang tráo bài...</p>
                </div>
            )}

            {step === 'reveal' && drawnCard && (
                <div className="flex flex-col items-center gap-6 w-full animate-slide-in-up">
                    <div className="w-40 h-60 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl border-4 border-amber-400/50 shadow-2xl flex flex-col items-center justify-center p-4 text-center relative overflow-hidden group">
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                         <MagicIcon className="w-12 h-12 text-amber-400 mb-2" />
                         <h3 className="text-amber-100 font-serif font-bold text-lg relative z-10">{drawnCard}</h3>
                    </div>
                    
                    <div className="text-center">
                        <p className="text-text-secondary text-sm">Bạn đã rút được lá</p>
                        <h3 className="text-xl font-bold text-brand">{drawnCard}</h3>
                    </div>

                    <button 
                        onClick={handleInterpret}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                        <MagicIcon className="w-5 h-5" />
                        Giải Mã Ngay
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default TarotReader;
