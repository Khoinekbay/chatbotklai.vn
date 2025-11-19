
import React, { useState, useEffect } from 'react';
import { KlAiLogo } from './Icons';
import { type User } from '../types';
import { api } from '../utils/api';

interface AuthProps {
  onAuthSuccess: (user: User, token: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
        // Optional cleanup
    }
  }, []);

  const toggleMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setError(null);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    if (mode === 'register') {
        if (username.length < 3) {
            setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
            return;
        }
        if (password.length < 6) {
             setError('Mật khẩu phải có ít nhất 6 ký tự.');
             return;
        }
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }
    }
    
    setIsLoading(true);

    try {
      if (mode === 'login') {
          const { user, token } = await api.login(username, password);
          onAuthSuccess(user, token);
      } else {
          const { user, token } = await api.register(username, password);
          onAuthSuccess(user, token);
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDemo = async () => {
      setError(null);
      setIsLoading(true);
      try {
          const { user, token } = await api.createDemoUser();
          onAuthSuccess(user, token);
      } catch (err: any) {
          setError('Không thể khởi tạo phiên bản Demo.');
          setIsLoading(false);
      }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text-primary p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/30 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col gap-6">
        {/* Main Auth Card */}
        <div className="bg-card rounded-2xl shadow-2xl p-6 md:p-8 border border-border backdrop-blur-sm">
            <div className="flex justify-center mb-6 md:mb-8">
            <KlAiLogo className="w-32 md:w-40 text-text-primary drop-shadow-lg" />
            </div>
            
            <h2 className="text-2xl font-bold text-center mb-2">
                {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-center text-text-secondary mb-6 text-sm">
            {mode === 'login' ? 'Nhập thông tin để tiếp tục cuộc trò chuyện' : 'Đăng ký để lưu giữ lịch sử chat của bạn'}
            </p>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center p-3 rounded-lg mb-6 animate-pulse">
                    {error}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1.5">
                    Tên đăng nhập
                    </label>
                    <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-input-bg border border-border rounded-xl p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:border-transparent transition-all outline-none"
                    placeholder="Ví dụ: hocsinh123"
                    autoComplete="username"
                    />
                </div>
                <div>
                    <label htmlFor="password"className="block text-sm font-medium text-text-secondary mb-1.5">
                    Mật khẩu
                    </label>
                    <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-input-bg border border-border rounded-xl p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                </div>
                {mode === 'register' && (
                <div className="animate-slide-in-up" style={{ animationDuration: '0.2s' }}>
                    <label htmlFor="confirmPassword"className="block text-sm font-medium text-text-secondary mb-1.5">
                    Xác nhận mật khẩu
                    </label>
                    <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-input-bg border border-border rounded-xl p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    />
                </div>
                )}
                
                {mode === 'register' && (
                    <p className="text-xs text-center text-text-secondary/80 px-4">
                        Bằng việc đăng kí, bạn đồng ý với <a href="#" className="text-brand hover:underline">Điều khoản dịch vụ</a> của chúng tôi.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand/20 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait flex items-center justify-center"
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Đang xử lý...
                        </span>
                    ) : (
                        mode === 'login' ? 'Đăng nhập' : 'Đăng ký'
                    )}
                </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-sm text-text-secondary">
                    {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                    <button 
                        onClick={toggleMode} 
                        className="font-semibold text-brand hover:text-brand/80 ml-1.5 transition-colors focus:outline-none hover:underline"
                        disabled={isLoading}
                    >
                        {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
                    </button>
                </p>
            </div>
        </div>

        {/* Separated Demo Section */}
        <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex items-center w-full max-w-[200px] gap-4">
                 <div className="h-[1px] bg-border flex-1"></div>
                 <span className="text-xs uppercase text-text-secondary font-semibold tracking-wider">Hoặc</span>
                 <div className="h-[1px] bg-border flex-1"></div>
            </div>
            <button 
                onClick={handleDemo}
                disabled={isLoading}
                className="group flex items-center gap-2 px-6 py-2.5 bg-card hover:bg-card-hover border border-border rounded-full text-sm font-medium text-text-primary transition-all duration-200 hover:shadow-md active:scale-95 w-full justify-center sm:w-auto"
            >
                <span>Trải nghiệm thử không cần tài khoản</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-secondary group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
            </button>
        </div>
        
        <div className="mt-4 text-center">
            <p className="text-xs text-text-secondary/50">Designed by Khoi & Ly</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
