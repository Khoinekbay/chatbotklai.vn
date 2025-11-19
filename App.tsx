import React, { useState, useEffect } from 'react';
import { type User } from './types';
import Auth from './components/Auth';
import { api } from './utils/api';

// Lazy load the main chat interface.
// This ensures that heavy libraries like @google/genai, HighLight.js, D3, etc.
// are not downloaded until the user is authenticated.
const ChatInterface = React.lazy(() => import('./components/ChatInterface'));

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
        const token = localStorage.getItem('kl-ai-token');
        if (token) {
            try {
                // Mock validation
                await new Promise(res => setTimeout(res, 500)); 
                const storedUserStr = localStorage.getItem('kl-ai-user-data');
                let userData: User;
                if (storedUserStr) {
                    userData = JSON.parse(storedUserStr);
                } else {
                    // Fallback if no stored user data
                    userData = { 
                        username: 'Người dùng', 
                        password: '', 
                        aiRole: 'assistant', 
                        aiTone: 'balanced',
                        theme: 'dark',
                        isDemo: false 
                    };
                }
                setCurrentUser(userData);

            } catch (error) {
                console.error("Xác thực token thất bại", error);
                handleLogout(); 
            }
        }
        setIsAuthenticating(false);
    };
    verifyToken();
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('kl-ai-token');
      localStorage.removeItem('kl-ai-user-data');
      setCurrentUser(null);
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
      if (!currentUser) return;
      
      // Optimistic update for UI responsiveness
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      
      // Update session storage
      try {
          localStorage.setItem('kl-ai-user-data', JSON.stringify(updated));
      } catch (error) {
          console.error("Lỗi lưu dữ liệu phiên:", error);
      }

      // Persist to "Database" if not a demo user
      if (!currentUser.isDemo) {
          try {
              await api.updateUser(currentUser.username, updates);
          } catch (error) {
              console.error("Lỗi đồng bộ dữ liệu người dùng:", error);
              // In a real app, show a toast notification here
          }
      }
  };

  if (isAuthenticating) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
  }

  if (!currentUser) {
      return <Auth onAuthSuccess={(user, token) => { 
          setCurrentUser(user); 
          localStorage.setItem('kl-ai-token', token); 
          try {
            localStorage.setItem('kl-ai-user-data', JSON.stringify(user));
          } catch (e) {
            console.error("Lỗi khởi tạo dữ liệu người dùng:", e);
          }
      }} />;
  }

  return (
      <React.Suspense fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                <p className="text-sm font-medium text-slate-400 animate-pulse">Đang tải dữ liệu...</p>
            </div>
        </div>
      }>
          <ChatInterface 
            currentUser={currentUser} 
            onLogout={handleLogout}
            onUpdateUser={handleUpdateUser}
          />
      </React.Suspense>
  );
};

export default App;