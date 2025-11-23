
import React, { useEffect, useState } from 'react';
import { TrophyIcon, XIcon } from './Icons';
import { api } from '../utils/api';

interface LeaderboardModalProps {
  onClose: () => void;
  currentUsername: string;
}

interface RankUser {
    username: string;
    avatar: string;
    xp: number;
    level: number;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, currentUsername }) => {
  const [leaders, setLeaders] = useState<RankUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      const fetchLeaderboard = async () => {
          try {
              const data = await api.getLeaderboard();
              setLeaders(data);
          } catch (error) {
              console.error("Failed to load leaderboard", error);
          } finally {
              setIsLoading(false);
          }
      };
      fetchLeaderboard();
  }, []);

  const getMedalColor = (index: number) => {
      switch(index) {
          case 0: return 'bg-yellow-400 text-yellow-900 border-yellow-300'; // Gold
          case 1: return 'bg-gray-300 text-gray-800 border-gray-200'; // Silver
          case 2: return 'bg-amber-600 text-amber-100 border-amber-500'; // Bronze
          default: return 'bg-card hover:bg-card-hover border-border text-text-secondary';
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in-up">
        <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-5 border-b border-border bg-gradient-to-r from-brand/10 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-full text-yellow-500">
                        <TrophyIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">Bảng Xếp Hạng</h2>
                        <p className="text-xs text-text-secondary">Top học viên xuất sắc nhất</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                    <XIcon className="w-5 h-5 text-text-secondary" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-border">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-text-secondary">Đang tải dữ liệu...</p>
                    </div>
                ) : leaders.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <p className="text-text-secondary italic mb-2">Chưa có dữ liệu xếp hạng.</p>
                        <p className="text-xs text-text-secondary/60">Nếu bạn là Admin, hãy chắc chắn đã chạy mã SQL cập nhật Database.</p>
                    </div>
                ) : (
                    leaders.map((user, index) => (
                        <div 
                            key={index} 
                            className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${getMedalColor(index)} ${user.username === currentUsername ? 'ring-2 ring-brand ring-offset-2 ring-offset-card' : ''}`}
                        >
                            <div className="w-8 flex justify-center font-bold text-lg">
                                {index + 1}
                            </div>
                            
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border border-white/30 shadow-sm flex-shrink-0">
                                {user.avatar.startsWith('data:') ? (
                                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xl">{user.avatar}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm truncate">{user.username} {user.username === currentUsername && '(Bạn)'}</h3>
                                <div className="flex items-center gap-2 text-xs opacity-80">
                                    <span className="font-medium">Level {user.level}</span>
                                    <span>•</span>
                                    <span>{user.xp} XP</span>
                                </div>
                            </div>

                            {index < 3 && (
                                <div className="text-2xl">
                                    {index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-border bg-sidebar/30 text-center">
                <p className="text-xs text-text-secondary">Học tập chăm chỉ để thăng hạng!</p>
            </div>
        </div>
    </div>
  );
};

export default LeaderboardModal;
