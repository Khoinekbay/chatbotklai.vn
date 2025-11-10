import React from 'react';
import { type MindMapNode } from '../types';
import { XIcon } from './Icons';
import MindMapView from './MindMapView';

interface MindMapModalProps {
  data: MindMapNode;
  onClose: () => void;
}

const MindMapModal: React.FC<MindMapModalProps> = ({ data, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-in-up"
      style={{ animationDuration: '0.3s' }}
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Sơ đồ tư duy</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-card-hover" aria-label="Đóng">
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-6 flex items-start justify-center">
            <MindMapView data={data} />
        </div>
      </div>
    </div>
  );
};

export default MindMapModal;
