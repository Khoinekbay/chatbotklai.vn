

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { SharedResource, User } from '../types';
import { XIcon, SearchIcon, HeartIcon, DownloadIcon, FlashcardIcon, MindMapIcon, ImageIcon, FileIcon, PenIcon, PlusIcon, AttachmentIcon, TrashIcon, CheckIcon, TrophyIcon, FireIcon } from './Icons';

interface DiscoverProps {
  onClose: () => void;
  onOpenResource: (type: SharedResource['type'], data: any) => void;
  currentUser: User;
}

const SUBJECTS = [
    { id: 'Tất cả', color: 'bg-gray-500' },
    { id: 'Toán', color: 'bg-blue-500' },
    { id: 'Văn', color: 'bg-pink-500' },
    { id: 'Anh', color: 'bg-purple-500' },
    { id: 'Lý', color: 'bg-indigo-500' },
    { id: 'Hóa', color: 'bg-green-500' },
    { id: 'Sinh', color: 'bg-emerald-500' },
    { id: 'Sử', color: 'bg-yellow-600' },
    { id: 'Địa', color: 'bg-orange-500' },
    { id: 'Tin', color: 'bg-cyan-600' },
    { id: 'GDCD', color: 'bg-red-400' },
    { id: 'Công nghệ', color: 'bg-teal-500' },
    { id: 'Nghệ thuật', color: 'bg-rose-400' },
    { id: 'Tự do', color: 'bg-gray-600' }
];

