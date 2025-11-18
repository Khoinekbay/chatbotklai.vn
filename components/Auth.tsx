import React, { useState, useEffect } from 'react';
import { KlAiLogo } from './Icons';
import { type User } from '../types';

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
    // Luôn sử dụng giao diện tối cho trang đăng nhập/đăng ký
    document.documentElement.classList.add('dark');
    return () => {
        // Tùy chọn: Xóa giao diện tối khi component unmount nếu ứng dụng chính có thể là giao diện sáng
        // document.documentElement.classList.remove('dark');
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
    
    if (!username || !password) {
      setError('Tên đăng nhập và mật khẩu không được để trống.');
      return;
    }
    if (mode === 'register' && username.length > 20) {
      setError('Tên đăng nhập không được vượt quá 20 ký tự.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    
    setIsLoading(true);

    try {
      // Trong ứng dụng thật, đây sẽ là các endpoint API backend của bạn
      // const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      
      // const response = await fetch(endpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username, password }),
      // });
      // const data = await response.json();
      // if (!response.ok) {
      //   throw new Error(data.message || 'Đã có lỗi xảy ra.');
      // }
      
      // ===================================================================
      // MOCK API CALL - Thay thế bằng API call thật đến backend của bạn
      // ===================================================================
      await new Promise(res => setTimeout(res, 1000)); // Giả lập độ trễ mạng

      // Logic giả lập:
      if (mode === 'register' && username === 'existing_user') {
          throw new Error('Tên đăng nhập đã tồn tại.');
      }
      // Trong ứng dụng thật, backend sẽ xác thực thông tin này.
      // Ví dụ: if (mode === 'login' && username !== 'demo_user' || password !== 'password123')
      if (mode === 'login' && (username !== 'demo_user' || password !== 'password')) {
        // throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
      }

      // Dữ liệu trả về giả lập từ backend
      const responseData = {
        // QUAN TRỌNG: Phía client không bao giờ được lưu trữ mật khẩu.
        // Thuộc tính 'password' được thêm vào dưới dạng chuỗi rỗng để phù hợp với kiểu dữ liệu 'User'.
        user: { username, password: '', aiRole: 'assistant', aiTone: 'balanced', theme: 'dark' } as User,
        token: 'mock-jwt-token-for-' + username,
      };
      // ===================================================================
      // KẾT THÚC MOCK API CALL
      // ===================================================================
      
      onAuthSuccess(responseData.user, responseData.token);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-text-primary p-4">
      <div className="w-full max-w-sm mx-auto bg-card rounded-2xl shadow-xl p-8 border border-border">
        <div className="flex justify-center mb-6">
          <KlAiLogo className="w-32 text-text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-1">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
        <p className="text-center text-text-secondary mb-6">
          {mode === 'login' ? 'Chào mừng trở lại!' : 'Bắt đầu cuộc trò chuyện với KL AI.'}
        </p>

        {error && <p className="bg-red-500/20 text-red-300 text-sm text-center p-3 rounded-lg mb-4">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">
                Tên đăng nhập
                </label>
                <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none"
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                required
                />
            </div>
            <div>
                <label htmlFor="password"className="block text-sm font-medium text-text-secondary mb-1">
                Mật khẩu
                </label>
                <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                />
            </div>
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword"className="block text-sm font-medium text-text-secondary mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
            {mode === 'register' && (
              <p className="text-xs text-center text-text-secondary/90 !mt-3">
                Bằng việc đăng kí tài khoản, bạn đã chấp nhận mọi{' '}
                <a 
                  href="https://klai.framer.ai/terms-and-conditions" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-medium text-brand hover:underline"
                >
                  ĐIỀU KHOẢN &amp; ĐIỀU KIỆN
                </a>.
              </p>
            )}
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card focus:ring-brand transition-opacity duration-200 disabled:opacity-50"
            >
                {isLoading ? 'Đang xử lý...' : (mode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
            </button>
        </form>
        <p className="text-center text-sm text-text-secondary mt-6">
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button onClick={toggleMode} className="font-medium text-brand hover:underline ml-1 disabled:opacity-50" disabled={isLoading}>
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>

        <p className="text-center text-xs text-text-secondary/70 mt-8">
          Được tạo bởi hai đồng tác giả là Khởi và Lý
        </p>
      </div>
    </div>
  );
};

export default Auth;