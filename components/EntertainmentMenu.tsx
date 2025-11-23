
import React from 'react';
import { GamepadIcon, TarotIcon, WindIcon, FireIcon, GenieIcon, PuzzleIcon, FaceMaskIcon, SwordsIcon, SpyIcon, MicStageIcon, EmojiPuzzleIcon, BrokenHeartIcon, BurgerIcon, TShirtIcon, WolfIcon, ScrollIcon, MicBattleIcon, PawIcon } from './Icons';
import { Mode } from '../types';

interface EntertainmentMenuProps {
  onSelect: (mode: Mode | 'breathing' | 'pet') => void;
}

const EntertainmentMenu: React.FC<EntertainmentMenuProps> = ({ onSelect }) => {
  const items = [
    { id: 'pet', label: 'Thú Cưng AI', icon: <PawIcon className="w-6 h-6 text-orange-500" />, desc: 'Nuôi mèo ảo (Beta)' },
    { id: 'face_reading', label: 'Nhân Tướng Học', icon: <FaceMaskIcon className="w-6 h-6 text-pink-500" />, desc: 'AI xem tướng mặt' },
    { id: 'fashion_police', label: 'Cảnh Sát Thời Trang', icon: <TShirtIcon className="w-6 h-6 text-indigo-500" />, desc: 'Chấm điểm outfit' },
    { id: 'debate', label: 'Sàn Đấu Tranh Biện', icon: <SwordsIcon className="w-6 h-6 text-orange-600" />, desc: 'Thử thách tư duy' },
    { id: 'rap_battle', label: 'Rap Battle vs AI', icon: <MicBattleIcon className="w-6 h-6 text-red-600" />, desc: 'Đối kháng rap gắt' },
    { id: 'mystery', label: 'Thám Tử Tâm Linh', icon: <SpyIcon className="w-6 h-6 text-gray-400" />, desc: 'Phá án Black Stories' },
    { id: 'werewolf_moderator', label: 'Quản Trò Ma Sói', icon: <WolfIcon className="w-6 h-6 text-slate-600" />, desc: 'Điều phối game nhóm' },
    { id: 'tarot', label: 'Bói Tarot AI', icon: <TarotIcon className="w-6 h-6 text-purple-500" />, desc: 'Giải mã tương lai' },
    { id: 'dating_sim', label: 'Giả Lập Tán Tỉnh', icon: <BrokenHeartIcon className="w-6 h-6 text-rose-500" />, desc: 'Luyện trình cưa cẩm' },
    { id: 'breathing', label: 'Góc Thở & Thiền', icon: <WindIcon className="w-6 h-6 text-cyan-500" />, desc: 'Giảm stress 4-7-8' },
    { id: 'food_randomizer', label: 'Hôm Nay Ăn Gì?', icon: <BurgerIcon className="w-6 h-6 text-amber-500" />, desc: 'Chọn món ngẫu nhiên' },
    { id: 'roast', label: 'Chế độ Mỏ Hỗn', icon: <FireIcon className="w-6 h-6 text-red-500" />, desc: 'AI xéo xắt & hài hước' },
    { id: 'style_transfer', label: 'Đa Vũ Trụ Ngôn Ngữ', icon: <ScrollIcon className="w-6 h-6 text-emerald-600" />, desc: 'Viết lại văn phong' },
    { id: 'rpg', label: 'Game Nhập Vai', icon: <GamepadIcon className="w-6 h-6 text-green-500" />, desc: 'Phiêu lưu cốt truyện' },
    { id: 'rapper', label: 'Rapper AI', icon: <MicStageIcon className="w-6 h-6 text-yellow-600" />, desc: 'Sáng tác Rap/Diss' },
    { id: 'akinator', label: 'Thần đèn Akinator', icon: <GenieIcon className="w-6 h-6 text-yellow-500" />, desc: 'Đoán nhân vật' },
    { id: 'emoji_quiz', label: 'Đuổi Hình Bắt Chữ', icon: <EmojiPuzzleIcon className="w-6 h-6 text-teal-500" />, desc: 'Đoán câu qua Emoji' },
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
