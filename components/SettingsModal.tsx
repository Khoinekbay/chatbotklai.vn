import React, { useState, useRef } from 'react';
import { type User } from '../types';
import { XIcon, SunIcon, MoonIcon, SettingsIcon, UserIcon, KeyIcon } from './Icons';

interface SettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: Partial<User>) => Promise<boolean>;
}

type Tab = 'general' | 'personalization' | 'account';

const AVATARS = ['😊', '🧑‍💻', '🚀', '🤖', '💡', '🎓', '🌟', '🧠'];
const FONTS = [
    { name: 'Mặc định', value: "'Inter', sans-serif" },
    { name: 'Cổ điển', value: "'Lora', serif" },
    { name: 'Lập trình', value: "'Roboto Mono', monospace" },
];
const ROLES: { name: string; value: Required<User>['aiRole'] }[] = [
    { name: '🤖 Trợ lý', value: 'assistant' },
    { name: '👩‍🏫 Giáo viên', value: 'teacher' },
    { name: '🧑‍🎓 Bạn học', value: 'classmate' },
];
const TONES: { name: string; value: Required<User>['aiTone'] }[] = [
    { name: 'Cân bằng', value: 'balanced' },
    { name: 'Vui vẻ', value: 'humorous' },
    { name: 'Học thuật', value: 'academic' },
    { name: 'Ngắn gọn', value: 'concise' },
];

const DEFAULT_FONT = "'Inter', sans-serif";
const DEFAULT_ROLE = 'assistant';
const DEFAULT_TONE = 'balanced';