const Discover: React.FC<DiscoverProps> = ({ onClose, onOpenResource, currentUser }) => {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState('Tất cả');
  const [sortBy, setSortBy] = useState<'newest' | 'trending'>('trending');
  const [search, setSearch] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  
  // Create Post State
  const [isCreating, setIsCreating] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postSubject, setPostSubject] = useState('Tự do');
  const [postFiles, setPostFiles] = useState<{ name: string; data: string; mimeType: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail View State
  const [selectedResource, setSelectedResource] = useState<SharedResource | null>(null);

  useEffect(() => {
      const load = async () => {
          setIsLoading(true);
          const data = await api.getSharedResources();
          setResources(data);
          
          // Restore likes from local session
          const storedLikes = localStorage.getItem('kl_ai_user_likes');
          if (storedLikes) {
              setLikedPosts(new Set(JSON.parse(storedLikes)));
          }
          
          setIsLoading(false);
      };
      load();
  }, [isCreating]); // Reload after creating

  const filteredResources = resources
      .filter(res => {
          const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase()) || res.username.toLowerCase().includes(search.toLowerCase());
          const matchesSubject = activeSubject === 'Tất cả' || res.subject === activeSubject;
          return matchesSearch && matchesSubject;
      })
      .sort((a, b) => {
          if (sortBy === 'trending') {
              return b.likes - a.likes;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'flashcard': return <FlashcardIcon className="w-10 h-10 text-yellow-600 opacity-90" />;
          case 'mindmap': return <MindMapIcon className="w-10 h-10 text-purple-600 opacity-90" />;
          case 'image': return <ImageIcon className="w-10 h-10 text-blue-500 opacity-90" />;
          case 'document': return <FileIcon className="w-10 h-10 text-red-500 opacity-90" />;
          case 'exercise': return <PenIcon className="w-10 h-10 text-green-600 opacity-90" />;
          default: return null;
      }
  };

  const getSubjectColor = (sub: string) => {
      const found = SUBJECTS.find(s => s.id === sub);
      return found ? found.color : 'bg-gray-500';
  };

  const handleCreateClick = () => {
      if (currentUser.isDemo) {
          alert("Tính năng này chỉ dành cho thành viên. Vui lòng đăng nhập để chia sẻ kiến thức cùng cộng đồng!");
          return;
      }
      setIsCreating(true);
  };

  const handleLikeToggle = async (e: React.MouseEvent, resource: SharedResource) => {
      e.stopPropagation();
      const isLiked = likedPosts.has(resource.id);
      
      // Optimistic UI Update
      const newLikes = isLiked ? resource.likes - 1 : resource.likes + 1;
      const newLikedSet = new Set(likedPosts);
      if (isLiked) newLikedSet.delete(resource.id);
      else newLikedSet.add(resource.id);
      
      setLikedPosts(newLikedSet);
      setResources(prev => prev.map(r => r.id === resource.id ? { ...r, likes: newLikes } : r));
      localStorage.setItem('kl_ai_user_likes', JSON.stringify(Array.from(newLikedSet)));

      // API Call
      await api.toggleLikeResource(resource.id, resource.likes, !isLiked);
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
      
      let type: SharedResource['type'] = 'exercise';
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
          description: postContent,
          subject: postSubject,
          data: { 
              text: postContent,
              subject: postSubject, // Store inside data as well for compatibility
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
          setPostSubject('Tự do');
      }
      setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in-up">
        <div className="bg-card w-full max-w-6xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col h-[90vh] relative">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-border bg-gradient-to-r from-indigo-600/10 to-purple-600/10 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <span className="text-3xl">🌍</span> Khám Phá Hub
                    </h2>
                    
                    <div className="flex items-center gap-3 flex-1 md:justify-end">
                        <div className="relative w-full md:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="text" 
                                placeholder="Tìm bài viết, tác giả..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-input-bg rounded-full text-sm border border-transparent focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none shadow-sm"
                            />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                            <XIcon className="w-6 h-6 text-text-secondary" />
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
                    {/* Subject Filter - Scrollable */}
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-hide no-scrollbar mask-fade-right">
                        {SUBJECTS.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setActiveSubject(sub.id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeSubject === sub.id ? `${sub.color} text-white border-transparent shadow-md scale-105` : 'bg-card border-border text-text-secondary hover:bg-sidebar'}`}
                            >
                                {sub.id}
                            </button>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex bg-input-bg p-1 rounded-lg">
                            <button 
                                onClick={() => setSortBy('trending')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${sortBy === 'trending' ? 'bg-white dark:bg-gray-700 shadow text-orange-500' : 'text-text-secondary'}`}
                            >
                                <FireIcon className="w-3 h-3" /> Nổi bật
                            </button>
                            <button 
                                onClick={() => setSortBy('newest')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${sortBy === 'newest' ? 'bg-white dark:bg-gray-700 shadow text-blue-500' : 'text-text-secondary'}`}
                            >
                                <CheckIcon className="w-3 h-3" /> Mới nhất
                            </button>
                        </div>
                        
                        <button 
                            onClick={handleCreateClick}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors font-bold text-xs shadow-lg hover:shadow-brand/30 active:scale-95"
                        >
                            <PlusIcon className="w-4 h-4" /> Đăng bài
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-input-bg/30 scrollbar-thin scrollbar-thumb-border relative">
                
                {/* Create Post Input Area (Mobile/Quick Access) */}
                <div 
                    onClick={handleCreateClick}
                    className="bg-card border border-border rounded-2xl p-4 mb-8 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all shadow-sm transform hover:-translate-y-1"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-border flex-shrink-0">
                        {currentUser.avatar?.startsWith('data:') ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center">{currentUser.avatar || '👤'}</div>}
                    </div>
                    <div className="flex-1 bg-input-bg rounded-full px-4 py-3 text-text-secondary text-sm hover:bg-sidebar transition-colors truncate">
                        {currentUser.isDemo ? "Đăng nhập để chia sẻ bài viết..." : "Bạn muốn chia sẻ kiến thức gì hôm nay?"}
                    </div>
                    <div className="flex gap-2 text-text-secondary">
                        <div className="p-2 hover:bg-sidebar rounded-full text-green-500" title="Tài liệu"><FileIcon className="w-5 h-5" /></div>
                        <div className="p-2 hover:bg-sidebar rounded-full text-blue-500" title="Hình ảnh"><ImageIcon className="w-5 h-5" /></div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-text-secondary">Đang tải dữ liệu cộng đồng...</p>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <div className="text-center py-20 opacity-60">
                        <p className="text-lg font-medium">Không tìm thấy bài đăng nào.</p>
                        <p className="text-sm text-text-secondary">Hãy là người đầu tiên chia sẻ về chủ đề này!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredResources.map((res, index) => (
                            <div 
                                key={res.id} 
                                className={`bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full cursor-pointer relative ${sortBy === 'trending' && index < 3 ? 'ring-2 ring-yellow-400/50' : ''}`} 
                                onClick={() => setSelectedResource(res)}
                            >
                                {/* Ranking Badge */}
                                {sortBy === 'trending' && index < 3 && (
                                    <div className="absolute top-0 left-0 z-20 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-br-xl font-black text-xs shadow-md flex items-center gap-1">
                                        <TrophyIcon className="w-3 h-3" /> TOP {index + 1}
                                    </div>
                                )}

                                <div className="h-40 relative overflow-hidden flex items-center justify-center bg-sidebar/50 group-hover:bg-sidebar transition-colors">
                                    {/* Type Icon / Preview */}
                                    {res.type === 'image' && res.data?.files?.[0]?.dataUrl ? (
                                        <img src={res.data.files[0].dataUrl} alt={res.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <div className="transition-transform group-hover:scale-110 duration-300">
                                            {getTypeIcon(res.type)}
                                        </div>
                                    )}
                                    
                                    {/* Subject Badge */}
                                    <div className={`absolute top-3 right-3 ${getSubjectColor(res.subject || 'Tự do')} text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-sm z-10`}>
                                        {res.subject || 'Tự do'}
                                    </div>
                                </div>
                                
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="font-bold text-lg text-text-primary line-clamp-2 mb-2 leading-tight group-hover:text-brand transition-colors">{res.title}</h3>
                                    <p className="text-xs text-text-secondary line-clamp-3 mb-4 flex-1 leading-relaxed">{res.description || 'Không có mô tả chi tiết.'}</p>
                                    
                                    <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden border border-border shadow-sm">
                                                {res.avatar?.startsWith('data:') ? <img src={res.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px]">{res.avatar || '👤'}</div>}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold truncate max-w-[80px]">{res.username}</span>
                                                <span className="text-[9px] text-text-secondary">{new Date(res.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Like Button */}
                                        <button 
                                            onClick={(e) => handleLikeToggle(e, res)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-90 ${likedPosts.has(res.id) ? 'bg-red-500/10 text-red-500' : 'bg-sidebar hover:bg-red-500/10 hover:text-red-500 text-text-secondary'}`}
                                        >
                                            <HeartIcon className={`w-4 h-4 ${likedPosts.has(res.id) ? 'fill-current' : ''}`} /> 
                                            <span className="text-xs font-bold">{res.likes}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button (Mobile) */}
            <button 
                onClick={handleCreateClick}
                className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-brand hover:bg-brand/90 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-20"
            >
                <PlusIcon className="w-8 h-8" />
            </button>

            {/* Resource Detail Modal */}
            {selectedResource && (
                <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-slide-in-up">
                    <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-message-pop-in">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-border flex items-start justify-between bg-sidebar/30">
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded w-fit ${getSubjectColor(selectedResource.subject || 'Tự do')}`}>{selectedResource.subject || 'Tự do'}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-input-bg px-2 py-0.5 rounded w-fit border border-border">{selectedResource.type}</span>
                                </div>
                                <h2 className="text-xl font-bold text-text-primary line-clamp-2">{selectedResource.title}</h2>
                            </div>
                            <button onClick={() => setSelectedResource(null)} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full">
                                <XIcon className="w-6 h-6 text-text-secondary"/>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Author */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border-2 border-brand/20">
                                        {selectedResource.avatar?.startsWith('data:') ? <img src={selectedResource.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">{selectedResource.avatar || '👤'}</div>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{selectedResource.username}</p>
                                        <p className="text-xs text-text-secondary">{new Date(selectedResource.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleLikeToggle(e, selectedResource)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${likedPosts.has(selectedResource.id) ? 'bg-red-500 text-white shadow-red-500/30 shadow-lg' : 'bg-input-bg hover:bg-red-100 hover:text-red-500 text-text-secondary'}`}
                                >
                                    <HeartIcon className={`w-5 h-5 ${likedPosts.has(selectedResource.id) ? 'fill-current' : ''}`} /> 
                                    <span className="font-bold">{selectedResource.likes}</span>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="prose dark:prose-invert max-w-none mb-6 p-4 bg-input-bg/30 rounded-xl border border-border/50">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedResource.description}</p>
                            </div>

                            {/* Files/Attachments Preview */}
                            {selectedResource.data?.files && selectedResource.data.files.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                    {selectedResource.data.files.map((file: any, i: number) => (
                                        <div key={i} className="border border-border rounded-lg overflow-hidden group relative shadow-sm">
                                            {file.mimeType.startsWith('image/') ? (
                                                <img src={file.dataUrl} className="w-full h-32 object-cover" />
                                            ) : (
                                                <div className="w-full h-32 bg-sidebar flex flex-col items-center justify-center p-2">
                                                    <FileIcon className="w-8 h-8 text-text-secondary mb-2" />
                                                    <span className="text-xs text-center text-text-secondary break-all line-clamp-2 px-2">{file.name}</span>
                                                </div>
                                            )}
                                            <a 
                                                href={file.dataUrl} 
                                                download={file.name}
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2 backdrop-blur-sm"
                                            >
                                                <DownloadIcon className="w-5 h-5" /> Tải về
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-sidebar/30 flex justify-end gap-3">
                            <button onClick={() => setSelectedResource(null)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-card-hover transition-colors">Đóng</button>
                            <button 
                                onClick={() => { onOpenResource(selectedResource.type, selectedResource.data); setSelectedResource(null); }}
                                className="px-6 py-2 bg-brand text-white rounded-lg text-sm font-bold shadow-md hover:bg-brand/90 transition-transform active:scale-95"
                            >
                                {selectedResource.type === 'exercise' ? 'Làm bài này' : selectedResource.type === 'flashcard' ? 'Học ngay' : 'Xem chi tiết'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                <select 
                                    value={postSubject} 
                                    onChange={(e) => setPostSubject(e.target.value)}
                                    className="text-xs text-text-secondary bg-transparent outline-none cursor-pointer hover:text-brand font-medium"
                                >
                                    {SUBJECTS.filter(s => s.id !== 'Tất cả').map(sub => (
                                        <option key={sub.id} value={sub.id}>Chủ đề: {sub.id}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <input 
                                type="text" 
                                value={postTitle} 
                                onChange={(e) => setPostTitle(e.target.value)}
                                placeholder="Tiêu đề bài viết..."
                                className="w-full p-3 bg-input-bg border-b-2 border-transparent focus:border-brand outline-none font-bold text-lg rounded-lg"
                                autoFocus
                            />
                            <textarea 
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="Bạn muốn chia sẻ kiến thức gì? Viết nội dung ở đây..."
                                className="w-full h-32 p-3 bg-transparent outline-none resize-none text-base border border-border rounded-lg focus:border-brand"
                            />
                            
                            {/* File Drop Zone */}
                            <div 
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors min-h-[120px] cursor-pointer group ${isDragging ? 'border-brand bg-brand/5' : 'border-border hover:border-brand hover:bg-input-bg'}`}
                            >
                                {postFiles.length > 0 ? (
                                    <div className="w-full grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                                       {postFiles.map((file, i) => (
                                           <div key={i} className="relative flex items-center gap-2 bg-card p-2 rounded border border-border shadow-sm">
                                               <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                   {file.mimeType.startsWith('image/') ? <img src={`data:${file.mimeType};base64,${file.data}`} className="w-full h-full object-cover" /> : <FileIcon className="w-4 h-4 text-text-secondary"/>}
                                               </div>
                                               <span className="text-xs truncate flex-1">{file.name}</span>
                                               <button onClick={() => removeFile(i)} className="text-red-500 hover:bg-red-100 rounded p-1"><XIcon className="w-3 h-3" /></button>
                                           </div>
                                       ))}
                                       <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-card p-2 rounded border border-border hover:bg-input-bg text-xs font-medium text-text-secondary border-dashed">
                                           <PlusIcon className="w-4 h-4" /> Thêm file
                                       </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-3 bg-input-bg rounded-full mb-2 group-hover:scale-110 transition-transform">
                                            <AttachmentIcon className="w-6 h-6 text-text-secondary" />
                                        </div>
                                        <p className="text-sm font-medium text-text-primary">Chọn file hoặc kéo thả vào đây</p>
                                        <p className="text-[10px] text-text-secondary mt-1">Hỗ trợ ảnh, PDF, Word, Excel...</p>
                                    </>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-border pt-4 gap-3">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-input-bg text-text-secondary transition-colors">Hủy</button>
                            <button 
                                onClick={handleCreatePost}
                                disabled={!postTitle.trim() || (!postContent.trim() && postFiles.length === 0) || isSubmitting}
                                className="px-6 py-2 bg-brand hover:bg-brand/90 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand/20"
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