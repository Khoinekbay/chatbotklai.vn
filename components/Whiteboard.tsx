
import React, { useRef, useState, useEffect } from 'react';
import { PenIcon, EraserIcon, TrashIcon, UndoIcon, CheckIcon, HelpCircleIcon } from './Icons';

// Icon Save (download) for Whiteboard
const SaveIconAlt: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
);

interface WhiteboardProps {
  onCapture: (imageData: string) => void;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ onCapture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [history, setHistory] = useState<string[]>([]);
  
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Handle High DPI displays
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Set white background initially
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        setContext(ctx);
        
        // Save initial blank state
        setHistory([canvas.toDataURL()]);
      }
    }
    
    const handleResize = () => {
         // Simple resize handler - clears canvas unfortunately, 
         // in a real app we'd redraw the history
         if (canvas && canvas.parentElement) {
             const dpr = window.devicePixelRatio || 1;
             const rect = canvas.parentElement.getBoundingClientRect();
             canvas.width = rect.width * dpr;
             canvas.height = rect.height * dpr;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.scale(dpr, dpr);
                 ctx.lineCap = 'round';
                 ctx.lineJoin = 'round';
                 ctx.fillStyle = '#ffffff';
                 ctx.fillRect(0, 0, rect.width, rect.height);
                 setContext(ctx);
             }
         }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      if (context) {
          context.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
          context.lineWidth = tool === 'eraser' ? 20 : brushSize;
      }
  }, [color, brushSize, tool, context]);

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = (event as React.MouseEvent).clientX;
        clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!context) return;
    
    // Prevent scrolling on touch devices
    if ('touches' in event) {
        // event.preventDefault(); // Can block other interactions if not careful
    }

    const { x, y } = getCoordinates(event);
    lastPos.current = { x, y };
    setIsDrawing(true);
    
    // Draw a dot
    context.beginPath();
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fillStyle = context.strokeStyle;
    context.fill();
    context.beginPath(); // Start path for next move
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context || !lastPos.current) return;
    if ('touches' in event) event.preventDefault(); // Crucial for smooth drawing on mobile

    const { x, y } = getCoordinates(event);

    context.beginPath();
    context.moveTo(lastPos.current.x, lastPos.current.y);
    context.lineTo(x, y);
    context.stroke();

    lastPos.current = { x, y };
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
        setIsDrawing(false);
        lastPos.current = null;
        // Save state for undo
        const newState = canvasRef.current.toDataURL();
        setHistory(prev => [...prev, newState].slice(-10)); // Keep last 10 states
    }
  };
  
  const handleUndo = () => {
      if (history.length <= 1 || !context || !canvasRef.current) return;
      
      const newHistory = [...history];
      newHistory.pop(); // Remove current state
      const previousState = newHistory[newHistory.length - 1];
      
      const img = new Image();
      img.src = previousState;
      img.onload = () => {
          if (context && canvasRef.current) {
            // We need to reset transform to draw image covering whole canvas
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            const dpr = window.devicePixelRatio || 1;
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            context.drawImage(img, 0, 0);
            context.restore();
          }
      };
      
      setHistory(newHistory);
  };

  const handleClear = () => {
      if (!context || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, rect.width, rect.height);
      const newState = canvasRef.current.toDataURL();
      setHistory(prev => [...prev, newState]);
  };
  
  const handleCapture = () => {
      if (canvasRef.current) {
          onCapture(canvasRef.current.toDataURL('image/png'));
      }
  };

  const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

  return (
    <div className="flex flex-col h-full w-full bg-gray-100 rounded-lg overflow-hidden border border-border">
      {/* Canvas Area */}
      <div className="flex-1 relative cursor-crosshair touch-none">
         <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
         />
      </div>

      {/* Toolbar */}
      <div className="h-16 bg-card border-t border-border flex items-center justify-between px-4 gap-4 overflow-x-auto">
         <div className="flex items-center gap-2">
             {/* Tool Selection */}
             <div className="flex bg-input-bg p-1 rounded-lg">
                 <button 
                    onClick={() => setTool('pen')}
                    className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-white shadow text-brand' : 'text-text-secondary'}`}
                    title="Bút vẽ"
                 >
                     <PenIcon className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={() => setTool('eraser')}
                    className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white shadow text-brand' : 'text-text-secondary'}`}
                    title="Tẩy"
                 >
                     <EraserIcon className="w-5 h-5" />
                 </button>
             </div>
             
             <div className="w-[1px] h-6 bg-border mx-1"></div>

             {/* Colors */}
             <div className="flex items-center gap-1">
                 {COLORS.map(c => (
                     <button
                        key={c}
                        onClick={() => { setColor(c); setTool('pen'); }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && tool === 'pen' ? 'border-gray-400 scale-110' : 'border-transparent hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                     />
                 ))}
             </div>
         </div>
         
         <div className="flex items-center gap-2">
              <button 
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="p-2 rounded-full hover:bg-input-bg disabled:opacity-30 transition-colors"
                  title="Hoàn tác"
              >
                  <UndoIcon className="w-5 h-5" />
              </button>
              <button 
                  onClick={handleClear}
                  className="p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                  title="Xóa tất cả"
              >
                  <TrashIcon className="w-5 h-5" />
              </button>
              
              <div className="w-[1px] h-6 bg-border mx-1"></div>
              
              <button
                  onClick={handleCapture}
                  className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors shadow-sm font-medium"
              >
                  <HelpCircleIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Hỏi KL AI</span>
                  <span className="sm:hidden">Hỏi</span>
              </button>
         </div>
      </div>
    </div>
  );
};

export default Whiteboard;
