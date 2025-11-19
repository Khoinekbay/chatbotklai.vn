



import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, Part, Modality } from '@google/genai';
import { type Message, type ChatSession, type User, type MindMapNode, type Mode, type FollowUpAction } from './types';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import TypingIndicator from './components/TypingIndicator';
import { CreateExamIcon, SolveExamIcon, CreateScheduleIcon, NewChatIcon, KlAiLogo, UserIcon, LogoutIcon, EditIcon, SearchIcon, PinIcon, LearnModeIcon, ExamModeIcon, DownloadIcon, SunIcon, MoonIcon, TheoryModeIcon, MenuIcon, FeaturesIcon, FlashcardIcon, ShuffleIcon, CloneIcon, CalculatorIcon, PeriodicTableIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CreateFileIcon, MindMapIcon, TrashIcon, SettingsIcon, MoreHorizontalIcon } from './components/Icons';
import Auth from './components/Auth';
import SettingsModal from './components/SettingsModal';
import FlashcardView from './components/FlashcardView';
import Calculator from './components/Calculator';
import PeriodicTable from './components/PeriodicTable';
import ToolModal from './components/ToolModal';
import MindMapModal from './components/MindMapModal';


const getSystemInstruction = (role: User['aiRole'] = 'assistant', tone: User['aiTone'] = 'balanced'): string => {
    let roleDescription = '';
    switch (role) {
        case 'teacher':
            roleDescription = 'Với vai trò là một giáo viên Toán nghiêm túc và kinh nghiệm, hãy trả lời một cách chính xác, có cấu trúc và sư phạm.';
            break;
        case 'classmate':
            roleDescription = 'Với vai trò là một người bạn học thân thiện và thông minh, hãy trả lời một cách gần gũi, dễ hiểu và khuyến khích.';
            break;
        case 'assistant':
            roleDescription = 'Với vai trò là một trợ lý kỹ thuật, hãy trả lời một cách hiệu quả và đi thẳng vào vấn đề.';
            break;
    }

    let toneInstruction = '';
    switch (tone) {
        case 'humorous':
            toneInstruction = 'Sử dụng giọng văn hài hước và vui vẻ khi thích hợp.';
            break;
        case 'academic':
            toneInstruction = 'Sử dụng giọng văn học thuật, trang trọng và chính xác.';
            break;
        case 'concise':
            toneInstruction = 'Sử dụng giọng văn ngắn gọn, súc tích, loại bỏ những thông tin không cần thiết.';
            break;
        case 'balanced':
            toneInstruction = 'Sử dụng giọng văn cân bằng, thân thiện và giàu thông tin.';
            break;
    }

    const basePrompt = 'Bạn là KL AI, một trợ lý AI được thiết kế đặc biệt cho giáo viên và học sinh Việt Nam. Các câu trả lời của bạn phải bằng tiếng Việt. Sử dụng markdown để định dạng khi thích hợp, bao gồm cả công thức toán học LaTeX (sử dụng $...$ cho inline và $$...$$ cho block). Để vẽ đồ thị hàm số, hãy sử dụng khối mã "graph". Ví dụ:\n```graph\nf(x) = x^2\ny = sin(x)\n```\nĐể tạo bảng biến thiên, hãy sử dụng khối mã `bbt`. Ví dụ:\n```bbt\n| x | -∞ | 1 | +∞ |\n|---|---|---|---|\n| y\'| | + | 0 | - |\n| y | | ↗ | 2 | ↘ |\n```\nĐể tạo bảng xét dấu, hãy sử dụng khối mã `bsd`. Ví dụ:\n```bsd\n| x | -∞ | 2 | +∞ |\n|---|---|---|---|\n| f(x) | - | 0 | + |\n```';

    return `${roleDescription} ${toneInstruction} ${basePrompt}`;
}

const parseFlashcardsFromResponse = (text: string): { intro: string; cards: { term: string; definition: string }[] } | null => {
    const tableRegex = /^\|(.+)\|\r?\n\|( *[-:]+[-| :]*)\|\r?\n((?:\|.*\|\r?\n?)*)/m;
    const match = text.match(tableRegex);
  
    if (!match) return null;
  
    const intro = text.substring(0, match.index).trim();
    const tableMarkdown = match[0];
    
    const lines = tableMarkdown.trim().split('\n');
    if (lines.length < 3) return null;

    const rows = lines.slice(2);
    const cards = rows.map(row => {
      const columns = row.split('|').map(c => c.trim()).filter(Boolean);
      if (columns.length >= 2) {
        return { term: columns[0], definition: columns[1] };
      }
      return null;
    }).filter((card): card is { term: string; definition: string } => card !== null);
  
    if (cards.length === 0) return null;
  
    return { intro, cards };
};

