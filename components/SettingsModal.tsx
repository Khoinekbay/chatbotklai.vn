import React, { useState, useRef, useEffect } from 'react';
import { type User } from '../types';
import { XIcon, SunIcon, MoonIcon, SettingsIcon, UserIcon, KeyIcon } from './Icons';
import { api } from '../utils/api';

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
  const [instructionInput, setInstructionInput] = useState(user.customInstruction || '');
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setInstructionInput(user.customInstruction || '');
  }, [user.customInstruction]);

  useEffect(() => {
      if (activeTab === 'account') {
          api.checkConnection().then(isConnected => {
              setCloudStatus(isConnected ? 'connected' : 'error');
          });
      }
  }, [activeTab]);

  const handleUpdate = (updates: Partial<User>) => {
    onUpdateUser(updates);
  };

  const handleInstructionBlur = () => {
      if (instructionInput !== user.customInstruction) {
          handleUpdate({ customInstruction: instructionInput });
      }
  };
  
  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        if (file.size > 2 * 1024 * 1024) {
            alert("Vui lòng chọn ảnh nhỏ hơn 2MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            handleUpdate({ avatar: dataUrl });
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
    
    if (user.password && currentPassword !== user.password) {
        setError('Mật khẩu hiện tại không đúng.');
        return;
    }

    setIsPasswordLoading(true);
    try {
        const success = await onUpdateUser({ password: newPassword });
        if (success) {
            setSuccessMessage('Đổi mật khẩu thành công!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
             setError('Không thể đổi mật khẩu (Lỗi hệ thống).');
        }
    } catch (err: any) {
        setError(err.message || 'Không thể đổi mật khẩu.');
    } finally {
        setIsPasswordLoading(false);
    }
  };

  const TabButton: React.FC<{ tabId: Tab; label: string; icon: React.ReactNode }> = ({ tabId, label, icon }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 px-4 py-3 md:py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap border-b-2 md:border-b-0 md:border-l-2
            ${activeTab === tabId 
                ? 'border-brand text-brand bg-brand/5 md:bg-card-hover md:text-text-primary md:border-brand' 
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-card-hover'
            }
            flex-1 md:flex-none
        `}
    >
        {icon}
        <span>{label}</span>
    </button>
  );

  const SettingItem: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="py-5 border-b border-border last:border-b-0">
        <h4 className="text-base font-semibold text-text-primary">{title}</h4>
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
                <div className="flex items-center gap-3">
                    <button onClick={() => handleUpdate({ theme: 'light' })} className={`flex-1 md:flex-none px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 border border-transparent ${ (user.theme || 'light') === 'light' ? 'bg-brand text-white font-semibold shadow-md' : 'bg-input-bg hover:bg-border border-border' }`}>
                       <SunIcon className="w-4 h-4" /> Sáng
                    </button>
                     <button onClick={() => handleUpdate({ theme: 'dark' })} className={`flex-1 md:flex-none px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 border border-transparent ${ (user.theme || 'light') === 'dark' ? 'bg-brand text-white font-semibold shadow-md' : 'bg-input-bg hover:bg-border border-border' }`}>
                       <MoonIcon className="w-4 h-4" /> Tối
                    </button>
                </div>
            </SettingItem>
            <SettingItem title="Ảnh nền cuộc trò chuyện" description="Cá nhân hóa giao diện chat bằng ảnh nền của riêng bạn.">
                <div className="flex items-center gap-2">
                    <label htmlFor="bg-upload" className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-input-bg hover:bg-border transition-colors font-medium border border-border"> Tải ảnh lên </label>
                    <input id="bg-upload" ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFileChange} />
                    {user.backgroundUrl && (
                        <button onClick={handleRemoveBackground} className="px-4 py-2 text-sm rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"> Xóa ảnh </button>
                    )}
                </div>
                {user.backgroundUrl && (
                    <div className="mt-4"><div className="w-full h-32 rounded-lg bg-cover bg-center border border-border shadow-sm" style={{backgroundImage: `url(${user.backgroundUrl})`}}></div></div>
                )}
            </SettingItem>
            <SettingItem title="Font chữ" description="Chọn font chữ hiển thị trong toàn bộ ứng dụng.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {FONTS.map(font => (
                        <button key={font.name} onClick={() => handleUpdate({ fontPreference: font.value })} className={`px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 border border-transparent ${ (user.fontPreference || DEFAULT_FONT) === font.value ? 'bg-brand text-white font-semibold shadow-md' : 'bg-input-bg hover:bg-border border-border' }`} style={{ fontFamily: font.value }}>
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
            <SettingItem title="Avatar" description="Chọn emoji hoặc tải ảnh của bạn lên.">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {AVATARS.map(avatar => (
                      <button key={avatar} onClick={() => handleUpdate({ avatar })} className={`text-3xl rounded-full aspect-square flex items-center justify-center transition-all duration-200 hover:scale-110 ${user.avatar === avatar ? 'bg-brand-secondary ring-4 ring-brand/30' : 'bg-input-bg hover:bg-border'}`} aria-label={`Chọn avatar ${avatar}`}>
                        {avatar}
                      </button>
                    ))}
                </div>
                
                <div className="mt-4 flex items-center gap-3">
                     <label htmlFor="avatar-upload" className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors font-medium shadow-md">
                         Tải ảnh lên
                     </label>
                     <input id="avatar-upload" ref={avatarFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                     
                     {user.avatar && user.avatar.startsWith('data:') && (
                         <div className="flex items-center gap-2">
                             <span className="text-sm text-text-secondary">Hiện tại:</span>
                             <img src={user.avatar} alt="Custom Avatar" className="w-8 h-8 rounded-full object-cover border border-border" />
                         </div>
                     )}
                     
                     {user.avatar && (<button onClick={() => handleUpdate({ avatar: '' })} className="text-sm text-text-secondary hover:text-red-500 underline ml-auto"> Xóa avatar </button> )}
                </div>
            </SettingItem>
            <SettingItem title="Vai trò AI" description="Xác định vai trò của AI để nhận được phản hồi phù hợp nhất.">
                <div className="flex flex-col sm:flex-row gap-2">
                    {ROLES.map(p => ( <button key={p.value} onClick={() => handleUpdate({ aiRole: p.value })} className={`flex-1 px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 border border-transparent ${ (user.aiRole || DEFAULT_ROLE) === p.value ? 'bg-brand text-white font-semibold shadow-md' : 'bg-input-bg hover:bg-border border-border' }`}> {p.name} </button> ))}
                </div>
            </SettingItem>
            <SettingItem title="Giọng văn AI" description="Điều chỉnh phong cách ngôn ngữ của AI.">
                <div className="grid grid-cols-2 gap-2">
                    {TONES.map(p => ( <button key={p.value} onClick={() => handleUpdate({ aiTone: p.value })} className={`px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 border border-transparent ${ (user.aiTone || DEFAULT_TONE) === p.value ? 'bg-brand text-white font-semibold shadow-md' : 'bg-input-bg hover:bg-border border-border' }`} > {p.name} </button> ))}
                </div>
            </SettingItem>
            <SettingItem title="Hướng dẫn tùy chỉnh" description="Nhập các hướng dẫn cụ thể mà bạn muốn AI tuân thủ tuyệt đối (tối đa 2000 từ). AI sẽ ưu tiên hướng dẫn này cao nhất.">
                <div className="relative">
                    <textarea
                        value={instructionInput}
                        onChange={(e) => {
                            if (e.target.value.length <= 10000) {
                                setInstructionInput(e.target.value);
                            }
                        }}
                        onBlur={handleInstructionBlur}
                        className="w-full h-40 bg-input-bg border border-border rounded-lg p-3 text-sm text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none resize-y"
                        placeholder="Ví dụ: Luôn xưng hô là 'thầy/trò', giải thích chi tiết từng bước, không sử dụng emoji, luôn cung cấp ví dụ thực tế..."
                    />
                    <div className={`absolute bottom-2 right-3 text-xs font-medium bg-card/80 px-2 py-0.5 rounded ${instructionInput.length >= 9900 ? 'text-red-500' : 'text-text-secondary'}`}>
                        {instructionInput.length}/10000 ký tự
                    </div>
                </div>
            </SettingItem>
          </div>
        );
      case 'account':
        return (
            <div>
              <SettingItem title="Trạng thái đám mây">
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${cloudStatus === 'connected' ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : cloudStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-input-bg border-border'}`}>
                    <div className={`relative flex-shrink-0 w-3 h-3 rounded-full ${cloudStatus === 'connected' ? 'bg-green-500' : cloudStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                         {cloudStatus === 'checking' && <div className="absolute inset-0 bg-yellow-500 rounded-full animate-ping opacity-75"></div>}
                    </div>
                    <span className="text-sm font-medium">
                        {cloudStatus === 'connected' ? 'Đã kết nối với Supabase' : cloudStatus === 'error' ? 'Không thể kết nối (Đang chạy chế độ Offline)' : 'Đang kiểm tra kết nối...'}
                    </span>
                </div>
                {cloudStatus === 'error' && (
                     <p className="text-xs text-red-500 mt-2 pl-1 leading-5">
                         <b>Lỗi kết nối! Vui lòng kiểm tra:</b> <br/>
                         1. API Key (phải bắt đầu bằng "eyJ...", không phải "sb_publishable") <br/>
                         2. Đã tắt "Confirm Email" trong Supabase chưa? (Auth &rarr; Providers &rarr; Email)<br/>
                         3. Đã chạy lệnh SQL tạo bảng chưa?
                     </p>
                )}
              </SettingItem>
              <SettingItem title="Tên đăng nhập">
                <input type="text" value={user.username} disabled className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-secondary placeholder-text-secondary cursor-not-allowed" />
              </SettingItem>
              
              {/* Real Email Display */}
              <SettingItem title="Email liên hệ (Thực)">
                 {user.email ? (
                    <div className="space-y-2">
                        <input type="text" value={user.email} disabled className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-secondary placeholder-text-secondary cursor-not-allowed" />
                        <p className="text-xs text-green-600 dark:text-green-400">Email này được lưu trong hệ thống để hỗ trợ khôi phục tài khoản.</p>
                    </div>
                 ) : (
                    <div className="space-y-2">
                        <input type="text" value="Chưa cập nhật" disabled className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-secondary placeholder-text-secondary cursor-not-allowed italic" />
                        <p className="text-xs text-text-secondary">Bạn chưa thêm email. Hãy liên hệ admin nếu cần hỗ trợ tài khoản.</p>
                    </div>
                 )}
              </SettingItem>

              <SettingItem title="Đổi mật khẩu">
                {error && <p className="bg-red-500/10 text-red-500 text-sm text-center p-3 rounded-lg mb-4">{error}</p>}
                {successMessage && <p className="bg-green-500/10 text-green-600 text-sm text-center p-3 rounded-lg mb-4">{successMessage}</p>}
                
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                      <input 
                          type="password" 
                          placeholder="Mật khẩu hiện tại" 
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand outline-none"
                      />
                  </div>
                  <div>
                      <input 
                          type="password" 
                          placeholder="Mật khẩu mới" 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand outline-none"
                      />
                  </div>
                  <div>
                      <input 
                          type="password" 
                          placeholder="Xác nhận mật khẩu mới" 
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand outline-none"
                      />
                  </div>
                  <button 
                      type="submit" 
                      disabled={isPasswordLoading}
                      className="w-full py-3 bg-brand text-white font-bold rounded-lg shadow-md hover:bg-brand/90 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                  >
                      {isPasswordLoading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                  </button>
                </form>
              </SettingItem>
            </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in-up">
      <div className="w-full max-w-4xl h-[85vh] bg-card rounded-2xl shadow-2xl border border-border flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-sidebar flex-shrink-0 flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-border overflow-x-auto md:overflow-visible">
          <div className="p-4 md:p-6 border-b border-border/50 hidden md:block">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-brand" />
              Cài đặt
            </h2>
          </div>
          <div className="flex md:flex-col p-2 md:p-4 gap-1">
            <TabButton tabId="general" label="Chung" icon={<SettingsIcon className="w-5 h-5" />} />
            <TabButton tabId="personalization" label="Cá nhân hóa" icon={<UserIcon className="w-5 h-5" />} />
            <TabButton tabId="account" label="Tài khoản" icon={<KeyIcon className="w-5 h-5" />} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border md:hidden">
             <h2 className="text-lg font-bold">Cài đặt</h2>
             <button onClick={onClose} className="p-2 rounded-full hover:bg-input-bg"><XIcon className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-border">
             {renderContent()}
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-3 bg-card/50 backdrop-blur-sm">
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-text-secondary hover:bg-input-bg font-medium transition-colors">
                  Đóng
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;