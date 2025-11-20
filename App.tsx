
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type User } from './types';
import Auth from './components/Auth';
import { api } from './utils/api';
import { BroadcastIcon } from './components/Icons';

// Lazy load the main chat interface.
const ChatInterface = React.lazy(() => import('./components/ChatInterface'));
const LiveAudioTest = React.lazy(() => import('./components/LiveAudioTest'));

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [showLiveTest, setShowLiveTest] = useState(false);

  // Draggable Button State
  const [buttonPos, setButtonPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
  const isDraggingRef = useRef(false);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartTimeRef = useRef(0);

  useEffect(() => {
    // Ensure initial position is within bounds on resize
    const handleResize = () => {
        setButtonPos(prev => ({
            x: Math.min(prev.x, window.innerWidth - 80),
            y: Math.min(prev.y, window.innerHeight - 100)
        }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
        try {
            // Attempt to restore session from Cloud or LocalStorage
            const user = await api.restoreSession();
            if (user) {
                setCurrentUser(user);
                // Update local cache for faster subsequent loads
                localStorage.setItem('kl-ai-user-data', JSON.stringify(user));
            } else {
                // No valid session found
                localStorage.removeItem('kl-ai-token');
                localStorage.removeItem('kl-ai-user-data');
            }
        } catch (error) {
            console.error("Xác thực phiên thất bại", error);
            setCurrentUser(null);
        } finally {
            setIsAuthenticating(false);
        }
    };
    verifySession();
  }, []);

  const handleLogout = useCallback(() => {
      localStorage.removeItem('kl-ai-token');
      localStorage.removeItem('kl-ai-user-data');
      setCurrentUser(null);
      // Sign out from Supabase if applicable
      import('./utils/supabaseClient').then(({ supabase }) => {
          supabase?.auth.signOut();
      });
  }, []);

  const handleUpdateUser = useCallback(async (updates: Partial<User>) => {
      if (!currentUser) return;
      
      // Optimistic update
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      localStorage.setItem('kl-ai-user-data', JSON.stringify(updated));

      // Persist to API
      if (!currentUser.isDemo) {
          try {
              await api.updateUser(currentUser.username, updates);
          } catch (error) {
              console.error("Lỗi đồng bộ dữ liệu người dùng:", error);
          }
      }
  }, [currentUser]);

  // Draggable Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = false;
      dragStartTimeRef.current = Date.now();
      dragStartOffsetRef.current = {
          x: e.clientX - buttonPos.x,
          y: e.clientY - buttonPos.y
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
          // Threshold to detect drag vs click
          isDraggingRef.current = true;
          const newX = moveEvent.clientX - dragStartOffsetRef.current.x;
          const newY = moveEvent.clientY - dragStartOffsetRef.current.y;
          
          // Keep within bounds
          const boundedX = Math.max(0, Math.min(window.innerWidth - 60, newX));
          const boundedY = Math.max(0, Math.min(window.innerHeight - 60, newY));

          setButtonPos({ x: boundedX, y: boundedY });
      };

      const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      isDraggingRef.current = false;
      dragStartTimeRef.current = Date.now();
      dragStartOffsetRef.current = {
          x: touch.clientX - buttonPos.x,
          y: touch.clientY - buttonPos.y
      };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      isDraggingRef.current = true;
      const touch = e.touches[0];
      const newX = touch.clientX - dragStartOffsetRef.current.x;
      const newY = touch.clientY - dragStartOffsetRef.current.y;
       
      // Keep within bounds
      const boundedX = Math.max(0, Math.min(window.innerWidth - 60, newX));
      const boundedY = Math.max(0, Math.min(window.innerHeight - 60, newY));

      setButtonPos({ x: boundedX, y: boundedY });
  };

  const handleButtonClick = () => {
      // If dragged for a very short time or distance, treat as click
      const dragDuration = Date.now() - dragStartTimeRef.current;
      if (!isDraggingRef.current || dragDuration < 150) {
          setShowLiveTest(true);
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
          localStorage.setItem('kl-ai-user-data', JSON.stringify(user));
      }} />;
  }

  return (
      <>
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
            
            {/* Draggable Live Button */}
            <div 
                className="fixed z-50"
                style={{ 
                    left: buttonPos.x, 
                    top: buttonPos.y,
                    touchAction: 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                <button 
                    onClick={handleButtonClick}
                    className="relative group flex items-center justify-center w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-700 active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
                    title="KL AI Live"
                >
                    {/* Ripple Effect */}
                    <span className="absolute inset-0 rounded-full animate-ripple bg-red-500 opacity-30"></span>
                    
                    <div className="relative z-10 flex flex-col items-center">
                         <BroadcastIcon className="w-6 h-6" />
                         <span className="text-[10px] font-bold mt-[-2px]">LIVE</span>
                    </div>
                </button>
            </div>

            {/* Wrapped in local Suspense to prevent full-app unmount */}
            {showLiveTest && (
                <React.Suspense fallback={
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm text-white">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                    </div>
                }>
                    <LiveAudioTest onClose={() => setShowLiveTest(false)} />
                </React.Suspense>
            )}

        </React.Suspense>
      </>
  );
};

export default App;
