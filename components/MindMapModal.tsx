

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type MindMapNode } from '../types';
import { XIcon, ZoomInIcon, ZoomOutIcon, CenterIcon, EditIcon, PlusCircleIcon, TrashIcon, AddSiblingIcon, PaletteIcon, DetachIcon, MindMapIcon, HandIcon } from './Icons';
import MindMapView, { type MindMapViewHandles, type D3Node } from './MindMapView';


const COLORS = [
    null,      // For clearing color
    // Brights
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#84cc16', // lime-500
    '#22c55e', // green-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#d946ef', // fuchsia-500
    '#ec4899', // pink-500
    // Pastels
    '#fecaca', // red-200
    '#fed7aa', // orange-200
    '#fef08a', // yellow-200
    '#d9f99d', // lime-200
    '#a7f3d0', // emerald-200
    '#a5f3fc', // cyan-200
    '#bfdbfe', // blue-200
    '#ddd6fe', // violet-200
    '#fbcfe8', // pink-200
    // Grays
    '#d1d5db', // gray-300
    '#9ca3af', // gray-400
    '#6b7280', // gray-500
];

interface MindMapModalProps {
  data: MindMapNode;
  onClose: () => void;
  onCreateNewMindMap: (data: MindMapNode) => void;
}

const MindMapModal: React.FC<MindMapModalProps> = ({ data, onClose, onCreateNewMindMap }) => {
  const mindMapRef = useRef<MindMapViewHandles>(null);
  const [selectedNodes, setSelectedNodes] = useState<D3Node[]>([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null);

  const singleSelectionNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  const handleZoomIn = () => mindMapRef.current?.zoomIn();
  const handleZoomOut = () => mindMapRef.current?.zoomOut();
  const handleReset = () => mindMapRef.current?.reset();

  const handleEdit = () => singleSelectionNode && mindMapRef.current?.editNode(singleSelectionNode.id);
  const handleAddChild = () => singleSelectionNode && mindMapRef.current?.addChild(singleSelectionNode.id);
  const handleAddSibling = () => singleSelectionNode && mindMapRef.current?.addSibling(singleSelectionNode.id);
  const handleOldDetach = () => singleSelectionNode && mindMapRef.current?.detachNode(singleSelectionNode.id);

  const handleDelete = () => {
    if (selectedNodes.length > 0 && window.confirm(`Bạn có chắc muốn xóa ${selectedNodes.length} mục đã chọn và tất cả các mục con của chúng?`)) {
        const idsToDelete = selectedNodes.map(n => n.id);
        mindMapRef.current?.deleteNodes(idsToDelete);
        setSelectedNodes([]);
    }
  };
  
  const handleDetachToNewMindMap = () => {
    if (selectedNodes.length === 0) return;

    const deepClone = (node: D3Node): MindMapNode => {
        const newNode: MindMapNode = { name: node.name };
        if (node.color) newNode.color = node.color;
        if (node.children) {
            newNode.children = node.children.map(deepClone);
        } else if (node._children) {
            newNode.children = node._children.map(deepClone);
        }
        return newNode;
    };

    const sortedByDepth = [...selectedNodes].sort((a, b) => a.depth - b.depth);
    const newRootNode = sortedByDepth[0];
    const otherNodes = sortedByDepth.slice(1);

    const newMindMapRoot = deepClone(newRootNode);

    const idsInNewRootTree = new Set<number>();
    const collectIds = (node: D3Node) => {
        idsInNewRootTree.add(node.id);
        (node.children || node._children || []).forEach(collectIds);
    };
    collectIds(newRootNode);
    
    const nodesToAttach = otherNodes.filter(node => !idsInNewRootTree.has(node.id));

    if (!newMindMapRoot.children) {
        newMindMapRoot.children = [];
    }
    newMindMapRoot.children.push(...nodesToAttach.map(deepClone));

    onCreateNewMindMap(newMindMapRoot);
    onClose();
  };


  const handleColorChange = (color: string | null) => {
    if (selectedNodes.length > 0 && mindMapRef.current) {
        const map = new Map<number, string | null>();
        selectedNodes.forEach(node => map.set(node.id, color));
        mindMapRef.current.changeColors(map);
    }
    setIsColorPickerOpen(false);
  };
  
  const handleToggleNodeSelection = (node: D3Node | null, isCtrlClick: boolean) => {
    if (isColorPickerOpen) setIsColorPickerOpen(false);
    
    if (node === null) {
        setSelectedNodes([]);
        return;
    }

    setSelectedNodes(prev => {
        if (!isCtrlClick) {
            return prev.length === 1 && prev[0].id === node.id ? [] : [node];
        } else {
            const existingIndex = prev.findIndex(n => n.id === node.id);
            if (existingIndex > -1) {
                return prev.filter(n => n.id !== node.id);
            } else {
                return [...prev, node];
            }
        }
    });
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
        className="bg-card rounded-2xl shadow-xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Sơ đồ tư duy</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-card-hover" aria-label="Đóng">
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        
        <div className="flex-1 overflow-hidden p-4 md:p-6 flex items-start justify-center relative">
            <MindMapView
                ref={mindMapRef}
                data={data}
                selectedNodeIds={selectedNodes.map(n => n.id)}
                onToggleNodeSelection={handleToggleNodeSelection}
                isPanMode={isPanMode}
            />
        </div>

        <footer className="flex-shrink-0 flex items-center justify-between p-2 border-t border-border">
          <div className="h-10 flex items-center min-w-[300px] pl-2">
            {selectedNodes.length > 0 && (
                <div className="flex items-center gap-1 bg-sidebar p-1 rounded-full animate-slide-in-up" style={{animationDuration: '0.2s'}}>
                    {/* Single Selection Actions */}
                    {singleSelectionNode && (
                        <>
                            <ActionButton onClick={handleEdit} title="Sửa nội dung">
                                <EditIcon className="w-5 h-5" />
                            </ActionButton>
                        </>
                    )}
                    
                    {/* Multi Selection Actions */}
                    <ActionButton ref={colorPickerButtonRef} onClick={() => setIsColorPickerOpen(p => !p)} title="Màu nhánh">
                        <PaletteIcon className="w-5 h-5" />
                    </ActionButton>
                    
                     <div className="w-[1px] h-5 bg-border mx-1"></div>

                    {singleSelectionNode && (
                        <>
                            <ActionButton onClick={handleAddChild} title="Thêm nhánh con">
                                <PlusCircleIcon className="w-5 h-5" />
                            </ActionButton>
                            <ActionButton onClick={handleAddSibling} disabled={singleSelectionNode.depth === 0} title="Thêm mục ngang">
                                <AddSiblingIcon className="w-5 h-5" />
                            </ActionButton>
                             <ActionButton onClick={handleOldDetach} disabled={singleSelectionNode.depth < 2} title="Tách nhánh (lên một cấp)">
                                <DetachIcon className="w-5 h-5" />
                            </ActionButton>
                        </>
                    )}
                    
                    <ActionButton onClick={handleDetachToNewMindMap} title="Tách thành sơ đồ mới">
                        <MindMapIcon className="w-5 h-5 text-brand" />
                    </ActionButton>
                    
                    <ActionButton onClick={handleDelete} disabled={selectedNodes.some(n => n.depth === 0)} title="Xóa mục" danger>
                        <TrashIcon className="w-5 h-5" />
                    </ActionButton>
                </div>
            )}
            {selectedNodes.length > 0 && (
                 <span className="text-xs text-text-secondary ml-3">{selectedNodes.length} mục đã chọn</span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-sidebar p-1 rounded-full">
            <button
                onClick={() => setIsPanMode(p => !p)}
                className={`p-2 rounded-full transition-colors ${isPanMode ? 'bg-brand-secondary text-brand' : 'text-text-secondary hover:bg-card-hover hover:text-text-primary'}`}
                title="Chế độ di chuyển (Pan)"
            >
              <HandIcon className="w-5 h-5" />
            </button>
            <div className="w-[1px] h-5 bg-border mx-1"></div>
            <button onClick={handleZoomOut} className="p-2 text-text-secondary rounded-full hover:bg-card-hover hover:text-text-primary transition-colors" title="Thu nhỏ">
              <ZoomOutIcon className="w-5 h-5" />
            </button>
            <button onClick={handleReset} className="p-2 text-text-secondary rounded-full hover:bg-card-hover hover:text-text-primary transition-colors" title="Về trung tâm">
              <CenterIcon className="w-5 h-5" />
            </button>
            <button onClick={handleZoomIn} className="p-2 text-text-secondary rounded-full hover:bg-card-hover hover:text-text-primary transition-colors" title="Phóng to">
              <ZoomInIcon className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </div>

      {isColorPickerOpen && colorPickerButtonRef.current && createPortal(
        <div
            className="absolute z-10 bg-card border border-border rounded-lg shadow-xl p-2 animate-slide-in-up"
            style={{ 
                left: colorPickerButtonRef.current.getBoundingClientRect().left,
                bottom: window.innerHeight - colorPickerButtonRef.current.getBoundingClientRect().top + 8,
                animationDuration: '0.1s' 
            }}
            onClick={e => e.stopPropagation()}
        >
            <div className="grid grid-cols-8 gap-1">
                {COLORS.map((color, index) => (
                    <button
                        key={index}
                        onClick={() => handleColorChange(color)}
                        className="w-7 h-7 rounded-full transition-transform hover:scale-110 border border-border"
                        style={{ backgroundColor: color || 'var(--card)' }}
                        title={color || 'Xóa màu'}
                    >
                        {!color && <XIcon className="w-4 h-4 text-text-secondary mx-auto"/>}
                    </button>
                ))}
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MindMapModal;