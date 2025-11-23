
import React from 'react';
import { type User } from '../types';
import DataChart from './DataChart';
import { FireIcon, TrophyIcon, ChartPieIcon, XIcon } from './Icons';

interface DashboardProps {
  user: User;
  onClose: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onClose }) => {
  const stats = user.stats || {
      totalMessages: 0,
      studyStreak: 0,
      lastStudyDate: '',
      dailyActivity: {},
      modeUsage: {}
  };

  // Prepare Data for Activity Chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
  });

  const activityData = {
      labels: last7Days.map(date => date.slice(5).replace('-', '/')), // MM/DD
      datasets: [{
          label: 'Hoạt động (Tin nhắn)',
          data: last7Days.map(date => stats.dailyActivity[date] || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 4,
      }]
  };

  const activityConfig = {
      type: 'bar',
      data: activityData,
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false },
              title: { display: true, text: 'Hoạt động 7 ngày qua' }
          },
          scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
          }
      }
  };

  // Prepare Data for Skills Radar
  const skillLabels = Object.keys(stats.modeUsage);
  const skillData = Object.values(stats.modeUsage);
  
  const skillsConfig = {
      type: 'radar',
      data: {
          labels: skillLabels.length > 0 ? skillLabels.map(s => s.replace('_', ' ').toUpperCase()) : ['Học tập', 'Giải trí', 'Sáng tạo'],
          datasets: [{
              label: 'Kỹ năng sử dụng',
              data: skillData.length > 0 ? skillData : [0, 0, 0],
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              borderColor: '#a855f7',
              pointBackgroundColor: '#a855f7',
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false }
          },
          scales: {
              r: {
                  angleLines: { color: 'rgba(128, 128, 128, 0.1)' },
                  grid: { color: 'rgba(128, 128, 128, 0.1)' },
                  pointLabels: { font: { size: 10 } }
              }
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-slide-in-up overflow-y-auto">
        <div className="bg-card w-full max-w-4xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/10 to-purple-600/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-card border-2 border-brand shadow-lg flex items-center justify-center text-3xl overflow-hidden">
                        {user.avatar?.startsWith('data:') ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.avatar || '👤'}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary">{user.username}</h2>
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <span className="bg-brand/10 text-brand px-2 py-0.5 rounded text-xs font-bold uppercase">Level {user.level || 1}</span>
                            <span>•</span>
                            <span>{user.xp || 0} XP</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                    <XIcon className="w-6 h-6 text-text-secondary" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-4 rounded-2xl border border-orange-200/20 flex flex-col items-center justify-center gap-2">
                        <FireIcon className="w-8 h-8 text-orange-500" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.studyStreak} Ngày</p>
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Chuỗi học tập</p>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-4 rounded-2xl border border-blue-200/20 flex flex-col items-center justify-center gap-2">
                        <ChartPieIcon className="w-8 h-8 text-blue-500" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalMessages}</p>
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Tổng tin nhắn</p>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 p-4 rounded-2xl border border-yellow-200/20 flex flex-col items-center justify-center gap-2">
                        <TrophyIcon className="w-8 h-8 text-yellow-500" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{Math.floor((user.xp || 0) / 1000)}k</p>
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Điểm thành tựu</p>
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
                        <DataChart config={activityConfig} />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex items-center justify-center">
                        {skillLabels.length > 0 ? (
                            <DataChart config={skillsConfig} />
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-text-secondary opacity-50">
                                <ChartPieIcon className="w-12 h-12 mb-2" />
                                <p>Chưa có dữ liệu kỹ năng</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Dashboard;
