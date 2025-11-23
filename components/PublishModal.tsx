
import React, { useState } from 'react';
import { GlobeIcon, XIcon } from './Icons';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (title: string, description: string) => void;
  isPublishing: boolean;
  resourceType: string;
}

const PublishModal: React.FC<PublishModalProps> = ({ isOpen, onClose, onPublish, isPublishing, resourceType }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handlePublish = () => {
      if (title.trim()) {
          onPublish(title, description);
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-in-up">
        <div className="bg-card w-full max-w-md rounded-2xl p-6 border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                    <GlobeIcon className="w-5 h-5 text-brand" />
                    Chia sẻ {resourceType}
                </h3>
                <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><XIcon className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Tiêu đề</label>
                    <input 
                        autoFocus 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        className="w-full p-3 bg-input-bg border border-border rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand" 
                        placeholder={`VD: ${resourceType === 'exercise' ? 'Bài tập Toán chương 1' : 'Tài liệu ôn thi'}`} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Mô tả (Tùy chọn)</label>
                    <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        className="w-full p-3 bg-input-bg border border-border rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand h-24 resize-none" 
                        placeholder="Thêm thông tin chi tiết..." 
                    />
                </div>
                
                <div className="flex gap-3 mt-2">
                    <button onClick={onClose} className="flex-1 py-3 bg-sidebar hover:bg-card-hover text-text-primary font-bold rounded-xl transition-colors">Hủy</button>
                    <button 
                        onClick={handlePublish} 
                        disabled={!title.trim() || isPublishing} 
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isPublishing ? 'Đang đăng...' : 'Đăng lên Hub'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default PublishModal;