const parseMindMapFromResponse = (text: string): { intro: string, data: MindMapNode | null } => {
    const lines = text.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'));
    if (lines.length === 0) {
        return { intro: text, data: null };
    }

    const firstListIndex = text.indexOf(lines[0]);
    const intro = text.substring(0, firstListIndex).trim();

    const getIndent = (line: string) => line.match(/^\s*/)?.[0].length || 0;

    let root: MindMapNode | null = null;
    const stack: { node: MindMapNode; indent: number }[] = [];
    const topLevelNodes: MindMapNode[] = [];


    lines.forEach(line => {
        const indent = getIndent(line);
        const name = line.trim().replace(/^[-*]\s*/, '').trim();
        if (!name) return;

        const newNode: MindMapNode = { name, children: [] };

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (stack.length > 0) {
            const parent = stack[stack.length - 1].node;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(newNode);
        } else {
            topLevelNodes.push(newNode);
        }

        stack.push({ node: newNode, indent });
    });
    
    if (topLevelNodes.length === 1) {
        root = topLevelNodes[0];
    } else if (topLevelNodes.length > 1) {
        const mainTopicFromIntro = intro.split('\n').pop()?.replace(/[:.]$/, '').trim() || 'Sơ đồ tư duy';
        root = { name: mainTopicFromIntro, children: topLevelNodes };
    }

    return { intro, data: root };
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isFeaturesPopoverOpen, setIsFeaturesPopoverOpen] = useState(false);
  const [flashcardData, setFlashcardData] = useState<{ term: string; definition: string }[] | null>(null);
  const [mindMapModalData, setMindMapModalData] = useState<MindMapNode | null>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPeriodicTableOpen, setIsPeriodicTableOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);


  const chatInstances = useRef<{ [key: string]: Chat }>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const featuresPopoverRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const savedTheme = currentUser?.theme || localStorage.getItem('kl-ai-theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
  }, [currentUser]);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kl-ai-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (currentUser?.backgroundUrl) {
      document.body.style.backgroundImage = `url(${currentUser.backgroundUrl})`;
      document.body.classList.add('has-custom-bg');
    } else {
      document.body.style.backgroundImage = 'none';
      document.body.classList.remove('has-custom-bg');
    }
    return () => {
      document.body.style.backgroundImage = 'none';
      document.body.classList.remove('has-custom-bg');
    };
  }, [currentUser?.backgroundUrl]);

  useEffect(() => {
    const verifyToken = async () => {
        const token = localStorage.getItem('kl-ai-token');
        if (token) {
            try {
                // Mock validation
                await new Promise(res => setTimeout(res, 500)); 
                const mockUserData: User = { 
                    username: 'Người dùng', 
                    password: '', 
                    aiRole: 'assistant', 
                    aiTone: 'balanced',
                    theme: 'dark'
                };
                setCurrentUser(mockUserData);

            } catch (error) {
                console.error("Xác thực token thất bại", error);
                handleLogout(); 
            }
        }
        setIsAuthenticating(false);
    };
    verifyToken();
  }, []);
  
  useEffect(() => {
    const defaultFont = "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
    document.body.style.fontFamily = currentUser?.fontPreference || defaultFont;
  }, [currentUser?.fontPreference]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchChats = async () => {
        try {
            await new Promise(res => setTimeout(res, 500));
            const mockChats: ChatSession[] = []; 
            if (mockChats.length > 0) {
                setChatSessions(mockChats);
                const firstChat = mockChats.find(p => !p.isPinned) || mockChats[0];
                setActiveChatId(firstChat.id);
            } else {
                handleNewChat(); 
            }
        } catch (e) {
            console.error("Không thể tải các cuộc trò chuyện", e);
            setError("Không thể tải các đoạn chat.");
        }
    };
    fetchChats();
  }, [currentUser]);

  
  useEffect(() => {
    if (!currentUser) return;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const systemInstruction = getSystemInstruction(currentUser?.aiRole, currentUser?.aiTone);
    
    chatSessions.forEach(session => {
        const chatHistory = session.messages
            .filter(m => m.text)
            .map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));
        const historyWithoutWelcome = chatHistory.slice(1);
        chatInstances.current[session.id] = ai.chats.create({
            model: 'gemini-3-pro-preview',
            config: { systemInstruction },
            history: historyWithoutWelcome,
        });
    });
  }, [chatSessions, currentUser, currentUser?.aiRole, currentUser?.aiTone]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatSessions, activeChatId, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        featuresPopoverRef.current && 
        !featuresPopoverRef.current.contains(event.target as Node) &&
        featuresButtonRef.current &&
        !featuresButtonRef.current.contains(event.target as Node)
      ) {
        setIsFeaturesPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
       document.removeEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    };
  }, []);

  const handleNewChat = useCallback(async () => {
    if (!currentUser) return;
    
    let newChat: ChatSession;
    try {
        const newId = Date.now().toString();
        newChat = {
          id: newId,
          title: 'Đoạn chat mới',
          messages: [{ role: 'model', text: "Xin chào! Tôi là KL AI, trợ lý ảo của bạn. Tôi có thể giúp gì cho bạn hôm nay?" }],
          isPinned: false,
        };
    } catch (error) {
        console.error("Không thể tạo cuộc trò chuyện mới:", error);
        setError("Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.");
        return;
    }

    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setIsMobileSidebarOpen(false);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const systemInstruction = getSystemInstruction(currentUser?.aiRole, currentUser?.aiTone);
    chatInstances.current[newChat.id] = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: { systemInstruction },
    });
  }, [currentUser]);

  const handleExtractText = useCallback(async (file: { data: string; mimeType: string }) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        // Using gemini-3-pro-preview for high quality vision task
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.mimeType, data: file.data } },
                    { text: "Extract all text from this image. Return only the raw text content." }
                ]
            }
        });
        return response.text;
    } catch (error) {
        console.error("OCR failed:", error);
        return null;
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string, files: { name: string; data: string; mimeType: string }[] = []) => {
    if (!activeChatId || isLoading) return;
    if (!chatInstances.current[activeChatId]) return;
    if (!text.trim() && files.length === 0) return;

    const userMessage: Message = {
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
        files: files.map(file => ({
            name: file.name,
            dataUrl: `data:${file.mimeType};base64,${file.data}`,
            mimeType: file.mimeType
        })),
        mode: mode,
    };

    setChatSessions(prev =>
        prev.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: [...chat.messages, userMessage, { role: 'model', text: '', timestamp: new Date().toISOString() }] }
                : chat
        )
    );
    setIsLoading(true);
    setError(null);
    setFlashcardData(null);

    const generateTitleIfNeeded = async (promptText: string) => {
        const activeChat = chatSessions.find(c => c.id === activeChatId);
        const isFirstUserMessage = activeChat ? activeChat.messages.filter(m => m.role === 'user').length === 1 : false;

        if (isFirstUserMessage && promptText) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            try {
                const titleGenPrompt = `Dựa vào yêu cầu đầu tiên này: "${promptText}", hãy tạo một tiêu đề ngắn gọn (tối đa 5 từ) bằng tiếng Việt cho cuộc trò chuyện. Nếu có tệp đính kèm, hãy mô tả ngắn gọn mục đích. Chỉ trả về tiêu đề, không thêm bất kỳ lời giải thích hay định dạng nào.`;
                const titleResponse = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: titleGenPrompt });
                let newTitle = titleResponse.text.trim().replace(/^"|"$/g, '');
                if (newTitle) {
                    setChatSessions(prev =>
                        prev.map(chat => chat.id === activeChatId ? { ...chat, title: newTitle } : chat)
                    );
                }
            } catch (titleError) { console.error("Không thể tạo tiêu đề cho cuộc trò chuyện", titleError); }
        }
    };

    generateTitleIfNeeded(text);

    try {
        const activeChat = chatInstances.current[activeChatId];
        
        const parts: Part[] = [{ text }];
        if (files.length > 0) {
            files.forEach(file => {
                parts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: file.data
                    }
                });
            });
        }

        const result = await activeChat.sendMessageStream({ message: parts });
        let fullText = '';
        
        for await (const chunk of result) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                setChatSessions(prev => 
                    prev.map(chat => {
                        if (chat.id !== activeChatId) return chat;
                        const newMessages = [...chat.messages];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg.role === 'model') {
                            lastMsg.text = fullText;
                        }
                        return { ...chat, messages: newMessages };
                    })
                );
            }
        }

        const flashcardData = parseFlashcardsFromResponse(fullText);
        if (flashcardData) {
             setChatSessions(prev => 
                prev.map(chat => {
                    if (chat.id !== activeChatId) return chat;
                    const newMessages = [...chat.messages];
                    newMessages[newMessages.length - 1].flashcards = flashcardData.cards;
                    return { ...chat, messages: newMessages };
                })
            );
        }
        
        const mindMapData = parseMindMapFromResponse(fullText);
        if (mindMapData.data) {
             setChatSessions(prev => 
                prev.map(chat => {
                    if (chat.id !== activeChatId) return chat;
                    const newMessages = [...chat.messages];
                    newMessages[newMessages.length - 1].mindMapData = mindMapData.data!;
                    return { ...chat, messages: newMessages };
                })
            );
        }

    } catch (error) {
        console.error("Error sending message:", error);
        setError("Đã có lỗi xảy ra khi gửi tin nhắn.");
        setChatSessions(prev => 
            prev.map(chat => {
                if (chat.id !== activeChatId) return chat;
                const newMessages = [...chat.messages];
                const lastMsg = newMessages[newMessages.length - 1];
                lastMsg.isError = true;
                lastMsg.text = "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu này.";
                return { ...chat, messages: newMessages };
            })
        );
    } finally {
        setIsLoading(false);
    }
  }, [activeChatId, chatSessions, mode, isLoading, currentUser]);

  const handleLogout = () => {
      localStorage.removeItem('kl-ai-token');
      setCurrentUser(null);
      setChatSessions([]);
      setActiveChatId(null);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (chatSessions.length <= 1) {
          handleNewChat();
      }
      setChatSessions(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) {
          const remaining = chatSessions.filter(c => c.id !== chatId);
          if (remaining.length > 0) setActiveChatId(remaining[0].id);
      }
  };
  
  const togglePin = (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setChatSessions(prev => prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c));
  };
  
  const handleUpdateUser = async (updates: Partial<User>) => {
      if (!currentUser) return false;
      try {
          const updated = { ...currentUser, ...updates };
          setCurrentUser(updated);
          
          if (updates.aiRole || updates.aiTone) {
               const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
               const systemInstruction = getSystemInstruction(updated.aiRole, updated.aiTone);
               chatSessions.forEach(session => {
                   const chatHistory = session.messages
                       .filter(m => m.text)
                       .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
                    chatInstances.current[session.id] = ai.chats.create({
                        model: 'gemini-3-pro-preview',
                        config: { systemInstruction },
                        history: chatHistory.slice(1),
                    });
               });
          }
          return true;
      } catch (e) {
          console.error(e);
          return false;
      }
  };

  if (isAuthenticating) {
      return <div className="h-screen w-screen flex items-center justify-center bg-background text-text-primary"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div></div>;
  }

  if (!currentUser) {
      return <Auth onAuthSuccess={(user, token) => { setCurrentUser(user); localStorage.setItem('kl-ai-token', token); }} />;
  }

  const activeChat = chatSessions.find(c => c.id === activeChatId);
  const pinnedChats = chatSessions.filter(c => c.isPinned);
  const recentChats = chatSessions.filter(c => !c.isPinned).filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderSidebar = () => (
      <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-bold shadow-lg">
                      {currentUser.avatar || <KlAiLogo className="w-5 h-5 text-white" />}
                  </div>
                  <span className="font-semibold truncate max-w-[120px]">{currentUser.username}</span>
              </div>
              <div className="flex items-center gap-1">
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-sidebar rounded-lg transition-colors text-text-secondary hover:text-text-primary">
                      <SettingsIcon className="w-5 h-5" />
                  </button>
                  <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-text-secondary hover:text-red-500">
                      <LogoutIcon className="w-5 h-5" />
                  </button>
              </div>
          </div>
          
          <div className="p-3">
              <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-white p-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
                  <NewChatIcon className="w-5 h-5" />
                  <span className="font-medium">Cuộc trò chuyện mới</span>
              </button>
          </div>

          <div className="px-3 mb-2">
              <div className="relative">
                  <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input 
                      type="text" 
                      placeholder="Tìm kiếm..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-sidebar border border-transparent focus:border-brand rounded-lg py-2 pl-9 pr-3 text-sm outline-none transition-all"
                  />
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {pinnedChats.length > 0 && (
                  <div>
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">Đã ghim</h3>
                      <div className="space-y-1">
                          {pinnedChats.map(chat => (
                              <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setIsMobileSidebarOpen(false); }} className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-card shadow-sm border border-border' : 'hover:bg-sidebar border border-transparent'}`}>
                                  <div className={`w-1 h-full absolute left-0 top-0 rounded-l-xl bg-brand transition-opacity ${activeChatId === chat.id ? 'opacity-100' : 'opacity-0'}`}></div>
                                  <PinIcon className="w-4 h-4 text-brand flex-shrink-0" />
                                  <span className="truncate text-sm font-medium flex-1">{chat.title}</span>
                                  <button onClick={(e) => togglePin(chat.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded transition-opacity"><PinIcon className="w-3 h-3 fill-current" /></button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              
              <div>
                   <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">Gần đây</h3>
                   <div className="space-y-1">
                      {recentChats.map(chat => (
                          <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setIsMobileSidebarOpen(false); }} className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-card shadow-sm border border-border' : 'hover:bg-sidebar border border-transparent'}`}>
                              <div className={`w-1 h-full absolute left-0 top-0 rounded-l-xl bg-brand transition-opacity ${activeChatId === chat.id ? 'opacity-100' : 'opacity-0'}`}></div>
                              <span className="truncate text-sm font-medium flex-1 pl-2">{chat.title}</span>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                  <button onClick={(e) => togglePin(chat.id, e)} className="p-1.5 hover:bg-background rounded text-text-secondary hover:text-brand"><PinIcon className="w-3.5 h-3.5" /></button>
                                  <button onClick={(e) => handleDeleteChat(chat.id, e)} className="p-1.5 hover:bg-background rounded text-text-secondary hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                              </div>
                          </div>
                      ))}
                   </div>
              </div>
          </div>
      </div>
  );

  const renderFeatureButton = (icon: React.ReactNode, label: string, value: Mode, colorClass: string) => (
      <button
          onClick={() => { setMode(value); setIsFeaturesPopoverOpen(false); }}
          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all ${mode === value ? 'bg-brand/10 border-brand' : 'hover:bg-sidebar border-transparent'} border`}
      >
          <div className={`p-2 rounded-lg ${colorClass} text-white`}>{icon}</div>
          <span className="text-xs font-medium text-center leading-tight">{label}</span>
      </button>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:block w-72 bg-sidebar/50 border-r border-border backdrop-blur-xl flex-shrink-0 transition-all duration-300">
         {renderSidebar()}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <div className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileSidebarOpen(false)} />
      <aside className={`fixed inset-y-0 left-0 w-3/4 max-w-xs bg-sidebar shadow-2xl z-50 md:hidden transform transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         {renderSidebar()}
      </aside>

      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-md z-10 sticky top-0">
            <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={() => setIsMobileSidebarOpen(true)} className="md:hidden p-2 hover:bg-sidebar rounded-lg">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                    <h1 className="font-bold text-lg truncate">{activeChat?.title || 'KL AI'}</h1>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                        {isLoading ? 'Đang trả lời...' : 'Sẵn sàng'}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsCalculatorOpen(!isCalculatorOpen)} className={`p-2 rounded-lg transition-colors ${isCalculatorOpen ? 'bg-brand text-white' : 'hover:bg-sidebar text-text-secondary'}`} title="Máy tính">
                    <CalculatorIcon className="w-5 h-5" />
                </button>
                 <button onClick={() => setIsPeriodicTableOpen(!isPeriodicTableOpen)} className={`p-2 rounded-lg transition-colors ${isPeriodicTableOpen ? 'bg-brand text-white' : 'hover:bg-sidebar text-text-secondary'}`} title="Bảng tuần hoàn">
                    <PeriodicTableIcon className="w-5 h-5" />
                </button>
            </div>
        </header>

        {/* Messages Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth relative">
             {activeChat?.messages.map((msg, idx) => (
                 <ChatMessage 
                    key={idx} 
                    message={msg} 
                    isLastMessage={idx === activeChat.messages.length - 1} 
                    isLoading={isLoading}
                    onFollowUpClick={(text, action) => handleSendMessage(`Hãy ${action === 'explain' ? 'giải thích thêm' : action === 'example' ? 'cho ví dụ' : 'tóm tắt'} về: "${text.substring(0, 50)}..."`)}
                    onApplySchedule={(text) => alert("Tính năng tạo lịch đang phát triển!")}
                    onOpenFlashcards={(cards) => setFlashcardData(cards)}
                    onOpenMindMap={(data) => setMindMapModalData(data)}
                    onAskSelection={(text) => handleSendMessage(`Giải thích giúp tôi đoạn này: "${text}"`)}
                    userAvatar={currentUser.avatar}
                 />
             ))}
             {isLoading && activeChat?.messages[activeChat.messages.length - 1].role === 'user' && <TypingIndicator />}
             <div className="h-4"></div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card/80 backdrop-blur-md border-t border-border z-20">
             <div className="max-w-3xl mx-auto relative">
                  <div className="relative">
                      {isFeaturesPopoverOpen && (
                          <div 
                            ref={featuresPopoverRef}
                            className="absolute bottom-full left-0 mb-3 w-72 max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl p-3 grid grid-cols-2 gap-2 z-[100] animate-slide-in-up scrollbar-thin scrollbar-thumb-border"
                          >
                             {renderFeatureButton(<CreateExamIcon className="w-6 h-6"/>, "Tạo đề thi", 'create_exam', "bg-blue-500")}
                             {renderFeatureButton(<SolveExamIcon className="w-6 h-6"/>, "Giải đề", 'solve_exam', "bg-green-500")}
                             {renderFeatureButton(<CreateScheduleIcon className="w-6 h-6"/>, "Lập kế hoạch", 'create_schedule', "bg-purple-500")}
                             {renderFeatureButton(<MindMapIcon className="w-6 h-6"/>, "Sơ đồ tư duy", 'mind_map', "bg-orange-500")}
                             {renderFeatureButton(<FlashcardIcon className="w-6 h-6"/>, "Flashcard", 'flashcard', "bg-pink-500")}
                             {renderFeatureButton(<CreateFileIcon className="w-6 h-6"/>, "Tạo tài liệu", 'create_file', "bg-indigo-500")}
                             {renderFeatureButton(<LearnModeIcon className="w-6 h-6"/>, "Chế độ Học", 'learn', "bg-teal-500")}
                             {renderFeatureButton(<ExamModeIcon className="w-6 h-6"/>, "Chế độ Thi", 'exam', "bg-red-500")}
                             {renderFeatureButton(<TheoryModeIcon className="w-6 h-6"/>, "Lý thuyết", 'theory', "bg-yellow-500")}
                             {renderFeatureButton(<ShuffleIcon className="w-6 h-6"/>, "Trộn đề", 'scramble_exam', "bg-cyan-500")}
                             {renderFeatureButton(<CloneIcon className="w-6 h-6"/>, "Đề tương tự", 'similar_exam', "bg-violet-500")}
                          </div>
                      )}
                      
                      <ChatInput 
                          onSendMessage={handleSendMessage} 
                          isLoading={isLoading} 
                          placeholder={mode === 'chat' ? "Nhập tin nhắn..." : `Nhập nội dung để ${mode === 'create_exam' ? 'tạo đề' : mode === 'solve_exam' ? 'giải đề' : 'xử lý'}...`}
                          onExtractText={handleExtractText}
                          featuresButton={
                              <div ref={featuresButtonRef} onClick={() => setIsFeaturesPopoverOpen(!isFeaturesPopoverOpen)} className={`cursor-pointer p-2.5 rounded-full hover:bg-sidebar transition-colors active:scale-95 ${isFeaturesPopoverOpen ? 'bg-brand/10 text-brand' : 'text-text-secondary'}`}>
                                  <MoreHorizontalIcon className="w-5 h-5" />
                              </div>
                          }
                      />
                  </div>
                  <p className="text-center text-[10px] text-text-secondary mt-2">KL AI có thể mắc lỗi. Hãy kiểm chứng thông tin quan trọng.</p>
             </div>
        </div>
      </main>

      {/* Modals */}
      {isSettingsOpen && <SettingsModal user={currentUser} onClose={() => setIsSettingsOpen(false)} onUpdateUser={handleUpdateUser} />}
      {flashcardData && <FlashcardView cards={flashcardData} onClose={() => setFlashcardData(null)} />}
      {mindMapModalData && <MindMapModal data={mindMapModalData} onClose={() => setMindMapModalData(null)} onCreateNewMindMap={(data) => handleSendMessage("Tạo sơ đồ tư duy từ dữ liệu này", []) /* Placeholder logic */} />}
      
      {isCalculatorOpen && (
          <ToolModal title="Máy tính khoa học" onClose={() => setIsCalculatorOpen(false)}>
              <Calculator />
          </ToolModal>
      )}
      {isPeriodicTableOpen && (
          <ToolModal title="Bảng tuần hoàn" onClose={() => setIsPeriodicTableOpen(false)} initialSize={{width: 800, height: 600}}>
              <PeriodicTable />
          </ToolModal>
      )}
    </div>
  );
};

export default App;