const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = (updates: Partial<User>) => {
    onUpdateUser(updates);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            handleUpdate({ backgroundUrl: dataUrl });
        };
        reader.readAsDataURL(file);
    }
    if (e.target) {
        e.target.value = '';
    }
  };

  const handleRemoveBackground = () => {
    handleUpdate({ backgroundUrl: '' });
  };
  
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ các trường.'); return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp.'); return;
    }

    setIsPasswordLoading(true);
    try {
        // In a real app, this would be a backend call
        await new Promise(res => setTimeout(res, 500));
        // MOCK: Check if current password is "wrong_password" to simulate error
        if (currentPassword === 'wrong_password') {
            throw new Error('Mật khẩu hiện tại không đúng.');
        }

        // MOCK: On success, update the user object (in a real app, backend handles this)
        // onUpdateUser({ password: newPassword }); // This is conceptual, don't send new password to onUpdateUser

        setSuccessMessage('Đổi mật khẩu thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsPasswordLoading(false);
    }
  };

  const TabButton: React.FC<{ tabId: Tab; label: string; icon: React.ReactNode }> = ({ tabId, label, icon }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg text-left transition-colors ${
            activeTab === tabId ? 'bg-card-hover text-text-primary' : 'text-text-secondary hover:bg-card-hover hover:text-text-primary'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
  );

  const SettingItem: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="py-5 border-b border-border last:border-b-0">
        <h4 className="text-md font-semibold text-text-primary">{title}</h4>
        {description && <p className="text-sm text-text-secondary mt-1 mb-3">{description}</p>}
        <div className="mt-3">{children}</div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="divide-y divide-border">
            <SettingItem title="Chế độ màu" description="Tùy chỉnh giao diện sáng hoặc tối cho ứng dụng.">
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleUpdate({ theme: 'light' })} className={`px-4 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${ (user.theme || 'light') === 'light' ? 'bg-brand text-white font-semibold' : 'bg-input-bg hover:bg-border' }`}>
                       <SunIcon className="w-4 h-4" /> Sáng
                    </button>
                     <button onClick={() => handleUpdate({ theme: 'dark' })} className={`px-4 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${ (user.theme || 'light') === 'dark' ? 'bg-brand text-white font-semibold' : 'bg-input-bg hover:bg-border' }`}>
                       <MoonIcon className="w-4 h-4" /> Tối
                    </button>
                </div>
            </SettingItem>
            <SettingItem title="Ảnh nền cuộc trò chuyện" description="Cá nhân hóa giao diện chat bằng ảnh nền của riêng bạn.">
                <div className="flex items-center gap-2">
                    <label htmlFor="bg-upload" className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-input-bg hover:bg-border transition-colors font-medium"> Tải ảnh lên </label>
                    <input id="bg-upload" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    {user.backgroundUrl && (
                        <button onClick={handleRemoveBackground} className="px-4 py-2 text-sm rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"> Xóa ảnh </button>
                    )}
                </div>
                {user.backgroundUrl && (
                    <div className="mt-4"><div className="w-full h-24 rounded-lg bg-cover bg-center border border-border" style={{backgroundImage: `url(${user.backgroundUrl})`}}></div></div>
                )}
            </SettingItem>
            <SettingItem title="Font chữ" description="Chọn font chữ hiển thị trong toàn bộ ứng dụng.">
                <div className="flex items-center gap-2 flex-wrap">
                    {FONTS.map(font => (
                        <button key={font.name} onClick={() => handleUpdate({ fontPreference: font.value })} className={`px-4 py-2 text-sm rounded-lg transition-colors duration-200 ${ (user.fontPreference || DEFAULT_FONT) === font.value ? 'bg-brand text-white font-semibold' : 'bg-input-bg hover:bg-border' }`} style={{ fontFamily: font.value }}>
                           {font.name}
                        </button>
                    ))}
                </div>
            </SettingItem>
          </div>
        );
      case 'personalization':
        return (
          <div className="divide-y divide-border">
            <SettingItem title="Avatar" description="Chọn một emoji để làm ảnh đại diện của bạn.">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {AVATARS.map(avatar => (
                      <button key={avatar} onClick={() => handleUpdate({ avatar })} className={`text-3xl rounded-full aspect-square flex items-center justify-center transition-transform duration-150 hover:scale-110 ${user.avatar === avatar ? 'bg-brand-secondary ring-2 ring-brand' : 'bg-input-bg'}`} aria-label={`Chọn avatar ${avatar}`}>
                        {avatar}
                      </button>
                    ))}
                </div>
                {user.avatar && (<button onClick={() => handleUpdate({ avatar: '' })} className="text-sm text-text-secondary hover:text-red-500 underline mt-4"> Xóa avatar </button> )}
            </SettingItem>
            <SettingItem title="Vai trò AI" description="Xác định vai trò của AI để nhận được phản hồi phù hợp nhất.">
                <div className="flex items-center gap-2 flex-wrap">
                    {ROLES.map(p => ( <button key={p.value} onClick={() => handleUpdate({ aiRole: p.value })} className={`px-4 py-2 text-sm rounded-lg transition-colors duration-200 ${ (user.aiRole || DEFAULT_ROLE) === p.value ? 'bg-brand text-white font-semibold' : 'bg-input-bg hover:bg-border' }`}> {p.name} </button> ))}
                </div>
            </SettingItem>
            <SettingItem title="Giọng văn AI" description="Điều chỉnh phong cách ngôn ngữ của AI.">
                <div className="flex items-center gap-2 flex-wrap">
                    {TONES.map(p => ( <button key={p.value} onClick={() => handleUpdate({ aiTone: p.value })} className={`px-4 py-2 text-sm rounded-lg transition-colors duration-200 ${ (user.aiTone || DEFAULT_TONE) === p.value ? 'bg-brand text-white font-semibold' : 'bg-input-bg hover:bg-border' }`} > {p.name} </button> ))}
                </div>
            </SettingItem>
          </div>
        );
      case 'account':
        return (
            <div>
              <SettingItem title="Tên đăng nhập">
                <input type="text" value={user.username} disabled className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-secondary placeholder-text-secondary cursor-not-allowed" />
              </SettingItem>
              <SettingItem title="Đổi mật khẩu">
                {error && <p className="bg-red-500/10 text-red-500 text-sm text-center p-3 rounded-lg mb-4">{error}</p>}
                {successMessage && <p className="bg-green-500/10 text-green-600 text-sm text-center p-3 rounded-lg mb-4">{successMessage}</p>}
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                      <label htmlFor="currentPassword"className="block text-sm font-medium text-text-secondary mb-1"> Mật khẩu hiện tại </label>
                      <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none" placeholder="••••••••" autoComplete="current-password" />
                  </div>
                  <div>
                      <label htmlFor="newPassword"className="block text-sm font-medium text-text-secondary mb-1"> Mật khẩu mới </label>
                      <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none" placeholder="••••••••" autoComplete="new-password" />
                  </div>
                   <div>
                      <label htmlFor="confirmNewPassword"className="block text-sm font-medium text-text-secondary mb-1"> Xác nhận mật khẩu mới </label>
                      <input id="confirmNewPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none" placeholder="••••••••" autoComplete="new-password" />
                  </div>
                  <button type="submit" disabled={isPasswordLoading} className="w-full bg-brand text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card focus:ring-brand transition-opacity duration-200 disabled:opacity-50">
                      {isPasswordLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </form>
              </SettingItem>
            </div>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-slide-in-up"
      style={{ animationDuration: '0.3s' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div 
        className="bg-card rounded-2xl shadow-xl w-full max-w-4xl h-full max-h-[75vh] m-4 text-text-primary border border-border flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="w-64 border-r border-border p-4 flex flex-col">
            <h2 id="settings-title" className="text-xl font-bold px-3 pb-4">Cài đặt</h2>
            <nav className="flex flex-col gap-1">
                <TabButton tabId="general" label="Chung" icon={<SettingsIcon className="w-5 h-5" />} />
                <TabButton tabId="personalization" label="Cá nhân hóa" icon={<UserIcon className="w-5 h-5" />} />
                <TabButton tabId="account" label="Tài khoản" icon={<KeyIcon className="w-5 h-5" />} />
            </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
            <div className="p-8">
              {renderContent()}
            </div>
        </main>

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-card-hover" aria-label="Đóng">
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
