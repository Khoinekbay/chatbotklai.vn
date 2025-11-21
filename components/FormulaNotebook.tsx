

import React, { useState, useEffect } from 'react';
import { SearchIcon, PlusCircleIcon, TrashIcon, NotebookIcon } from './Icons';

interface Formula {
    id: string;
    title: string;
    expression: string; // LaTeX
    category: 'Toán' | 'Lý' | 'Hóa' | 'Khác';
    note?: string;
}

const DEFAULT_FORMULAS: Formula[] = [
    // Toán
    { id: 't1', category: 'Toán', title: 'Phương trình bậc 2', expression: 'ax^2 + bx + c = 0 \\Rightarrow x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}' },
    { id: 't2', category: 'Toán', title: 'Định lý Pythagore', expression: 'a^2 + b^2 = c^2' },
    { id: 't3', category: 'Toán', title: 'Đạo hàm sin', expression: '(\\sin x)\' = \\cos x' },
    { id: 't4', category: 'Toán', title: 'Diện tích hình tròn', expression: 'S = \\pi r^2' },
    { id: 't5', category: 'Toán', title: 'Hằng đẳng thức 1', expression: '(a+b)^2 = a^2 + 2ab + b^2' },
    
    // Lý
    { id: 'l1', category: 'Lý', title: 'Định luật II Newton', expression: '\\vec{F} = m\\vec{a}' },
    { id: 'l2', category: 'Lý', title: 'Động năng', expression: 'W_d = \\frac{1}{2}mv^2' },
    { id: 'l3', category: 'Lý', title: 'Định luật Ohm', expression: 'I = \\frac{U}{R}' },
    
    // Hóa
    { id: 'h1', category: 'Hóa', title: 'Số mol', expression: 'n = \\frac{m}{M}' },
    { id: 'h2', category: 'Hóa', title: 'Nồng độ mol', expression: 'C_M = \\frac{n}{V}' },
    { id: 'h3', category: 'Hóa', title: 'Phương trình khí lý tưởng', expression: 'pV = nRT' },
];

const FormulaNotebook: React.FC = () => {
    const [formulas, setFormulas] = useState<Formula[]>(DEFAULT_FORMULAS);
    const [activeCategory, setActiveCategory] = useState<string>('Tất cả');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    
    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newExpression, setNewExpression] = useState('');
    const [newCategory, setNewCategory] = useState<'Toán' | 'Lý' | 'Hóa' | 'Khác'>('Toán');

    useEffect(() => {
        const saved = localStorage.getItem('kl-ai-custom-formulas');
        if (saved) {
            try {
                const customFormulas = JSON.parse(saved);
                setFormulas([...DEFAULT_FORMULAS, ...customFormulas]);
            } catch (e) {
                console.error("Failed to load formulas", e);
            }
        }
    }, []);

    useEffect(() => {
        if (window.MathJax) {
            // Typeset MathJax whenever the filtered list changes
             setTimeout(() => {
                window.MathJax.typesetPromise?.();
            }, 100);
        }
    }, [formulas, activeCategory, searchQuery, isAdding]);

    const handleSave = () => {
        if (!newTitle.trim() || !newExpression.trim()) return;

        const newFormula: Formula = {
            id: `custom-${Date.now()}`,
            title: newTitle,
            expression: newExpression,
            category: newCategory,
        };

        const updatedFormulas = [...formulas, newFormula];
        setFormulas(updatedFormulas);

        // Save only custom ones to local storage
        const customOnly = updatedFormulas.filter(f => f.id.startsWith('custom-'));
        localStorage.setItem('kl-ai-custom-formulas', JSON.stringify(customOnly));

        setIsAdding(false);
        setNewTitle('');
        setNewExpression('');
    };

    const handleDelete = (id: string) => {
        if (!id.startsWith('custom-')) return; // Only delete custom
        if (window.confirm('Bạn có chắc muốn xóa công thức này?')) {
            const updatedFormulas = formulas.filter(f => f.id !== id);
            setFormulas(updatedFormulas);
            const customOnly = updatedFormulas.filter(f => f.id.startsWith('custom-'));
            localStorage.setItem('kl-ai-custom-formulas', JSON.stringify(customOnly));
        }
    };

    const filteredFormulas = formulas.filter(f => {
        const matchesCategory = activeCategory === 'Tất cả' || f.category === activeCategory;
        const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              f.expression.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categories = ['Tất cả', 'Toán', 'Lý', 'Hóa', 'Khác'];

    return (
        <div className="flex flex-col h-full p-4 gap-4">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-border pb-4">
                <div className="flex gap-2 overflow-x-auto max-w-full no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-brand text-white' : 'bg-input-bg text-text-secondary hover:bg-sidebar'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors shadow-sm text-sm font-bold flex-shrink-0"
                >
                    <PlusCircleIcon className="w-4 h-4" />
                    {isAdding ? 'Đóng' : 'Thêm mới'}
                </button>
            </div>

            {/* Add Form */}
            {isAdding && (
                <div className="bg-input-bg p-4 rounded-xl border border-brand/20 animate-slide-in-up">
                    <h4 className="font-bold text-sm mb-3 text-brand">Thêm công thức mới</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-text-secondary block mb-1">Tiêu đề</label>
                            <input 
                                type="text" 
                                value={newTitle} 
                                onChange={e => setNewTitle(e.target.value)}
                                className="w-full p-2 rounded-lg border border-border bg-card focus:ring-2 focus:ring-brand/50 outline-none text-sm"
                                placeholder="Ví dụ: Công thức tính..."
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-secondary block mb-1">Danh mục</label>
                            <select 
                                value={newCategory} 
                                onChange={e => setNewCategory(e.target.value as any)}
                                className="w-full p-2 rounded-lg border border-border bg-card outline-none text-sm"
                            >
                                <option value="Toán">Toán</option>
                                <option value="Lý">Lý</option>
                                <option value="Hóa">Hóa</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-text-secondary block mb-1">Biểu thức (LaTeX)</label>
                            <textarea 
                                value={newExpression} 
                                onChange={e => setNewExpression(e.target.value)}
                                className="w-full p-2 rounded-lg border border-border bg-card focus:ring-2 focus:ring-brand/50 outline-none text-sm font-mono"
                                placeholder="Ví dụ: E = mc^2"
                                rows={2}
                            />
                            <p className="text-[10px] text-text-secondary mt-1">Hỗ trợ định dạng LaTeX chuẩn.</p>
                        </div>
                        <button 
                            onClick={handleSave}
                            disabled={!newTitle || !newExpression}
                            className="w-full py-2 bg-brand text-white rounded-lg font-bold text-sm hover:bg-brand/90 disabled:opacity-50"
                        >
                            Lưu công thức
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm công thức..."
                    className="w-full pl-9 pr-4 py-2 bg-input-bg rounded-lg text-sm border border-transparent focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {filteredFormulas.length === 0 ? (
                    <div className="text-center text-text-secondary text-sm py-8 italic">
                        Không tìm thấy công thức nào.
                    </div>
                ) : (
                    filteredFormulas.map(f => (
                        <div key={f.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h5 className="font-bold text-text-primary">{f.title}</h5>
                                    <span className="text-[10px] uppercase tracking-wider text-text-secondary bg-input-bg px-1.5 py-0.5 rounded">
                                        {f.category}
                                    </span>
                                </div>
                                {f.id.startsWith('custom-') && (
                                    <button 
                                        onClick={() => handleDelete(f.id)}
                                        className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="Xóa"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="text-center py-2 overflow-x-auto">
                                <span className="math-tex text-lg">
                                    {`$$${f.expression}$$`}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default FormulaNotebook;