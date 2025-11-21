

import React, { useState, useRef, useEffect } from 'react';
import { MusicIcon, XIcon, MinimizeIcon, MaximizeIcon, LinkIcon } from './Icons';

const CHANNELS = [
    { id: 'jfKfPfyJRdk', name: 'Lofi Girl - Study' },
    { id: '4xDzrJKXOOY', name: 'Synthwave - Chill' },
    { id: 'eX3C6vQ3m3k', name: 'Coffee Shop Jazz' },
    { id: 'DWcJFNfaw9c', name: 'Ambient Rain' }
];

const LofiPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(CHANNELS[0]);
  const [customLink, setCustomLink] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Position state for dragging
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize position on mount safely
  useEffect(() => {
      if (typeof window !== 'undefined') {
          // Initial position bottom left, safe from edge
          setPosition({ x: 20, y: window.innerHeight - 320 });
      }
  }, []);

  // Function to extract YouTube ID from URL
  const getYoutubeId = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadCustomLink = () => {
      const id = getYoutubeId(customLink);
      if (id) {
          setCurrentChannel({ id: id, name: 'Custom Link' });
      } else {
          alert("Link Youtube không hợp lệ!");
      }
  };

  // Ensure widget stays within bounds on resize
  useEffect(() => {
      const handleResize = () => {
          const width = isMinimized ? 260 : 330;
          const maxX = window.innerWidth - width;
          const maxY = window.innerHeight - 50;

          setPosition(prev => ({
              x: Math.max(0, Math.min(prev.x, maxX)),
              y: Math.max(0, Math.min(prev.y, maxY))
          }));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [isMinimized]);

  // --- Dragging Handlers (Mouse & Touch) ---

  const startDrag = (clientX: number, clientY: number, target: HTMLElement) => {
      // Prevent dragging if clicking inputs/buttons
      if (target.closest('button') || target.closest('input') || target.closest('select')) return;

      setIsDragging(true);
      dragStartRef.current = {
          x: clientX - position.x,
          y: clientY - position.y
      };
  };

  const onDrag = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const newX = clientX - dragStartRef.current.x;
      const newY = clientY - dragStartRef.current.y;
      
      // Bounds checking
      const width = isMinimized ? 256 : 320;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - 50; // Bottom padding
      
      setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
      });
  };

  const stopDrag = () => {
      setIsDragging(false);
  };

  // Mouse Events
  const handleMouseDown = (e: React.MouseEvent) => {
      startDrag(e.clientX, e.clientY, e.target as HTMLElement);
  };

  // Touch Events
  const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY, e.target as HTMLElement);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (isDragging) {
          e.preventDefault(); // Prevent scrolling page while dragging
          const touch = e.touches[0];
          onDrag(touch.clientX, touch.clientY);
      }
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => onDrag(e.clientX, e.clientY);
      const handleMouseUp = () => stopDrag();

      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging]);

  
  if (!isOpen) {
      return (
          <button 
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 left-4 z-30 p-3 bg-card border border-border rounded-full shadow-lg hover:bg-card-hover transition-all active:scale-95 group"
            title="Bật nhạc Lofi"
          >
              <MusicIcon className="w-6 h-6 text-brand group-hover:animate-spin" />
          </button>
      );
  }

  return (
    <div 
        className={`fixed z-40 bg-black rounded-xl shadow-2xl overflow-hidden border border-gray-700 transition-all duration-200 ${isMinimized ? 'w-64 h-auto' : 'w-80 h-auto'}`}
        style={{ 
            left: position.x, 
            top: position.y,
            transition: isDragging ? 'none' : 'width 0.3s, height 0.3s',
            touchAction: 'none' // Important for touch dragging
        }}
    >
        {/* Header (Draggable) */}
        <div 
            className="bg-gray-900 p-2 flex items-center justify-between border-b border-gray-800 cursor-move select-none"
            style={{ touchAction: 'none' }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={stopDrag}
        >
            <div className="flex items-center gap-2 text-white pointer-events-none">
                <MusicIcon className="w-4 h-4 text-brand" />
                <span className="text-xs font-bold">Lofi Player</span>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-gray-800 rounded text-gray-400">
                    {isMinimized ? <MaximizeIcon className="w-3 h-3" /> : <MinimizeIcon className="w-3 h-3" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400">
                    <XIcon className="w-3 h-3" />
                </button>
            </div>
        </div>

        {/* Video Area */}
        {!isMinimized && (
            // Add pointer-events-none when dragging to prevent iframe from capturing mouse events causing lag
            <div className={`relative w-full aspect-video bg-black ${isDragging ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                 <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${currentChannel.id}?autoplay=1&controls=0&showinfo=0&modestbranding=1`} 
                    title="Lofi Music" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    className="opacity-80 hover:opacity-100 transition-opacity"
                 ></iframe>
            </div>
        )}

        {/* Controls */}
        {!isMinimized && (
            <div className="p-2 bg-gray-900 space-y-2">
                <select 
                    value={currentChannel.name === 'Custom Link' ? 'custom' : currentChannel.id}
                    onChange={(e) => {
                        if (e.target.value === 'custom') {
                             setCurrentChannel({ id: '', name: 'Custom Link' });
                        } else {
                            setCurrentChannel(CHANNELS.find(c => c.id === e.target.value) || CHANNELS[0]);
                            setCustomLink('');
                        }
                    }}
                    className="w-full bg-gray-800 text-white text-xs rounded p-1.5 outline-none border border-gray-700 focus:border-brand"
                >
                    {CHANNELS.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="custom">Link Youtube khác...</option>
                </select>

                {currentChannel.name === 'Custom Link' && (
                    <div className="flex gap-1">
                        <input 
                            type="text" 
                            value={customLink}
                            onChange={(e) => setCustomLink(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadCustomLink()}
                            placeholder="Dán link Youtube..."
                            className="flex-1 bg-gray-800 text-white text-xs rounded p-1.5 outline-none border border-gray-700 focus:border-brand"
                        />
                        <button 
                            onClick={loadCustomLink}
                            className="bg-brand hover:bg-brand/90 text-white p-1.5 rounded text-xs font-bold flex items-center justify-center"
                            title="Phát"
                        >
                            <LinkIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default LofiPlayer;