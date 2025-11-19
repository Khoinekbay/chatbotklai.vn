
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { type Message, type ChatSession, type User, type MindMapNode, type Mode, type FollowUpAction } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { CreateExamIcon, SolveExamIcon, CreateScheduleIcon, NewChatIcon, KlAiLogo, UserIcon, LogoutIcon, EditIcon, SearchIcon, PinIcon, LearnModeIcon, ExamModeIcon, DownloadIcon, SunIcon, MoonIcon, TheoryModeIcon, MenuIcon, FeaturesIcon, FlashcardIcon, ShuffleIcon, CloneIcon, CalculatorIcon, PeriodicTableIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CreateFileIcon, MindMapIcon, TrashIcon, SettingsIcon, MoreHorizontalIcon, KeyIcon } from './Icons';

// Lazy load heavy components
const SettingsModal = React.lazy(() => import('./SettingsModal'));
const FlashcardView = React.lazy(() => import('./FlashcardView'));
const Calculator = React.lazy(() => import('./Calculator'));
const PeriodicTable = React.lazy(() => import('./PeriodicTable'));
const ToolModal = React.lazy(() => import('./ToolModal'));
const MindMapModal = React.lazy(() => import('./MindMapModal'));


const DEMO_MESSAGE_LIMIT = 10;
// Use Gemini 2.5 Flash for robust performance and stability on Vercel
const MODEL_NAME = 'gemini-2.5-flash';

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

    const basePrompt = 'Bạn là KL AI, một trợ lý AI được thiết kế đặc biệt cho giáo viên và học sinh Việt Nam. Các câu trả lời của bạn phải bằng tiếng Việt. Sử dụng markdown để định dạng khi thích hợp, bao gồm cả công thức toán học LaTeX (sử dụng $...$ cho inline và $$...$$ cho block). Để vẽ đồ thị hàm số, hãy sử dụng khối mã "graph". Ví dụ:\n```graph\nf(x) = x^2\ny = sin(x)\n```\nĐể tạo bảng biến thiên, TUYỆT ĐỐI phải sử dụng khối mã `bbt`. Ví dụ:\n```bbt\n| x | -∞ | 1 | +∞ |\n|---|---|---|---|\n| y\'| | + | 0 | - |\n| y | | ↗ | 2 | ↘ |\n```\nNếu không dùng `bbt`, bảng sẽ bị lỗi. Để tạo bảng xét dấu, hãy sử dụng khối mã `bsd`. Ví dụ:\n```bsd\n| x | -∞ | 2 | +∞ |\n|---|---|---|---|\n| f(x) | - | 0 | + |\n```';

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

// Helper to convert MindMapNode back to text for history context
const mindMapToMarkdown = (node: MindMapNode, depth = 0): string => {
    const indent = '  '.repeat(depth);
    let result = `${indent}- ${node.name}\n`;
    if (node.children) {
        result += node.children.map(child => mindMapToMarkdown(child, depth + 1)).join('');
    }
    return result;
};

// Helper to convert Message format to Gemini Content format
const mapMessageToHistory = (m: Message) => {
   const parts: any[] = [];
   if (m.text) parts.push({ text: m.text });
   
   // If there's mind map data but no explicit text description of it in the message body,
   // append it as a text part so the model knows the context.
   if (m.mindMapData) {
       const mindMapText = `\n[Context: Mind Map Data]\n${mindMapToMarkdown(m.mindMapData)}`;
       parts.push({ text: mindMapText });
   }

   if (m.files) {
       m.files.forEach(file => {
           if (file.mimeType.startsWith('image/')) {
               const base64Data = file.dataUrl.split(',')[1];
               parts.push({
                   inlineData: {
                       mimeType: file.mimeType,
                       data: base64Data
                   }
               });
           }
       });
   }
   // Filter out empty parts (e.g. messages with just mode change but no text/files)
   if (parts.length === 0) return null;
   
   return {
       role: m.role,
       parts: parts
   };
};

