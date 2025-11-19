import React from 'react';
import { AngryBotIcon } from './Icons';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-3 justify-start animate-slide-in-up py-2">
      <AngryBotIcon className="w-8 h-8 flex-shrink-0 text-amber-400 animate-pulse" />
      <div className="flex items-center gap-3 bg-model-bubble-bg text-model-bubble-text px-4 py-3 rounded-2xl shadow-sm">
        <div className="flex space-x-1">
            <span className="w-2 h-2 bg-current rounded-full animate-dynamic-dot [animation-delay:-0.4s]"></span>
            <span className="w-2 h-2 bg-current rounded-full animate-dynamic-dot [animation-delay:-0.2s]"></span>
            <span className="w-2 h-2 bg-current rounded-full animate-dynamic-dot"></span>
        </div>
        <span className="text-sm font-medium opacity-80">KL AI đang suy nghĩ...</span>
      </div>
    </div>
  );
};

export default TypingIndicator;