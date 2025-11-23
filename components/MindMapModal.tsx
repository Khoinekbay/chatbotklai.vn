
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type MindMapNode, type User } from '../types';
import { XIcon, ZoomInIcon, ZoomOutIcon, CenterIcon, EditIcon, PlusCircleIcon, TrashIcon, AddSiblingIcon, PaletteIcon, DetachIcon, MindMapIcon, HandIcon, ImageIcon, LinkIcon, GlobeIcon } from './Icons';
import MindMapView, { type MindMapViewHandles, type D3Node } from './MindMapView';
import { api } from '../utils/api';

// ... (Keep COLORS constant)
const COLORS = [null, '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#a7f3d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#d1d5db', '#9ca3af', '#6b7280'];

interface MindMapModalProps {
  data: MindMapNode;
  onClose: () => void;
  onCreateNewMindMap: (data: MindMapNode) => void;
  onSave: (data: MindMapNode) => void;
  currentUser: User;
}

const MindMapModal: React.FC<MindMapModalProps> = ({ data, onClose, onCreateNewMindMap, onSave, currentUser }) => {
  const mindMapRef = useRef<MindMapViewHandles>(null);
  const [selectedNodes, setSelectedNodes] = useState<D3Node[]>([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Publish State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);

  const singleSelectionNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  // ... (Keep handlers: Zoom, Edit, Add, Delete, Color, Image, Link) ...
  const handleZoomIn = () => mindMapRef.current?.zoomIn();
  const handleZoomOut = () => mindMapRef.current?.zoomOut();
  const handleReset = () => mindMapRef.current?.reset();
  const handleEdit = () => singleSelectionNode && mindMapRef.current?.editNode(singleSelectionNode.id);
  const handleAddChild = () => singleSelectionNode && mindMapRef.current?.addChild(singleSelectionNode.id);
  const handleAddSibling = () => singleSelectionNode && mindMapRef.current?.addSibling(singleSelectionNode.id);
  const handleOldDetach = () => singleSelectionNode && mindMapRef.current?.detachNode(singleSelectionNode.id);
  const handleDelete = () => {
    if (selectedNodes.length > 0 && window.confirm(`Bạn có chắc muốn xóa ${selectedNodes.length} mục đã chọn?`)) {
        const idsToDelete = selectedNodes.map(n => n.id);
        mindMapRef.current?.deleteNodes(idsToDelete);
        setSelectedNodes([]);
    }
  };
  const handleDetachToNewMindMap = () => {
    if (selectedNodes.length === 0) return;
    const freshNodes = selectedNodes.map(n => mindMapRef.current?.getNodeById(n.id)).filter((n): n is D3Node => !!n);
    if (freshNodes.length === 0) return;
    const deepClone = (node: D3Node): MindMapNode => {
        const newNode: MindMapNode = { name: node.name };
        if (node.color) newNode.color = node.color;
        if (node.image) newNode.image = node.image;
        if (node.link) newNode.link = node.link;
        if (node.children) newNode.children = node.children.map(deepClone);
        else if (node._children) newNode.children = node._children.map(deepClone);
        return newNode;
    };
    const sortedByDepth = [...freshNodes].sort((a, b) => a.depth - b.depth);
    const newRootNode = sortedByDepth[0];
    const otherNodes = sortedByDepth.slice(1);
    const newMindMapRoot = deepClone(newRootNode);
    const idsInNewRootTree = new Set<number>();
    const collectIds = (node: D3Node) => { idsInNewRootTree.add(node.id); (node.children || node._children || []).forEach(collectIds); };
    collectIds(newRootNode);
    const nodesToAttach = otherNodes.filter(node => !idsInNewRootTree.has(node.id));
    if (!newMindMapRoot.children) newMindMapRoot.children = [];
    newMindMapRoot.children.push(...nodesToAttach.map(deepClone));
    onCreateNewMindMap(newMindMapRoot);
  };
  const handleColorChange = (color: string | null) => {
    if (selectedNodes.length > 0 && mindMapRef.current) {
        const map = new Map<number, string | null>();
        selectedNodes.forEach(node => map.set(node.id, color));
        mindMapRef.current.changeColors(map);
    }
    setIsColorPickerOpen(false);
  };
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !singleSelectionNode) return;
    const reader = new FileReader();
    reader.onload = (e) => { const base64 = e.target?.result as string; mindMapRef.current?.updateNodeData(singleSelectionNode.id, { image: base64 }); };
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const handleAddLink = () => {
    if (!singleSelectionNode) return;
    const url = window.prompt("Nhập đường dẫn (URL):", singleSelectionNode.link || '');
    if (url !== null) mindMapRef.current?.updateNodeData(singleSelectionNode.id, { link: url });
  };
  const handleToggleNodeSelection = (node: D3Node | null, isCtrlClick: boolean) => {
    if (isColorPickerOpen) setIsColorPickerOpen(false);
    if (node === null) { setSelectedNodes([]); return; }
    setSelectedNodes(prev => {
        if (!isCtrlClick) return prev.length === 1 && prev[0].id === node.id ? [] : [node];
        else return prev.findIndex(n => n.id === node.id) > -1 ? prev.filter(n => n.id !== node.id) : [...prev, node];
    });
  };

  const handlePublish = async () => {
      if (!publishTitle.trim()) return;
      const success = await api.publishResource({
          username: currentUser.username,
          avatar: currentUser.avatar || '😊',
          type: 'mindmap',
          title: publishTitle,
          description: publishDesc,
          data: data // Use the root data passed from parent
      });
      if (success) {
          setPublishSuccess(true);
          setTimeout(() => {
              setPublishSuccess(false);
              setIsPublishing(false);
          }, 2000);
      }
  };

  const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode; danger?: boolean; ref?: React.Ref<HTMLButtonElement>}> = 
  ({ onClick, disabled, title, children, danger, ref }) => (
    <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-full transition-colors 
        ${danger ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-card-hover text-text-secondary hover:text-text-primary'}
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
        {children}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-in-up"
      style={{ animationDuration: '0.3s' }}
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Sơ đồ tư duy</h2>
          <div className="flex gap-2">
              {!currentUser.isDemo && (
                 <button onClick={() => setIsPublishing(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors text-xs font-bold">
                    <GlobeIcon className="w-4 h-4" /> Public
                 </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-card-hover" aria-label="Đóng">
                <XIcon className="w-5 h-5" />
              </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden p-4 md:p-6 flex items-start justify-center relative">
            <MindMapView
                ref={mindMapRef}
                data={data}
                selectedNodeIds={selectedNodes.map(n => n.id)}
                onToggleNodeSelection={handleToggleNodeSelection}
                isPanMode={isPanMode}
                onDataChange={onSave}
            />
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Publish Modal Overlay */}
        {isPublishing && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-slide-in-up">
                <div className="bg-card w-full max-w-md rounded-2xl p-6 border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-text-primary text-center mb-4">Chia sẻ sơ đồ</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Tiêu đề</label>
                            <input autoFocus type="text" value={publishTitle} onChange={(e) => setPublishTitle(e.target.value)} className="w-full p-3 bg-input-bg border border-border rounded-xl outline-none focus:border-brand" placeholder="VD: Sơ đồ lịch sử VN..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Mô tả</label>
                            <textarea value={publishDesc} onChange={(e) => setPublishDesc(e.target.value)} className="w-full p-3 bg-input-bg border border-border rounded-xl outline-none focus:border-brand h-24 resize-none" placeholder="Mô tả ngắn gọn..." />
                        </div>
                        {publishSuccess ? (
                            <div className="bg-green-500/10 text-green-600 text-center p-3 rounded-xl font-bold animate-pulse">Đã đăng thành công! 🎉</div>
                        ) : (
                            <div className="flex gap-3">
                                <button onClick={() => setIsPublishing(false)} className="flex-1 py-3 bg-sidebar hover:bg-card-hover text-text-primary font-bold rounded-xl transition-colors">Hủy</button>
                                <button onClick={handlePublish} disabled={!publishTitle.trim()} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">Đăng</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <footer className="flex-shrink-0 flex items-center justify-between p-2 border-t border-border">
          <div className="h-10 flex items-center min-w-[300px] pl-2 overflow-x-auto no-scrollbar">
            {selectedNodes.length > 0 && (
                <div className="flex items-center gap-1 bg-sidebar p-1 rounded-full animate-slide-in-up" style={{animationDuration: '0.2s'}}>
                    {singleSelectionNode && (
                        <>
                            <ActionButton onClick={handleEdit} title="Sửa nội dung"><EditIcon className="w-5 h-5" /></ActionButton>
                            <ActionButton onClick={() => fileInputRef.current?.click()} title="Thêm/Sửa ảnh"><ImageIcon className="w-5 h-5" /></ActionButton>
                            <ActionButton onClick={handleAddLink} title="Thêm/Sửa liên kết"><LinkIcon className="w-5 h-5" /></ActionButton>
                        </>
                    )}
                    <ActionButton ref={colorPickerButtonRef} onClick={() => setIsColorPickerOpen(p => !p)} title="Màu nhánh"><PaletteIcon className="w-5 h-5" /></ActionButton>
                     <div className="w-[1px] h-5 bg-border mx-1"></div>
                    {singleSelectionNode && (
                        <>
                            <ActionButton onClick={handleAddChild} title="Thêm nhánh con"><PlusCircleIcon className="w-5 h-5" /></ActionButton>
                            <ActionButton onClick={handleAddSibling} disabled={singleSelectionNode.depth === 0} title="Thêm mục ngang"><AddSiblingIcon className="w-5 h-5" /></ActionButton>
                             <ActionButton onClick={handleOldDetach} disabled={singleSelectionNode.depth < 2} title="Tách nhánh"><DetachIcon className="w-5 h-5" /></ActionButton>
                        </>
                    )}
                    <ActionButton onClick={handleDetachToNewMindMap} title="Tách thành sơ đồ mới"><MindMapIcon className="w-5 h-5 text-brand" /></ActionButton>
                    <ActionButton onClick={handleDelete} disabled={selectedNodes.some(n => n.depth === 0)} title="Xóa mục" danger><TrashIcon className="w-5 h-5" /></ActionButton>
                </div>
            )}
            {selectedNodes.length > 0 && <span className="text-xs text-text-secondary ml-3 whitespace-nowrap">{selectedNodes.length} mục đã chọn</span>}
          </div>

          <div className="flex items-center gap-2 bg-sidebar p-1 rounded-full flex-shrink-0">
            <button onClick={() => setIsPanMode(p => !p)} className={`p-2 rounded-full transition-colors ${isPanMode ? 'bg-brand-secondary text-brand' : 'text-text-secondary hover:bg-card-hover hover:text-text-primary'}`} title="Chế độ di chuyển"><HandIcon className="w-5 h-5" /></button>
            <div className="w-[1px] h-5 bg-border mx-1"></div>
            <button onClick={handleZoomOut} className="p-2 text-text-secondary rounded-full hover:bg-card-hover transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
            <button onClick={handleReset} className="p-2 text-text-secondary rounded-full hover:bg-card-hover transition-colors"><CenterIcon className="w-5 h-5" /></button>
            <button onClick={handleZoomIn} className="p-2 text-text-secondary rounded-full hover:bg-card-hover transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
          </div>
        </footer>
      </div>

      {isColorPickerOpen && colorPickerButtonRef.current && createPortal(
        <div className="absolute z-10 bg-card border border-border rounded-lg shadow-xl p-2 animate-slide-in-up" style={{ left: colorPickerButtonRef.current.getBoundingClientRect().left, bottom: window.innerHeight - colorPickerButtonRef.current.getBoundingClientRect().top + 8, animationDuration: '0.1s' }} onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-8 gap-1">
                {COLORS.map((color, index) => (
                    <button key={index} onClick={() => handleColorChange(color)} className="w-7 h-7 rounded-full transition-transform hover:scale-110 border border-border" style={{ backgroundColor: color || 'var(--card)' }}>{!color && <XIcon className="w-4 h-4 text-text-secondary mx-auto"/>}</button>
                ))}
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MindMapModal;
