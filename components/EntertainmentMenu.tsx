

import React from 'react';
import { GamepadIcon, TarotIcon, WindIcon, FireIcon, GenieIcon, PuzzleIcon } from './Icons';
import { Mode } from '../types';

interface EntertainmentMenuProps {
  onSelect: (mode: Mode | 'breathing') => void;
}

const EntertainmentMenu: React.FC<EntertainmentMenuProps> = ({ onSelect }) => {
  const items = [
    { id: 'tarot', label: 'Bói Tarot AI', icon: <TarotIcon className="w-6 h-6 text-purple-500" />, desc: 'Giải mã tương lai' },
    { id: 'breathing', label: 'Góc Thở & Thiền', icon: <WindIcon className="w-6 h-6 text-cyan-500" />, desc: 'Giảm stress 4-7-8' },
    { id: 'roast', label: 'Chế độ Mỏ Hỗn', icon: <FireIcon className="w-6 h-6 text-red-500" />, desc: 'AI xéo xắt & hài hước' },
    { id: 'rpg', label: 'Game Nhập Vai', icon: <GamepadIcon className="w-6 h-6 text-green-500" />, desc: 'Phiêu lưu cốt truyện' },
    { id: 'akinator', label: 'Thần đèn Akinator', icon: <GenieIcon className="w-6 h-6 text-yellow-500" />, desc: 'Đoán nhân vật' },
    { id: 'mbti', label: 'Trắc nghiệm MBTI', icon: <PuzzleIcon className="w-6 h-6 text-blue-500" />, desc: 'Khám phá tính cách' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4 w-80 max-h-[60vh] overflow-y-auto">
        {items.map(item => (
            <button
                key={item.id}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(item.id as any);
                }}
                className="flex flex-col items-center text-center p-3 rounded-xl bg-input-bg hover:bg-sidebar border border-transparent hover:border-border transition-all active:scale-95 group"
            >
                <div className="w-10 h-10 rounded-full bg-card shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {item.icon}
                </div>
                <h4 className="font-bold text-sm text-text-primary">{item.label}</h4>
                <p className="text-[10px] text-text-secondary">{item.desc}</p>
            </button>
        ))}
    </div>
  );
};

export default EntertainmentMenu;