interface ChatInterfaceProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: Partial<User>) => void | Promise<void>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, onLogout, onUpdateUser }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isFeaturesPopoverOpen, setIsFeaturesPopoverOpen] = useState(false);
  const [flashcardData, setFlashcardData] = useState<{ term: string; definition: string }[] | null>(null);
  // Stores both the data and the index of the message it belongs to
  const [mindMapModalState, setMindMapModalState] = useState<{ data: MindMapNode, messageIndex: number } | null>(null);
  
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPeriodicTableOpen, setIsPeriodicTableOpen] = useState(false);
  const [demoMessageCount, setDemoMessageCount] = useState(0);
  const [showDemoLimitModal, setShowDemoLimitModal] = useState(false);


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

  // Restore demo count from localStorage
  useEffect(() => {
    if (currentUser?.isDemo) {
        const savedCount = localStorage.getItem('kl-ai-demo-count');
        if (savedCount) {
            setDemoMessageCount(parseInt(savedCount, 10));
        }
    }
  }, [currentUser]);

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
    const defaultFont = "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
    document.body.style.fontFamily = currentUser?.fontPreference || defaultFont;
  }, [currentUser?.fontPreference]);

  // --- Chat Persistence Logic ---
  const CHATS_STORAGE_KEY = `kl-ai-chats-${currentUser.username}`;

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
    
    console.log("Initializing New Chat with Model:", MODEL_NAME);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const systemInstruction = getSystemInstruction(currentUser?.aiRole, currentUser?.aiTone);
    chatInstances.current[newChat.id] = ai.chats.create({
        model: MODEL_NAME,
        config: { systemInstruction },
    });
  }, [currentUser]);

  // Load chats from localStorage
  useEffect(() => {
    if (!currentUser) return;
    const loadChats = async () => {
        try {
            const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
            if (savedChats) {
                const parsedChats: ChatSession[] = JSON.parse(savedChats);
                if (parsedChats.length > 0) {
                    setChatSessions(parsedChats);
                    const lastActive = parsedChats.find(p => !p.isPinned) || parsedChats[0];
                    setActiveChatId(lastActive.id);
                    return;
                }
            }
            // Only create new chat if no saved chats
            handleNewChat();
        } catch (e) {
            console.error("Không thể tải lịch sử chat", e);
            handleNewChat();
        }
    };
    loadChats();
  }, [currentUser.username]); // Reload if user changes (though App unmounts on logout)

  // Save chats to localStorage on change
  useEffect(() => {
      if (currentUser && chatSessions.length > 0) {
          try {
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chatSessions));
          } catch (error) {
            console.error("Lỗi lưu lịch sử chat (có thể do bộ nhớ đầy):", error);
          }
      }
  }, [chatSessions, currentUser.username]);


  
  useEffect(() => {
    if (!currentUser) return;
    // Check API Key existence for debugging
    if (!process.env.API_KEY) {
        console.error("Warning: API_KEY is missing from environment variables!");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const systemInstruction = getSystemInstruction(currentUser?.aiRole, currentUser?.aiTone);
    
    // Only initialize instances for sessions that don't have one or need update
    chatSessions.forEach(session => {
        if (!chatInstances.current[session.id]) {
            const chatHistory = session.messages
                .map(mapMessageToHistory)
                .filter((content): content is { role: string; parts: any[] } => content !== null);

            // Remove the welcome message (first message) from history sent to API
            // Assuming the first message is always the welcome message from model
            const historyWithoutWelcome = chatHistory.length > 0 && chatHistory[0].role === 'model' 
                ? chatHistory.slice(1) 
                : chatHistory;

            chatInstances.current[session.id] = ai.chats.create({
                model: MODEL_NAME,
                config: { systemInstruction },
                history: historyWithoutWelcome,
            });
        }
    });
  }, [chatSessions, currentUser]);

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


  const handleExtractText = useCallback(async (file: { data: string; mimeType: string }) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
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
    if (!activeChatId || isLoading || !currentUser) return;
    
    // Demo Limit Check
    if (currentUser.isDemo) {
        if (demoMessageCount >= DEMO_MESSAGE_LIMIT) {
            setShowDemoLimitModal(true);
            return;
        }
        setDemoMessageCount(prev => {
            const newCount = prev + 1;
            localStorage.setItem('kl-ai-demo-count', newCount.toString());
            return newCount;
        });
    }

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
                ? { ...chat, messages: [...chat.messages, userMessage, { role: 'model', text: '', timestamp: new Date().toISOString(), mode: mode }] }
                : chat
        )
    );
    setIsLoading(true);
    setError(null);
    setFlashcardData(null);

    const generateTitleIfNeeded = async (promptText: string) => {
        const activeChat = chatSessions.find(c => c.id === activeChatId);
        // Check for 0 existing user messages before this one was added
        const isFirstUserMessage = activeChat ? activeChat.messages.filter(m => m.role === 'user').length === 0 : false;

        if (isFirstUserMessage && promptText) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            try {
                const titleGenPrompt = `Dựa vào yêu cầu đầu tiên này: "${promptText}", hãy tạo một tiêu đề ngắn gọn (tối đa 5 từ) bằng tiếng Việt cho cuộc trò chuyện. Nếu có tệp đính kèm, hãy mô tả ngắn gọn mục đích. Chỉ trả về tiêu đề, không thêm bất kỳ lời giải thích hay định dạng nào.`;
                const titleResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: titleGenPrompt });
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
        
        const parts: any[] = [{ text }];
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
                        // Correctly copy the object before mutation to avoid React issues
                        const lastMsg = { ...newMessages[newMessages.length - 1] };
                        if (lastMsg.role === 'model') {
                            lastMsg.text = fullText;
                        }
                        newMessages[newMessages.length - 1] = lastMsg;
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
                    const lastMsg = { ...newMessages[newMessages.length - 1] };
                    lastMsg.flashcards = flashcardData.cards;
                    newMessages[newMessages.length - 1] = lastMsg;
                    return { ...chat, messages: newMessages };
                })
            );
        }
        
        // Only parse Mind Map if we are in mind map mode
        if (mode === 'mind_map') {
            const mindMapData = parseMindMapFromResponse(fullText);
            if (mindMapData.data) {
                 setChatSessions(prev => 
                    prev.map(chat => {
                        if (chat.id !== activeChatId) return chat;
                        const newMessages = [...chat.messages];
                        const lastMsg = { ...newMessages[newMessages.length - 1] };
                        lastMsg.mindMapData = mindMapData.data!;
                        newMessages[newMessages.length - 1] = lastMsg;
                        return { ...chat, messages: newMessages };
                    })
                );
            }
        }

    } catch (error: any) {
        console.error("Error sending message:", error);
        // Log detailed error if available to help user troubleshoot
        if (error.message) console.error("Detail:", error.message);

        setError("Đã có lỗi xảy ra khi gửi tin nhắn. (Kiểm tra API Key của bạn)");
        setChatSessions(prev => 
            prev.map(chat => {
                if (chat.id !== activeChatId) return chat;
                const newMessages = [...chat.messages];
                const lastMsg = { ...newMessages[newMessages.length - 1] };
                lastMsg.isError = true;
                lastMsg.text = "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu này. Vui lòng thử lại hoặc kiểm tra kết nối.";
                newMessages[newMessages.length - 1] = lastMsg;
                return { ...chat, messages: newMessages };
            })
        );
    } finally {
        setIsLoading(false);
    }
  }, [activeChatId, chatSessions, mode, isLoading, currentUser, demoMessageCount]);


  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSessions = chatSessions.filter(c => c.id !== chatId);
      setChatSessions(newSessions);
      
      // Update localStorage immediately after delete
      if (newSessions.length > 0) {
          localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(newSessions));
      } else {
          localStorage.removeItem(CHATS_STORAGE_KEY);
          handleNewChat();
      }

      if (activeChatId === chatId) {
          if (newSessions.length > 0) setActiveChatId(newSessions[0].id);
      }
  };
  
  const togglePin = (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setChatSessions(prev => prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c));
  };
  
  const handleUpdateUserInternal = async (updates: Partial<User>) => {
      if (!currentUser) return false;
      try {
          await onUpdateUser(updates);
          
          if (updates.aiRole || updates.aiTone) {
               const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
               const systemInstruction = getSystemInstruction(updates.aiRole || currentUser.aiRole, updates.aiTone || currentUser.aiTone);
               
               // Re-initialize all chats with new persona
               chatSessions.forEach(session => {
                   const chatHistory = session.messages
                       .map(mapMessageToHistory)
                       .filter((content): content is { role: string; parts: any[] } => content !== null);
                    
                    const historyWithoutWelcome = chatHistory.length > 0 && chatHistory[0].role === 'model'
                        ? chatHistory.slice(1)
                        : chatHistory;

                    chatInstances.current[session.id] = ai.chats.create({
                        model: MODEL_NAME,
                        config: { systemInstruction },
                        history: historyWithoutWelcome,
                    });
               });
          }
          return true;
      } catch (e) {
          console.error(e);
          return false;
      }
  };
  
  const handleSaveMindMap = (newData: MindMapNode) => {
    if (!mindMapModalState || !activeChatId) return;
    
    // Invalidate chat instance to force re-sync of context with the updated mind map data
    if (chatInstances.current[activeChatId]) {
        delete chatInstances.current[activeChatId];
    }

    setChatSessions(prev => 
        prev.map(chat => {
            if (chat.id !== activeChatId) return chat;
            const newMessages = [...chat.messages];
            const targetMsgIndex = mindMapModalState.messageIndex;
            
            if (targetMsgIndex >= 0 && targetMsgIndex < newMessages.length) {
                 const updatedMsg = { ...newMessages[targetMsgIndex] };
                 updatedMsg.mindMapData = newData;
                 newMessages[targetMsgIndex] = updatedMsg;
                 return { ...chat, messages: newMessages };
            }
            return chat;
        })
    );
    // Update local state so the modal reflects changes without closing
    setMindMapModalState(prev => prev ? { ...prev, data: newData } : null);
  };

  const handleCreateNewMindMap = (newData: MindMapNode) => {
    if (!activeChatId) return;
    
    // Invalidate chat instance to force re-sync of context with the new mind map messages
    if (chatInstances.current[activeChatId]) {
        delete chatInstances.current[activeChatId];
    }

    setChatSessions(prev => 
        prev.map(chat => {
            if (chat.id !== activeChatId) return chat;
            
            // We create a synthetic User message and then a Model message
            // This ensures the chat history maintains User -> Model alternation
            const userMsg: Message = {
                role: 'user',
                text: `Tách nhánh "${newData.name}" thành sơ đồ mới.`,
                timestamp: new Date().toISOString(),
                mode: 'mind_map'
            };

            const modelMsg: Message = {
                role: 'model',
                text: 'Sơ đồ tư duy đã được tách thành công:',
                mindMapData: newData,
                mode: 'mind_map',
                timestamp: new Date().toISOString()
            };
            
            return { ...chat, messages: [...chat.messages, userMsg, modelMsg] };
        })
    );
    setMindMapModalState(null);
  };

  const handleOpenSettings = () => {
      if (currentUser?.isDemo) {
          alert("Tính năng cài đặt không khả dụng cho tài khoản Demo. Vui lòng đăng ký để tùy chỉnh cá nhân hóa.");
          return;
      }
      setIsSettingsOpen(true);
  };

  const activeChat = chatSessions.find(c => c.id === activeChatId);
  const pinnedChats = chatSessions.filter(c => c.isPinned);
  const recentChats = chatSessions.filter(c => !c.isPinned).filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderSidebar = () => (
      <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-bold shadow-lg overflow-hidden">
                        {currentUser.avatar && currentUser.avatar.startsWith('data:') ? (
                            <img src={currentUser.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                        ) : (
                            currentUser.avatar || <KlAiLogo className="w-5 h-5 text-white" />
                        )}
                  </div>
                  <div className="flex flex-col">
                      <span className="font-semibold truncate max-w-[120px]">{currentUser.username}</span>
                      <span className="text-xs text-text-secondary capitalize">{currentUser.aiRole === 'assistant' ? 'Trợ lý AI' : currentUser.aiRole === 'teacher' ? 'Giáo viên AI' : 'Bạn học AI'}</span>
                  </div>
              </div>
               <button onClick={handleOpenSettings} className="p-2 rounded-full hover:bg-card-hover transition-colors text-text-secondary hover:text-text-primary">
                  <SettingsIcon className="w-5 h-5" />
              </button>
          </div>

          <div className="p-3">
              <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-brand text-white rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 active:scale-[0.98] group"
              >
                  <NewChatIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
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
                      className="w-full pl-9 pr-4 py-2 bg-input-bg rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 border border-transparent focus:border-brand transition-all"
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {pinnedChats.length > 0 && (
                  <div>
                      <h3 className="text-xs font-semibold text-text-secondary mb-2 px-2 uppercase tracking-wider">Đã ghim</h3>
                      <div className="space-y-1">
                          {pinnedChats.map(chat => (
                              <div 
                                  key={chat.id}
                                  onClick={() => { setActiveChatId(chat.id); setIsMobileSidebarOpen(false); }}
                                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-card-hover border border-border shadow-sm' : 'hover:bg-sidebar border border-transparent'}`}
                              >
                                  <div className="w-1 h-1 rounded-full bg-brand flex-shrink-0"></div>
                                  <span className="flex-1 truncate text-sm font-medium">{chat.title}</span>
                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                       <button onClick={(e) => togglePin(chat.id, e)} className="p-1 hover:bg-input-bg rounded" title="Bỏ ghim">
                                          <PinIcon className="w-3 h-3 fill-current text-brand" />
                                      </button>
                                      <button onClick={(e) => handleDeleteChat(chat.id, e)} className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded" title="Xóa">
                                          <TrashIcon className="w-3 h-3" />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              
              <div>
                  <h3 className="text-xs font-semibold text-text-secondary mb-2 px-2 uppercase tracking-wider">Gần đây</h3>
                  <div className="space-y-1">
                       {recentChats.map(chat => (
                          <div 
                              key={chat.id}
                              onClick={() => { setActiveChatId(chat.id); setIsMobileSidebarOpen(false); }}
                              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-card-hover border border-border shadow-sm' : 'hover:bg-sidebar border border-transparent'}`}
                          >
                              <span className="flex-1 truncate text-sm text-text-secondary group-hover:text-text-primary transition-colors">{chat.title}</span>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                   <button onClick={(e) => togglePin(chat.id, e)} className="p-1 hover:bg-input-bg rounded" title="Ghim">
                                      <PinIcon className="w-3 h-3 text-text-secondary hover:text-brand" />
                                  </button>
                                  <button onClick={(e) => handleDeleteChat(chat.id, e)} className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded" title="Xóa">
                                      <TrashIcon className="w-3 h-3" />
                                  </button>
                              </div>
                          </div>
                      ))}
                      {recentChats.length === 0 && (
                          <p className="text-xs text-text-secondary text-center py-4 italic">Không tìm thấy đoạn chat nào</p>
                      )}
                  </div>
              </div>
          </div>

          <div className="p-4 border-t border-border/50">
              <button 
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                  <LogoutIcon className="w-4 h-4" />
                  <span>Đăng xuất</span>
              </button>
          </div>
      </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary font-sans selection:bg-brand/20 selection:text-brand">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:block w-72 lg:w-80 flex-shrink-0 bg-sidebar/50 backdrop-blur-md border-r border-border transition-all duration-300">
        {renderSidebar()}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-3/4 max-w-xs bg-card shadow-2xl transform transition-transform duration-300 ease-out">
            {renderSidebar()}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-md z-10 sticky top-0">
            <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={() => setIsMobileSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-sidebar text-text-secondary">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div className="flex flex-col min-w-0">
                    <h1 className="font-bold text-lg truncate flex items-center gap-2">
                         {activeChat?.title || 'KL AI Chat'}
                         {activeChat?.isPinned && <PinIcon className="w-3 h-3 text-brand fill-current" />}
                    </h1>
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                         <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
                         <span>{isLoading ? 'Đang trả lời...' : 'Sẵn sàng'}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
                 {/* Tools Buttons */}
                 <button onClick={() => setIsCalculatorOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Máy tính">
                     <CalculatorIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setIsPeriodicTableOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Bảng tuần hoàn">
                     <PeriodicTableIcon className="w-5 h-5" />
                 </button>
                 
                 <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block"></div>

                 {/* Features Dropdown */}
                 <div className="relative" ref={featuresPopoverRef}>
                      <button 
                        ref={featuresButtonRef}
                        onClick={() => setIsFeaturesPopoverOpen(!isFeaturesPopoverOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isFeaturesPopoverOpen ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-sidebar'}`}
                      >
                          <FeaturesIcon className="w-5 h-5" />
                          <span className="hidden sm:inline text-sm font-medium">Chế độ</span>
                      </button>
                      
                      {isFeaturesPopoverOpen && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl p-1.5 z-50 animate-slide-in-up origin-top-right">
                              {[
                                  { id: 'chat', label: 'Trò chuyện', icon: <UserIcon className="w-4 h-4" /> },
                                  { id: 'create_exam', label: 'Tạo đề thi', icon: <CreateExamIcon className="w-4 h-4" /> },
                                  { id: 'solve_exam', label: 'Giải đề', icon: <SolveExamIcon className="w-4 h-4" /> },
                                  { id: 'create_schedule', label: 'Lập lịch học', icon: <CreateScheduleIcon className="w-4 h-4" /> },
                                  { id: 'learn', label: 'Học tập', icon: <LearnModeIcon className="w-4 h-4" /> },
                                  { id: 'exam', label: 'Thi thử', icon: <ExamModeIcon className="w-4 h-4" /> },
                                  { id: 'theory', label: 'Lý thuyết', icon: <TheoryModeIcon className="w-4 h-4" /> },
                                  { id: 'flashcard', label: 'Flashcard', icon: <FlashcardIcon className="w-4 h-4" /> },
                                  { id: 'mind_map', label: 'Sơ đồ tư duy', icon: <MindMapIcon className="w-4 h-4" /> },
                                  { id: 'scramble_exam', label: 'Trộn đề', icon: <ShuffleIcon className="w-4 h-4" /> },
                                  { id: 'similar_exam', label: 'Đề tương tự', icon: <CloneIcon className="w-4 h-4" /> },
                                  { id: 'create_file', label: 'Tạo file', icon: <CreateFileIcon className="w-4 h-4" /> },
                              ].map((m) => (
                                  <button
                                      key={m.id}
                                      onClick={() => { setMode(m.id as Mode); setIsFeaturesPopoverOpen(false); }}
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${mode === m.id ? 'bg-brand text-white shadow-md' : 'text-text-secondary hover:bg-sidebar hover:text-text-primary'}`}
                                  >
                                      {m.icon}
                                      {m.label}
                                  </button>
                              ))}
                          </div>
                      )}
                 </div>
            </div>
        </header>

        {/* Messages List */}
        <div 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
        >
            <div className="max-w-3xl mx-auto space-y-6">
                {activeChat?.messages.map((msg, idx) => (
                    <ChatMessage 
                        key={idx} 
                        message={msg} 
                        isLastMessage={idx === activeChat.messages.length - 1}
                        isLoading={isLoading}
                        onFollowUpClick={(originalText, action) => {
                            let prompt = '';
                            switch(action) {
                                case 'explain': prompt = `Giải thích chi tiết hơn về: "${originalText.substring(0, 100)}..."`; break;
                                case 'example': prompt = `Cho ví dụ minh họa về: "${originalText.substring(0, 100)}..."`; break;
                                case 'summarize': prompt = `Tóm tắt ngắn gọn nội dung: "${originalText.substring(0, 100)}..."`; break;
                            }
                            handleSendMessage(prompt);
                        }}
                        onApplySchedule={(scheduleText) => {
                            alert("Tính năng thêm lịch vào Google Calendar đang được phát triển!");
                        }}
                        onOpenFlashcards={(cards) => setFlashcardData(cards)}
                        onOpenMindMap={(data) => setMindMapModalState({ data, messageIndex: idx })}
                        onAskSelection={(text) => handleSendMessage(`Giải thích giúp tôi đoạn này: "${text}"`)}
                        onRegenerate={idx === activeChat.messages.length - 1 && msg.role === 'model' ? () => {
                            // Remove last model message and re-send last user message
                             const lastUserMsgIndex = activeChat.messages.length - 2;
                             if (lastUserMsgIndex >= 0) {
                                 const lastUserMsg = activeChat.messages[lastUserMsgIndex];
                                 setChatSessions(prev => prev.map(c => {
                                     if (c.id !== activeChatId) return c;
                                     return { ...c, messages: c.messages.slice(0, -1) }; // Remove failed/old model msg
                                 }));
                                 // Trigger re-send (need to extract raw text/files from message structure)
                                 // Ideally refactor handleSendMessage to accept Message object, but for now:
                                 handleSendMessage(lastUserMsg.text, []); // Files re-upload logic omitted for brevity in this quick fix
                             }
                        } : undefined}
                        userAvatar={currentUser.avatar}
                    />
                ))}
                {isLoading && <TypingIndicator />}
                <div className="h-4" /> {/* Bottom spacer */}
            </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border z-20">
            <div className="max-w-3xl mx-auto">
                <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading}
                    placeholder={
                        mode === 'create_exam' ? "Nhập chủ đề, số lượng câu hỏi, độ khó..." :
                        mode === 'solve_exam' ? "Chụp ảnh hoặc dán nội dung đề bài..." :
                        mode === 'create_schedule' ? "Nhập mục tiêu, thời gian rảnh, môn học..." :
                        "Nhập nội dung để xử lý..."
                    }
                    onExtractText={handleExtractText}
                    featuresButton={
                        <button 
                            onClick={() => setIsFeaturesPopoverOpen(!isFeaturesPopoverOpen)}
                            className="md:hidden p-2.5 rounded-full text-text-secondary hover:bg-sidebar transition-colors"
                        >
                            <MoreHorizontalIcon className="w-5 h-5" />
                        </button>
                    }
                />
                <p className="text-xs text-center text-text-secondary mt-2 opacity-70">
                    KL AI có thể mắc lỗi. Hãy kiểm chứng thông tin quan trọng.
                </p>
            </div>
        </div>
      </main>

      {/* Modals */}
      <React.Suspense fallback={null}>
        {isSettingsOpen && (
            <SettingsModal 
                user={currentUser} 
                onClose={() => setIsSettingsOpen(false)} 
                onUpdateUser={handleUpdateUserInternal}
            />
        )}
        
        {flashcardData && (
            <FlashcardView 
                cards={flashcardData} 
                onClose={() => setFlashcardData(null)} 
            />
        )}
        
        {mindMapModalState && (
            <MindMapModal
                data={mindMapModalState.data}
                onClose={() => setMindMapModalState(null)}
                onCreateNewMindMap={handleCreateNewMindMap}
                onSave={handleSaveMindMap}
            />
        )}

        {isCalculatorOpen && (
            <ToolModal title="Máy tính khoa học" onClose={() => setIsCalculatorOpen(false)}>
                <Calculator />
            </ToolModal>
        )}

        {isPeriodicTableOpen && (
            <ToolModal title="Bảng tuần hoàn" onClose={() => setIsPeriodicTableOpen(false)} initialSize={{width: 800, height: 500}}>
                <PeriodicTable />
            </ToolModal>
        )}
        
        {/* Demo Limit Modal */}
        {showDemoLimitModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-message-pop-in">
                    <div className="flex justify-center mb-4">
                         <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center">
                            <KeyIcon className="w-8 h-8 text-brand" />
                         </div>
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">Hết lượt dùng thử miễn phí</h2>
                    <p className="text-center text-text-secondary mb-6">
                        Bạn đã sử dụng hết {DEMO_MESSAGE_LIMIT} tin nhắn miễn phí trong chế độ Khách. <br/>
                        Vui lòng đăng ký tài khoản để tiếp tục sử dụng không giới hạn và lưu lại lịch sử.
                    </p>
                    <div className="flex flex-col gap-3">
                         <button 
                            onClick={() => {
                                setShowDemoLimitModal(false);
                                onLogout(); // Go back to auth screen
                            }}
                            className="w-full py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                         >
                             Đăng ký ngay
                         </button>
                         <button 
                            onClick={() => setShowDemoLimitModal(false)}
                            className="w-full py-3 bg-sidebar hover:bg-card-hover text-text-primary font-semibold rounded-xl transition-colors"
                         >
                             Để sau
                         </button>
                    </div>
                </div>
            </div>
        )}
      </React.Suspense>
    </div>
  );
};

export default ChatInterface;
