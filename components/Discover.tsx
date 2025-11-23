
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { SharedResource, User } from '../types';
import { XIcon, SearchIcon, HeartIcon, DownloadIcon, FlashcardIcon, MindMapIcon, ImageIcon, FileIcon, PenIcon, PlusIcon, AttachmentIcon, TrashIcon } from './Icons';

interface DiscoverProps {
  onClose: () => void;
  onOpenResource: (type: SharedResource['type'], data: any) => void;
  currentUser: User;
}

const Discover: React.FC<DiscoverProps> = ({ onClose, onOpenResource, currentUser }) => {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'flashcard' | 'mindmap' | 'exercise' | 'image' | 'document'>('all');
  const [search, setSearch] = useState('');
  
  // Create Post State
  const [isCreating, setIsCreating] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postFiles, setPostFiles] = useState<{ name: string; data: string; mimeType: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const load = async () => {
          setIsLoading(true);
          const data = await api.getSharedResources(filter === 'all' ? undefined : filter as any);
          setResources(data);
          setIsLoading(false);
      };
      load();
  }, [filter, isCreating]); // Reload after creating

  const filteredResources = resources.filter(res => 
      res.title.toLowerCase().includes(search.toLowerCase()) || 
      res.username.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'flashcard': return <FlashcardIcon className="w-12 h-12 text-yellow-600 opacity-80" />;
          case 'mindmap': return <MindMapIcon className="w-12 h-12 text-purple-600 opacity-80" />;
          case 'image': return <ImageIcon className="w-12 h-12 text-blue-500 opacity-80" />;
          case 'document': return <FileIcon className="w-12 h-12 text-red-500 opacity-80" />;
          case 'exercise': return <PenIcon className="w-12 h-12 text-green-600 opacity-80" />;
          default: return null;
      }
  };

  const getBgColor = (type: string) => {
      switch(type) {
          case 'flashcard': return 'bg-yellow-500/10';
          case 'mindmap': return 'bg-purple-500/10';
          case 'image': return 'bg-blue-500/10';
          case 'document': return 'bg-red-500/10';
          case 'exercise': return 'bg-green-500/10';
          default: return 'bg-gray-100 dark:bg-gray-800';
      }
  };

  const handleCreateClick = () => {
      if (currentUser.isDemo) {
          alert("Tính năng này chỉ dành cho thành viên. Vui lòng đăng nhập để chia sẻ kiến thức cùng cộng đồng!");
          return;
      }
      setIsCreating(true);
  };

  const fileToBase64 = (file: File): Promise<{ name: string; data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64String = result.split(',')[1];
        resolve({ name: file.name, data: base64String, mimeType: file.type });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = await Promise.all(Array.from(e.target.files).map(fileToBase64));
          setPostFiles(prev => [...prev, ...newFiles]);
      }
      if (e.target) e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const newFiles = await Promise.all(Array.from(e.dataTransfer.files).map(fileToBase64));
          setPostFiles(prev => [...prev, ...newFiles]);
      }
  };

  const removeFile = (index: number) => {
      setPostFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
      if (!postTitle.trim() || (!postContent.trim() && postFiles.length === 0)) return;
      setIsSubmitting(true);
      
      let type: SharedResource['type'] = 'exercise'; // Default to text/exercise
      if (postFiles.length > 0) {
          const mime = postFiles[0].mimeType;
          if (mime.startsWith('image/')) type = 'image';
          else type = 'document';
      }

      const success = await api.publishResource({
          username: currentUser.username,
          avatar: currentUser.avatar || '😊',
          type: type,
          title: postTitle,
          description: postContent.length > 100 ? postContent.substring(0, 97) + '...' : postContent,
          data: { 
              text: postContent,
              files: postFiles.map(f => ({ 
                  name: f.name, 
                  dataUrl: `data:${f.mimeType};base64,${f.data}`, 
                  mimeType: f.mimeType 
              }))
          }
      });

      if (success) {
          setIsCreating(false);
          setPostTitle('');
          setPostContent('');
          setPostFiles([]);
          alert("Đăng bài thành công!");
      } else {
          alert("Đăng bài thất bại. Vui lòng thử lại (File có thể quá lớn hoặc lỗi kết nối).");
      }
      setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in-up">
        <div className="bg-card w-full max-w-5xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col h-[90vh] relative">
            {/* Header */}
            <div className="p-6 border-b border-border bg-gradient-to-r from-purple-600/10 to-blue-600/10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <span className="text-3xl">🌍</span> Khám Phá Hub
                    </h2>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleCreateClick}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors font-bold text-sm shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4" /> Đăng bài
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                            <XIcon className="w-6 h-6 text-text-secondary" />
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3 justify-between">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {['all', 'flashcard', 'mindmap', 'exercise', 'image', 'document'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors whitespace-nowrap ${filter === f ? 'bg-brand text-white shadow-md' : 'bg-input-bg text-text-secondary hover:bg-sidebar'}`}
                            >
                                {f === 'all' ? 'Tất cả' : f === 'exercise' ? 'Bài tập' : f === 'image' ? 'Hình ảnh' : f === 'document' ? 'Tài liệu' : f}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-input-bg rounded-lg text-sm border border-transparent focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-input-bg/30 scrollbar-thin scrollbar-thumb-border relative">
                
                {/* Create Post Input Area (Facebook Style) */}
                <div 
                    onClick={handleCreateClick}
                    className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all shadow-sm"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-border flex-shrink-0">
                        {currentUser.avatar?.startsWith('data:') ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center">{currentUser.avatar || '👤'}</div>}
                    </div>
                    <div className="flex-1 bg-input-bg rounded-full px-4 py-2.5 text-text-secondary text-sm hover:bg-sidebar transition-colors truncate">
                        {currentUser.isDemo ? "Đăng nhập để chia sẻ bài viết..." : "Bạn muốn chia sẻ tài liệu, bài tập gì hôm nay?"}
                    </div>
                    <div className="flex gap-2 text-text-secondary">
                        <div className="p-2 hover:bg-sidebar rounded-full text-blue-500" title="Hình ảnh"><ImageIcon className="w-5 h-5" /></div>
                        <div className="p-2 hover:bg-sidebar rounded-full text-green-500" title="Bài tập"><FileIcon className="w-5 h-5" /></div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-text-secondary">Đang tải dữ liệu cộng đồng...</p>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <div className="text-center py-20 opacity-60">
                        <p className="text-lg font-medium">Chưa có bài đăng nào.</p>
                        <p className="text-sm text-text-secondary">Hãy là người đầu tiên chia sẻ!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredResources.map(res => (
                            <div key={res.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all group flex flex-col h-full cursor-pointer" onClick={() => onOpenResource(res.type, res.data)}>
                                <div className={`h-40 relative overflow-hidden flex items-center justify-center ${getBgColor(res.type)}`}>
                                    {/* Custom Previews based on type */}
                                    {res.type === 'image' && res.data?.files?.[0]?.dataUrl ? (
                                        <img src={res.data.files[0].dataUrl} alt={res.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <>
                                            <div className="absolute top-2 right-2 bg-black/20 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white uppercase z-10">
                                                {res.type}
                                            </div>
                                            <div className="transition-transform group-hover:scale-110 duration-300">
                                                {getTypeIcon(res.type)}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-lg text-text-primary line-clamp-1 mb-1" title={res.title}>{res.title}</h3>
                                    <p className="text-xs text-text-secondary line-clamp-2 mb-4 flex-1">{res.description || 'Không có mô tả.'}</p>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden border border-border">
                                                {res.avatar?.startsWith('data:') ? <img src={res.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px]">{res.avatar || '👤'}</div>}
                                            </div>
                                            <span className="text-xs font-medium truncate max-w-[80px]">{res.username}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-text-secondary text-xs">
                                            <span className="flex items-center gap-1"><HeartIcon className="w-3 h-3" /> {res.likes}</span>
                                            {res.type === 'document' && <DownloadIcon className="w-3 h-3" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button - Always visible */}
            <button 
                onClick={handleCreateClick}
                className="absolute bottom-8 right-8 w-14 h-14 bg-brand hover:bg-brand/90 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-20"
                title="Đăng bài mới"
            >
                <PlusIcon className="w-8 h-8" />
            </button>

            {/* Create Post Modal */}
            {isCreating && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-slide-in-up">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-text-primary">Tạo bài viết mới</h3>
                            <button onClick={() => setIsCreating(false)} className="text-text-secondary hover:text-text-primary"><XIcon className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-border">
                                {currentUser.avatar?.startsWith('data:') ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center">{currentUser.avatar || '👤'}</div>}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm">{currentUser.username}</span>
                                <span className="text-xs text-text-secondary">Đang công khai 🌏</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <input 
                                type="text" 
                                value={postTitle} 
                                onChange={(e) => setPostTitle(e.target.value)}
                                placeholder="Tiêu đề / Chủ đề (Bắt buộc)"
                                className="w-full p-3 bg-input-bg border-b-2 border-transparent focus:border-brand outline-none font-bold text-lg rounded-lg"
                                autoFocus
                            />
                            <textarea 
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="Bạn đang nghĩ gì? Hãy chia sẻ kiến thức, câu hỏi hoặc bài tập..."
                                className="w-full h-32 p-3 bg-transparent outline-none resize-none text-base border border-border rounded-lg focus:border-brand"
                            />
                            
                            {/* File Drop Zone */}
                            <div 
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center transition-colors min-h-[100px] ${isDragging ? 'border-brand bg-brand/5' : 'border-border bg-input-bg/50'}`}
                            >
                                {postFiles.length > 0 ? (
                                    <div className="w-full grid grid-cols-2 gap-2">
                                       {postFiles.map((file, i) => (
                                           <div key={i} className="relative flex items-center gap-2 bg-card p-2 rounded border border-border">
                                               <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                   {file.mimeType.startsWith('image/') ? <img src={`data:${file.mimeType};base64,${file.data}`} className="w-full h-full object-cover" /> : <FileIcon className="w-4 h-4 text-text-secondary"/>}
                                               </div>
                                               <span className="text-xs truncate flex-1">{file.name}</span>
                                               <button onClick={() => removeFile(i)} className="text-red-500 hover:bg-red-100 rounded p-1"><XIcon className="w-3 h-3" /></button>
                                           </div>
                                       ))}
                                       <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-card p-2 rounded border border-border hover:bg-input-bg text-xs font-medium text-text-secondary">
                                           <PlusIcon className="w-4 h-4" /> Thêm file
                                       </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-2 cursor-pointer w-full" onClick={() => fileInputRef.current?.click()}>
                                        <AttachmentIcon className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-50" />
                                        <p className="text-sm text-text-secondary">Kéo thả file hoặc <span className="text-brand font-medium">chọn file</span></p>
                                        <p className="text-[10px] text-text-secondary/60 mt-1">Hỗ trợ ảnh, PDF, tài liệu...</p>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-border pt-4">
                            <button 
                                onClick={handleCreatePost}
                                disabled={!postTitle.trim() || (!postContent.trim() && postFiles.length === 0) || isSubmitting}
                                className="px-6 py-2 bg-brand hover:bg-brand/90 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting ? 'Đang đăng...' : 'Đăng bài'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default Discover;
