
import React from 'react';
import { RoadmapIcon, MindMapIcon, SpeakingIcon, OwlIcon } from './Icons';
import { Mode } from '../types';

interface EducationMenuProps {
  onSelect: (mode: Mode) => void;
}

const EducationMenu: React.FC<EducationMenuProps> = ({ onSelect }) => {
  const items = [
    { id: 'roadmap', label: 'Người Vẽ Lộ Trình', icon: <RoadmapIcon className="w-6 h-6 text-blue-500" />, desc: 'Định hướng học tập' },
    { id: 'mind_map', label: 'Sơ Đồ Tư Duy', icon: <MindMapIcon className="w-6 h-6 text-purple-500" />, desc: 'Ghi nhớ kiến thức' },
    { id: 'mock_oral', label: 'Phòng Thi Ảo', icon: <SpeakingIcon className="w-6 h-6 text-red-500" />, desc: 'Luyện nói & Vấn đáp' },
    { id: 'socratic', label: 'Gia Sư Socratic', icon: <OwlIcon className="w-6 h-6 text-amber-600" />, desc: 'Học hiểu bản chất' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4 w-80">
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

export default EducationMenu;