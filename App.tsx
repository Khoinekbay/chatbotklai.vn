


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, Part, Modality } from '@google/genai';
import { type Message, type ChatSession, type User, type MindMapNode, type Mode } from './types';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import TypingIndicator from './components/TypingIndicator';
import { CreateExamIcon, SolveExamIcon, CreateScheduleIcon, NewChatIcon, KlAiLogo, UserIcon, LogoutIcon, EditIcon, SearchIcon, PinIcon, LearnModeIcon, ExamModeIcon, DownloadIcon, SunIcon, MoonIcon, TheoryModeIcon, MenuIcon, FeaturesIcon, FlashcardIcon, ShuffleIcon, CloneIcon, CalculatorIcon, PeriodicTableIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CreateFileIcon, MindMapIcon, TrashIcon } from './components/Icons';
import Auth from './components/Auth';
import SettingsModal from './components/SettingsModal';
import FlashcardView from './components/FlashcardView';
import Calculator from './components/Calculator';
import PeriodicTable from './components/PeriodicTable';
import ToolModal from './components/ToolModal';
import MindMapModal from './components/MindMapModal';

export type FollowUpAction = 'explain' | 'example' | 'summarize';

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
        // FIX: More robustly parse the name by removing the bullet point and trimming.
        const name = line.trim().replace(/^[-*]\s*/, '').trim();
        if (!name) return; // Skip lines that are just a bullet point

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
            // FIX: Collect all top-level nodes instead of overwriting a single root.
            topLevelNodes.push(newNode);
        }

        stack.push({ node: newNode, indent });
    });
    
    // FIX: Handle the collected top-level nodes.
    if (topLevelNodes.length === 1) {
        // If there's only one root node, use it directly.
        root = topLevelNodes[0];
    } else if (topLevelNodes.length > 1) {
        // If there are multiple root nodes, create a new parent node for them.
        // Use the last line of the intro as a plausible title, or a default.
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
  const featuresButtonRef = useRef<HTMLButtonElement>(null);
  const notificationTimeoutsRef = useRef<number[]>([]);
  
  // Theme management
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

  // Custom Background Management
  useEffect(() => {
    if (currentUser?.backgroundUrl) {
      document.body.style.backgroundImage = `url(${currentUser.backgroundUrl})`;
      document.body.classList.add('has-custom-bg');
    } else {
      document.body.style.backgroundImage = 'none';
      document.body.classList.remove('has-custom-bg');
    }
    // Cleanup function to remove styles when component unmounts or user changes
    return () => {
      document.body.style.backgroundImage = 'none';
      document.body.classList.remove('has-custom-bg');
    };
  }, [currentUser?.backgroundUrl]);

  // Check for logged in user on mount
  useEffect(() => {
    const verifyToken = async () => {
        const token = localStorage.getItem('kl-ai-token');
        if (token) {
            try {
                // Trong ứng dụng thật, đây sẽ là endpoint backend của bạn để xác thực token
                // const response = await fetch('/api/user/me', {
                //     headers: { 'Authorization': `Bearer ${token}` }
                // });
                // if (!response.ok) throw new Error('Token không hợp lệ');
                // const userData = await response.json();
                
                // ===================================================================
                // MOCK API CALL - Thay thế bằng API call thật đến backend của bạn
                // ===================================================================
                await new Promise(res => setTimeout(res, 500)); // Giả lập độ trễ mạng
                const mockUserData: User = { 
                    username: 'demo_user', 
                    password: '', // Client không bao giờ lưu mật khẩu
                    aiRole: 'assistant', 
                    aiTone: 'balanced',
                    theme: 'dark'
                };
                setCurrentUser(mockUserData);
                // ===================================================================

            } catch (error) {
                console.error("Xác thực token thất bại", error);
                handleLogout(); // Xóa token không hợp lệ
            }
        }
        setIsAuthenticating(false);
    };
    verifyToken();
  }, []);
  
  // Apply user's font preference
  useEffect(() => {
    const defaultFont = "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
    document.body.style.fontFamily = currentUser?.fontPreference || defaultFont;
  }, [currentUser?.fontPreference]);

  // Load chats from backend when user logs in
  useEffect(() => {
    if (!currentUser) return;
    const fetchChats = async () => {
        try {
            // const token = localStorage.getItem('kl-ai-token');
            // const response = await fetch('/api/chats', {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });
            // if (!response.ok) throw new Error('Failed to fetch chats');
            // const chats = await response.json();

            // ===================================================================
            // MOCK API CALL - Thay thế bằng API call thật đến backend của bạn
            // ===================================================================
            await new Promise(res => setTimeout(res, 500));
            const mockChats: ChatSession[] = []; // Bắt đầu không có chat để trải nghiệm sạch hơn
            // ===================================================================

            if (mockChats.length > 0) {
                setChatSessions(mockChats);
                const firstChat = mockChats.find(p => !p.isPinned) || mockChats[0];
                setActiveChatId(firstChat.id);
            } else {
                handleNewChat(); // Tự động tạo chat mới nếu không có chat nào
            }
        } catch (e) {
            console.error("Không thể tải các cuộc trò chuyện từ máy chủ", e);
            setError("Không thể tải các đoạn chat.");
        }
    };
    fetchChats();
  }, [currentUser]);

  
  // Initialize or re-initialize chat instances when sessions or user settings change
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
            model: 'gemini-2.5-flash',
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

  // Close features popover on outside click
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNewChat = useCallback(async () => {
    if (!currentUser) return;
    
    let newChat: ChatSession;
    try {
        // Trong ứng dụng thật, bạn sẽ gửi yêu cầu POST đến backend để tạo chat mới
        // const token = localStorage.getItem('kl-ai-token');
        // const response = await fetch('/api/chats', { 
        //    method: 'POST', 
        //    headers: { 'Authorization': `Bearer ${token}` } 
        // });
        // if (!response.ok) throw new Error('Failed to create chat');
        // newChat = await response.json();
    
        // ===================================================================
        // MOCK API CALL - Thay thế bằng API call thật đến backend của bạn
        // ===================================================================
        const newId = Date.now().toString();
        newChat = {
          id: newId,
          title: 'Đoạn chat mới',
          messages: [{ role: 'model', text: "Xin chào! Tôi là KL AI, trợ lý ảo của bạn. Tôi có thể giúp gì cho bạn hôm nay?" }],
          isPinned: false,
        };
        // ===================================================================
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
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
    });
  }, [currentUser]);

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
                const titleResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: titleGenPrompt });
                let newTitle = titleResponse.text.trim().replace(/^"|"$/g, '');
                if (newTitle) {
                    // Gửi tiêu đề mới này đến backend để lưu lại
                    // const token = localStorage.getItem('kl-ai-token');
                    // await fetch(`/api/chats/${activeChatId}`, { 
                    //    method: 'PATCH',
                    //    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    //    body: JSON.stringify({ title: newTitle }) 
                    // });
                    setChatSessions(prev =>
                        prev.map(chat => chat.id === activeChatId ? { ...chat, title: newTitle } : chat)
                    );
                }
            } catch (titleError) { console.error("Không thể tạo tiêu đề cho cuộc trò chuyện:", titleError); }
        }
    };
    
    const handleError = (e: any) => {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
        setError(`Không thể nhận phản hồi. ${errorMessage}`);
        
        const errorText = `**Rất tiếc, đã có lỗi xảy ra.**\n\nTôi không thể xử lý yêu cầu của bạn lúc này.\n\n**Bạn có thể thử:**\n- Kiểm tra lại kết nối mạng của bạn.\n- Gửi lại yêu cầu sau ít phút.\n- Nếu bạn đang tải tệp lên, hãy đảm bảo tệp không bị hỏng và có định dạng được hỗ trợ (ảnh, pdf, docx, txt).\n- Bắt đầu một cuộc trò chuyện mới để thử lại.\n\n*Nếu sự cố vẫn tiếp diễn, vui lòng liên hệ bộ phận hỗ trợ.*`;

        setChatSessions(prev =>
            prev.map(chat => {
                if (chat.id === activeChatId) {
                    const updatedMessages = [...chat.messages];
                    const lastMessage = updatedMessages[updatedMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        lastMessage.text = errorText;
                        lastMessage.isError = true;
                    }
                    return { ...chat, messages: updatedMessages };
                }
                return chat;
            })
        );
    };

    const activeChat = chatSessions.find(c => c.id === activeChatId);
    if (!activeChat) {
        setIsLoading(false);
        return;
    }
    
    let prompt = text;
    switch (mode) {
      case 'create_exam': prompt = `Với vai trò là một trợ lý cho giáo viên, hãy thực hiện yêu cầu sau: ${text}. Đối với mỗi câu hỏi trắc nghiệm, hãy đảm bảo các đáp án được trộn một cách ngẫu nhiên và chỉ có một đáp án đúng.`; break;
      case 'scramble_exam': prompt = `Với vai trò là một trợ lý cho giáo viên, hãy xáo trộn cả câu hỏi và các đáp án trắc nghiệm trong đề thi được cung cấp. Đề thi: ${text}`; break;
      case 'similar_exam': prompt = `Với vai trò là một trợ lý cho giáo viên, hãy tạo một đề thi tương tự (ví dụ: thay đổi số liệu, tình huống) dựa trên đề thi được cung cấp. Giữ nguyên cấu trúc và độ khó. Đề gốc: ${text}`; break;
      case 'solve_exam': prompt = `Với vai trò là một trợ lý cho học sinh, hãy giải và giải thích chi tiết đề bài sau: ${text}`; break;
      case 'create_schedule': prompt = `Với vai trò là một trợ lý lập kế hoạch, hãy tạo một lịch trình chi tiết và rõ ràng dựa trên yêu cầu sau. Luôn sử dụng định dạng bảng Markdown (với header) để trình bày lịch trình. Yêu cầu: ${text}`; break;
      case 'learn': prompt = `Với vai trò là một gia sư AI tận tâm, hãy giảng giải chi tiết từng bước, kèm theo các ví dụ minh họa dễ hiểu về chủ đề sau: ${text}`; break;
      case 'exam': prompt = `Với vai trò là người ra đề thi, hãy chỉ tạo ra các câu hỏi trắc nghiệm hoặc tự luận (không kèm theo đáp án hay lời giải) về chủ đề sau: ${text}`; break;
      case 'theory': prompt = `Với vai trò là một gia sư AI, hãy trình bày lý thuyết về chủ đề sau theo cấu trúc flashcard rõ ràng. Sử dụng Markdown, tạo các mục riêng biệt: 1. **Định nghĩa & Công thức cốt lõi**, 2. **Ví dụ minh họa**, và 3. **Lưu ý & Lỗi sai thường gặp**. Chủ đề là: ${text}`; break;
      case 'flashcard': prompt = `Với vai trò là một gia sư ngôn ngữ, hãy tạo một bảng flashcard hai cột từ yêu cầu sau. Luôn sử dụng định dạng bảng Markdown với header. Ví dụ header: "| Từ | Nghĩa |" hoặc "| English | Vietnamese |". Yêu cầu: ${text}`; break;
      case 'create_file': prompt = `Với vai trò là một trợ lý soạn thảo văn bản, hãy tạo nội dung cho một tệp dựa trên yêu cầu sau. Chỉ trả về nội dung của tệp, không thêm lời chào hay giải thích gì thêm. Yêu cầu: ${text}`; break;
      case 'mind_map': prompt = `Với vai trò là một chuyên gia tư duy trực quan, hãy tạo một sơ đồ tư duy chi tiết về chủ đề sau. Sử dụng định dạng danh sách lồng nhau (nested list) trong Markdown để biểu thị các nhánh, bắt đầu bằng dấu gạch đầu dòng (-). Chủ đề: ${text}`; break;
    }
    if (files.length > 0 && !prompt) prompt = "Phân tích và giải bài tập trong các tệp này.";

    try {
        const messageParts: (string | Part)[] = [];
        files.forEach(file => {
            messageParts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
        });
        messageParts.push({ text: prompt });

        const stream = await chatInstances.current[activeChatId].sendMessageStream({ message: messageParts });

        let fullResponseText = '';
        for await (const chunk of stream) {
            fullResponseText += chunk.text;
            setChatSessions(prev =>
                prev.map(chat => {
                    if (chat.id === activeChatId) {
                        const updatedMessages = [...chat.messages];
                        updatedMessages[updatedMessages.length - 1].text = fullResponseText;
                        return { ...chat, messages: updatedMessages };
                    }
                    return chat;
                })
            );
        }
        
        // Sau khi có phản hồi, gửi cả tin nhắn người dùng và tin nhắn của model lên backend để lưu trữ
        // const token = localStorage.getItem('kl-ai-token');
        // await fetch(`/api/chats/${activeChatId}/messages`, { 
        //    method: 'POST', 
        //    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        //    body: JSON.stringify({ 
        //        userMessage, 
        //        modelResponse: { role: 'model', text: fullResponseText, timestamp: new Date().toISOString() }
        //    }) 
        // });
        
        await generateTitleIfNeeded(text || (files.length > 0 ? `Tệp: ${files.map(f => f.name).join(', ')}` : ""));

        if (mode === 'flashcard') {
            const parsedData = parseFlashcardsFromResponse(fullResponseText);
            if (parsedData) {
                setChatSessions(prev =>
                    prev.map(chat => {
                        if (chat.id === activeChatId) {
                            const updatedMessages = [...chat.messages];
                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                            lastMessage.text = parsedData.intro.trim() || "Đây là bộ flashcard của bạn. Hãy nhấp vào để bắt đầu học!";
                            lastMessage.flashcards = parsedData.cards;
                            return { ...chat, messages: updatedMessages };
                        }
                        return chat;
                    })
                );
                setFlashcardData(parsedData.cards);
            }
        }
        
        if (mode === 'create_file') {
            let extension = 'txt';
            let mimeType = 'text/plain';
            const lowerText = text.toLowerCase();
        
            if (lowerText.includes('markdown') || lowerText.includes('.md')) {
                extension = 'md';
                mimeType = 'text/markdown';
            } else if (lowerText.includes('html') || lowerText.includes('.html')) {
                extension = 'html';
                mimeType = 'text/html';
            } else if (lowerText.includes('json') || lowerText.includes('.json')) {
                extension = 'json';
                mimeType = 'application/json';
            }
        
            const currentChat = chatSessions.find(c => c.id === activeChatId);
            const fileName = `${currentChat?.title.replace(/\s/g, '_') || 'Generated_File'}.${extension}`;
        
            const fileToDownload = {
                name: fileName,
                content: fullResponseText,
                mimeType: mimeType,
                extension: extension,
            };
        
            setChatSessions(prev =>
                prev.map(chat => {
                    if (chat.id === activeChatId) {
                        const updatedMessages = [...chat.messages];
                        updatedMessages[updatedMessages.length - 1].fileToDownload = fileToDownload;
                        return { ...chat, messages: updatedMessages };
                    }
                    return chat;
                })
            );
        }

        if (mode === 'mind_map') {
            const { data } = parseMindMapFromResponse(fullResponseText);
            if (data) {
                setChatSessions(prev =>
                    prev.map(chat => {
                        if (chat.id === activeChatId) {
                            const updatedMessages = [...chat.messages];
                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                            lastMessage.text = "Sơ đồ tư duy của bạn đã sẵn sàng. Nhấp vào nút bên dưới để mở.";
                            lastMessage.mindMapData = data;
                            return { ...chat, messages: updatedMessages };
                        }
                        return chat;
                    })
                );
            }
        }


    } catch (e) {
        handleError(e);
    } finally {
        setIsLoading(false);
    }
}, [activeChatId, mode, currentUser, chatSessions, isLoading]);

const handleRegenerateResponse = useCallback(async () => {
    if (!activeChatId || isLoading || !currentUser) return;
    const chat = chatSessions.find(c => c.id === activeChatId);
    if (!chat) return;

    const lastUserMessage = [...chat.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    // Remove the last model's response and add a new blank placeholder
    setChatSessions(prev =>
        prev.map(c => {
            if (c.id === activeChatId) {
                const messagesWithoutLastModel = c.messages.slice(0, -1);
                return { ...c, messages: [...messagesWithoutLastModel, { role: 'model', text: '', timestamp: new Date().toISOString() }] };
            }
            return c;
        })
    );
    
    setIsLoading(true);
    setError(null);
    setFlashcardData(null);

    const handleError = (e: any) => { /* ... error handling logic copied from handleSendMessage ... */ };
    
    try {
        const text = lastUserMessage.text;
        const files = lastUserMessage.files?.map(f => ({
            name: f.name,
            data: f.dataUrl.split(',')[1],
            mimeType: f.mimeType
        })) || [];
        const lastMode = lastUserMessage.mode || 'chat';

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const systemInstruction = getSystemInstruction(currentUser.aiRole, currentUser.aiTone);

        const historyUpToLastUser = chat.messages
            .slice(0, -1) // Exclude the old model response we're replacing
            .filter(m => m.text || (m.files && m.files.length > 0))
            .map(m => ({
                role: m.role,
                parts: [{ text: m.text }] // Note: History doesn't support files, model relies on text context
            }));
        const historyWithoutWelcome = historyUpToLastUser.slice(1);
        
        chatInstances.current[activeChatId] = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            history: historyWithoutWelcome,
        });

        const messageParts: (string | Part)[] = [];
        files.forEach(file => {
            messageParts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
        });
        messageParts.push({ text });

        const stream = await chatInstances.current[activeChatId].sendMessageStream({ message: messageParts });
        
        let fullResponseText = '';
        for await (const chunk of stream) {
            fullResponseText += chunk.text;
            setChatSessions(prev =>
                prev.map(c => {
                    if (c.id === activeChatId) {
                        const updatedMessages = [...c.messages];
                        updatedMessages[updatedMessages.length - 1].text = fullResponseText;
                        return { ...c, messages: updatedMessages };
                    }
                    return c;
                })
            );
        }
        
        // Re-run post-processing based on the original mode
        if (lastMode === 'flashcard') {
            const parsedData = parseFlashcardsFromResponse(fullResponseText);
            if (parsedData) {
                setChatSessions(prev =>
                    prev.map(chat => {
                        if (chat.id === activeChatId) {
                            const updatedMessages = [...chat.messages];
                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                            lastMessage.text = parsedData.intro.trim() || "Đây là bộ flashcard của bạn. Hãy nhấp vào để bắt đầu học!";
                            lastMessage.flashcards = parsedData.cards;
                            return { ...chat, messages: updatedMessages };
                        }
                        return chat;
                    })
                );
                setFlashcardData(parsedData.cards);
            }
        }
        if (lastMode === 'mind_map') {
             const { data } = parseMindMapFromResponse(fullResponseText);
            if (data) {
                setChatSessions(prev =>
                    prev.map(chat => {
                        if (chat.id === activeChatId) {
                            const updatedMessages = [...chat.messages];
                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                            lastMessage.text = "Sơ đồ tư duy của bạn đã sẵn sàng. Nhấp vào nút bên dưới để mở.";
                            lastMessage.mindMapData = data;
                            return { ...chat, messages: updatedMessages };
                        }
                        return chat;
                    })
                );
            }
        }
        // ... add other mode post-processing if needed ...

    } catch (e) {
        handleError(e);
    } finally {
        setIsLoading(false);
    }
}, [activeChatId, isLoading, chatSessions, currentUser]);

  const handleFollowUpClick = (originalText: string, action: FollowUpAction) => {
    if (isLoading) return;
    let prompt = '';
    switch (action) {
      case 'explain': prompt = `Hãy giải thích thêm về nội dung sau một cách chi tiết hơn: "${originalText}"`; break;
      case 'example': prompt = `Hãy tạo một ví dụ tương tự hoặc liên quan đến nội dung sau: "${originalText}"`; break;
      case 'summarize': prompt = `Hãy tóm tắt ngắn gọn lại nội dung sau: "${originalText}"`; break;
    }
    handleSendMessage(prompt);
  };

  const handleAskSelection = (selectedText: string) => {
    if (isLoading) return;
    const prompt = `Hãy giải thích hoặc làm rõ hơn về phần này: "${selectedText}"`;
    handleSendMessage(prompt);
  };

  const handleApplySchedule = async (markdownText: string) => {
    // 1. Clear previous notifications
    notificationTimeoutsRef.current.forEach(clearTimeout);
    notificationTimeoutsRef.current = [];
  
    // 2. Request permission
    if (typeof Notification === 'undefined') {
        alert('Trình duyệt này không hỗ trợ thông báo trên màn hình.');
        return;
    }

    if (Notification.permission === 'denied') {
      alert('Bạn đã chặn thông báo. Vui lòng cho phép trong cài đặt trình duyệt.');
      return;
    }
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Không thể gửi thông báo nếu bạn không cấp quyền.');
        return;
      }
    }
  
    // 3. Parse and schedule
    try {
      const lines = markdownText.trim().split('\n');
      const rows = lines.slice(2).filter(line => line.trim().startsWith('|')); // Skip header and separator
      let notificationsScheduled = 0;
  
      for (const row of rows) {
        const columns = row.split('|').map(c => c.trim()).filter(Boolean);
        if (columns.length < 2) continue;
  
        const timeString = columns[0];
        const activity = columns[1];
  
        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) continue;
  
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
  
        const now = new Date();
        const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  
        const delay = eventTime.getTime() - now.getTime();
  
        if (delay > 0) {
          const timeoutId = window.setTimeout(() => {
            new Notification('Đến giờ rồi!', {
              body: `Hoạt động: ${activity}`,
            });
          }, delay);
          notificationTimeoutsRef.current.push(timeoutId);
          notificationsScheduled++;
        }
      }
  
      if (notificationsScheduled > 0) {
        alert(`Đã lên lịch thành công cho ${notificationsScheduled} hoạt động!`);
      } else {
        alert('Không tìm thấy hoạt động nào trong tương lai để lên lịch thông báo.');
      }
    } catch (error) {
      console.error("Failed to parse or schedule notifications:", error);
      alert('Đã xảy ra lỗi khi áp dụng lịch trình.');
    }
  };

  const handleExportChat = () => {
    const chat = chatSessions.find(c => c.id === activeChatId);
    if (!chat) return;
    const content = chat.messages.map(msg => {
        const filesMarkdown = msg.files?.map(file =>
            file.mimeType.startsWith('image/')
                ? `![Tệp đính kèm: ${file.name}](${file.dataUrl})\n\n`
                : `\n[Tệp đính kèm: ${file.name}]\n\n`
        ).join('') || '';
        return `## ${msg.role === 'user' ? 'You' : 'KL AI'}\n\n${filesMarkdown}${msg.text}\n\n---\n`;
    }).join('');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title.replace(/ /g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAuthSuccess = (user: User, token: string) => {
    localStorage.setItem('kl-ai-token', token);
    setCurrentUser(user);
    setChatSessions([]);
    setActiveChatId(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('kl-ai-token');
    setCurrentUser(null);
    setChatSessions([]);
    setActiveChatId(null);
    chatInstances.current = {};
  };

  const handleUpdateUser = async (updatedUser: Partial<User>) => {
    if (!currentUser) return;
    try {
        const token = localStorage.getItem('kl-ai-token');
        // const response = await fetch('/api/user/me', {
        //     method: 'PUT',
        //     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        //     body: JSON.stringify(updatedUser),
        // });
        // if (!response.ok) throw new Error('Không thể cập nhật người dùng');
        // const returnedUser = await response.json();
        
        // ===================================================================
        // MOCK API CALL - Thay thế bằng API call thật đến backend của bạn
        // ===================================================================
        await new Promise(res => setTimeout(res, 300));
        const returnedUser = { ...currentUser, ...updatedUser };
        // ===================================================================

        setCurrentUser(returnedUser);
        if(returnedUser.theme) setTheme(returnedUser.theme);
        return true; // Báo hiệu thành công
    } catch (err) {
        console.error("Không thể cập nhật người dùng", err);
        setError("Không thể cập nhật thông tin tài khoản.");
        return false; // Báo hiệu thất bại
    }
  };
  
  const getPlaceholder = (): string => {
    switch (mode) {
      case 'create_exam': return 'Nhập yêu cầu tạo đề (ví dụ: tạo 5 câu trắc nghiệm về...)';
      case 'scramble_exam': return 'Nhập hoặc tải lên đề bài cần xáo trộn...';
      case 'similar_exam': return 'Nhập hoặc tải lên đề bài để tạo đề tương tự...';
      case 'solve_exam': return 'Nhập hoặc dán đề bài cần giải...';
      case 'create_schedule': return 'Nhập yêu cầu tạo lịch (ví dụ: tạo thời khóa biểu cho...)';
      case 'learn': return 'Nhập chủ đề bạn muốn được giảng giải...';
      case 'exam': return 'Nhập chủ đề để nhận câu hỏi ôn tập...';
      case 'theory': return 'Nhập chủ đề bạn muốn học lý thuyết...';
      case 'flashcard': return 'Nhập chủ đề hoặc dán danh sách từ vựng...';
      case 'create_file': return 'Mô tả tệp bạn muốn tạo (vd: tạo file .md về...)';
      case 'mind_map': return 'Nhập chủ đề để tạo sơ đồ tư duy...';
      default: return 'Nhập tin nhắn hoặc dán ảnh vào...';
    }
  };

  const handleModeChange = (targetMode: Mode) => {
    setMode(prevMode => (prevMode === targetMode ? 'chat' : targetMode));
    setIsFeaturesPopoverOpen(false);
  }
  const handleRenameChat = (chatId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle) {
      // Gọi API để cập nhật tiêu đề trên backend
      // const token = localStorage.getItem('kl-ai-token');
      // fetch(`/api/chats/${chatId}`, { 
      //    method: 'PATCH',
      //    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      //    body: JSON.stringify({ title: trimmedTitle }) 
      // });
      setChatSessions(prev => prev.map(s => s.id === chatId ? { ...s, title: trimmedTitle } : s));
    }
    setEditingChatId(null);
  };

  const handleDeleteChat = (chatId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động này không thể hoàn tác.")) {
        return;
    }
    // In real app, send DELETE request to backend
    // const token = localStorage.getItem('kl-ai-token');
    // fetch(`/api/chats/${chatId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    
    setChatSessions(prevSessions => {
        const sessionIndex = prevSessions.findIndex(s => s.id === chatId);
        if (sessionIndex === -1) return prevSessions;

        const remainingSessions = prevSessions.filter(s => s.id !== chatId);

        if (activeChatId === chatId) {
            if (remainingSessions.length > 0) {
                // Select the chat at the same index if possible, otherwise the previous one
                const newIndex = Math.min(sessionIndex, remainingSessions.length - 1);
                setActiveChatId(remainingSessions[newIndex].id);
            } else {
                setActiveChatId(null);
            }
        }
        
        delete chatInstances.current[chatId];
        return remainingSessions;
    });
  };

  const handleTogglePinChat = (chatId: string) => {
    // Gọi API để thay đổi trạng thái ghim trên backend
    // const token = localStorage.getItem('kl-ai-token');
    // fetch(`/api/chats/${chatId}/pin`, { 
    //    method: 'POST',
    //    headers: { 'Authorization': `Bearer ${token}` }
    // });
    setChatSessions(prev => prev.map(s => s.id === chatId ? { ...s, isPinned: !s.isPinned } : s));
  };
  const handleThemeToggle = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  const handleOpenFlashcards = (cards: { term: string; definition: string }[]) => {
    setFlashcardData(cards);
  };
  const handleOpenMindMap = (data: MindMapNode) => {
    setMindMapModalData(data);
  };
  const handleCreateNewMindMap = (data: MindMapNode) => {
    if (!activeChatId) return;

    const modelMessage: Message = {
        role: 'model',
        text: "Đây là sơ đồ tư duy mới được tách ra từ sơ đồ trước.",
        timestamp: new Date().toISOString(),
        mindMapData: data,
    };

    setChatSessions(prev =>
        prev.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: [...chat.messages, modelMessage] }
                : chat
        )
    );
    
    setMindMapModalData(null);
  };

  const ModeButton: React.FC<{ targetMode: Mode; icon: React.ReactNode; label: string }> = ({ targetMode, icon, label }) => (
    <button
      onClick={() => handleModeChange(targetMode)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
        mode === targetMode ? 'bg-brand text-white' : 'bg-card-hover hover:bg-border text-text-secondary'
      }`}
      aria-pressed={mode === targetMode}
    >
      {icon}
      {label}
    </button>
  );
  
  const activeChat = chatSessions.find(c => c.id === activeChatId);

  const ChatListItem: React.FC<{ session: ChatSession }> = ({ session }) => (
    <div key={session.id} className="relative group flex items-center">
      {editingChatId === session.id ? (
        <input
          type="text"
          defaultValue={session.title}
          onBlur={(e) => handleRenameChat(session.id, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameChat(session.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingChatId(null); }}
          className="w-full text-left px-3 py-2 text-sm rounded-md bg-input-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
          autoFocus
        />
      ) : (
        <div className="flex items-center w-full">
          <button
            onClick={() => {
              setActiveChatId(session.id);
              setIsMobileSidebarOpen(false);
            }}
            className={`flex-1 text-left px-3 py-2 text-sm rounded-md truncate transition-colors duration-200 ${
              activeChatId === session.id ? 'bg-brand-secondary text-brand font-semibold' : 'hover:bg-card-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            {session.title}
          </button>
          <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-sidebar/80 rounded-full">
            <button onClick={() => handleTogglePinChat(session.id)} className={`p-1.5 rounded-md ${session.isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-text-secondary hover:text-text-primary'}`} aria-label={session.isPinned ? "Bỏ ghim" : "Ghim"} title={session.isPinned ? "Bỏ ghim" : "Ghim"}> <PinIcon className={`w-4 h-4 ${session.isPinned ? 'fill-amber-400' : ''}`} /> </button>
            <button onClick={() => setEditingChatId(session.id)} className="p-1.5 text-text-secondary hover:text-text-primary" aria-label="Đổi tên" title="Đổi tên"> <EditIcon className="w-4 h-4" /> </button>
            <button onClick={() => handleDeleteChat(session.id)} className="p-1.5 text-text-secondary hover:text-red-500" aria-label="Xóa đoạn chat" title="Xóa đoạn chat"> <TrashIcon className="w-4 h-4" /> </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isAuthenticating) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <KlAiLogo className="w-40 text-text-primary animate-pulse" />
        </div>
    );
  }
  
  if (!currentUser) return <Auth onAuthSuccess={handleAuthSuccess} />;

  const filteredSessions = chatSessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const pinnedChats = filteredSessions.filter(s => s.isPinned);
  const unpinnedChats = filteredSessions.filter(s => !s.isPinned);
  const isLastMessageEmpty = !activeChat?.messages[activeChat.messages.length - 1]?.text && (!activeChat?.messages[activeChat.messages.length - 1]?.files || activeChat?.messages[activeChat.messages.length - 1]?.files!.length === 0);


  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar p-2">
      <div className="p-2 mb-2"> <KlAiLogo className="w-28 text-text-primary" /> </div>
      <button onClick={handleNewChat} className="flex items-center justify-center gap-2 w-full px-4 py-2 mb-2 text-sm font-medium text-white bg-brand rounded-lg hover:opacity-90 transition-opacity duration-200"> <NewChatIcon className="w-5 h-5" /> Đoạn chat mới </button>
      <div className="relative px-2 mb-2">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-card border border-border rounded-lg py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
          {searchQuery && filteredSessions.length === 0 && (
            <div className="text-center px-4 py-8">
              <p className="text-sm text-text-secondary">Không tìm thấy kết quả cho "{searchQuery}"</p>
            </div>
          )}
          {!searchQuery && chatSessions.length === 0 && (
            <div className="text-center px-4 py-8">
              <p className="text-sm text-text-secondary">Không tồn tại đoạn chat nào cả.</p>
            </div>
          )}

          {filteredSessions.length > 0 && (
            <>
              {pinnedChats.length > 0 && (
                <div className="mb-4">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider px-2 mb-2">
                    <PinIcon className="w-3 h-3" />
                    <span>Đã ghim</span>
                  </h2>
                  <nav className="flex flex-col gap-1"> {pinnedChats.map(s => <ChatListItem key={s.id} session={s} />)} </nav>
                </div>
              )}

              {unpinnedChats.length > 0 && (
                <div>
                  {pinnedChats.length > 0 && <div className="border-t border-border mx-2 mb-4"></div>}
                  <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-2 mb-2">
                    {pinnedChats.length > 0 ? "Gần đây" : "Đoạn chat"}
                  </h2>
                  <nav className="flex flex-col gap-1"> {unpinnedChats.map(s => <ChatListItem key={s.id} session={s} />)} </nav>
                </div>
              )}
            </>
          )}
      </div>

      <div className="mt-2 px-2 space-y-1">
        <button onClick={() => setIsCalculatorOpen(true)} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-card-hover text-left transition-colors">
            <CalculatorIcon className="w-5 h-5 text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">Máy tính</span>
        </button>
        <button onClick={() => setIsPeriodicTableOpen(true)} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-card-hover text-left transition-colors">
            <PeriodicTableIcon className="w-5 h-5 text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">Bảng tuần hoàn</span>
        </button>
      </div>

      <div className="border-t border-border mt-2 pt-2">
          <div className="flex items-center gap-3 p-2 text-sm text-text-secondary rounded-lg hover:bg-card-hover w-full text-left">
              <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 flex-1">
                {currentUser?.avatar ? ( <span className="text-2xl">{currentUser.avatar}</span> ) : ( <UserIcon className="w-6 h-6" /> )}
                <span className="font-medium flex-1 truncate text-text-primary">{currentUser.username}</span>
              </button>
              <button onClick={handleLogout} className="p-1.5 rounded-md hover:bg-card" aria-label="Đăng xuất" title="Đăng xuất"> <LogoutIcon className="w-5 h-5" /> </button>
          </div>
      </div>
    </div>
  );

  const featuresButton = (
    <button
        ref={featuresButtonRef}
        type="button"
        onClick={() => setIsFeaturesPopoverOpen(prev => !prev)}
        className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-brand disabled:opacity-50 transition-colors ${
            isFeaturesPopoverOpen ? 'bg-brand text-white' : 'bg-card-hover hover:bg-border text-text-secondary'
        }`}
        aria-label="Các chức năng"
        title="Các chức năng"
    >
        <FeaturesIcon className="w-6 h-6" />
    </button>
  );

  return (
    <>
      <div className="flex h-screen bg-background text-text-primary">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-80 flex-col border-r border-border">
          <SidebarContent />
        </aside>

         {/* Mobile Sidebar */}
        {isMobileSidebarOpen && (
            <>
                <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileSidebarOpen(false)}></div>
                <aside className="fixed top-0 left-0 h-full w-80 z-40 animate-slide-in-left md:hidden border-r border-border">
                    <SidebarContent />
                </aside>
            </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
           <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary md:hidden" aria-label="Mở menu">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-semibold truncate">{activeChat?.title || 'KL AI'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleThemeToggle} className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary bg-card-hover border border-border rounded-md hover:border-brand hover:text-brand transition-colors" title="Chuyển giao diện">
                        {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={handleExportChat} className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary bg-card-hover border border-border rounded-md hover:border-brand hover:text-brand transition-colors" title="Xuất cuộc trò chuyện (Markdown)"> <DownloadIcon className="w-4 h-4" /> </button>
                </div>
            </header>
          <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
            {activeChat?.messages.map((msg, index) => ( <ChatMessage key={`${activeChat.id}-${index}`} message={msg} isLastMessage={index === activeChat.messages.length - 1} isLoading={isLoading} onFollowUpClick={handleFollowUpClick} onApplySchedule={handleApplySchedule} onOpenFlashcards={handleOpenFlashcards} onOpenMindMap={handleOpenMindMap} onAskSelection={handleAskSelection} onRegenerate={handleRegenerateResponse} userAvatar={currentUser?.avatar} /> ))}
            {isLoading && isLastMessageEmpty && <TypingIndicator />}
          </main>
          <footer className="bg-card/80 backdrop-blur-sm border-t border-border p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                {isFeaturesPopoverOpen && (
                  <div
                    ref={featuresPopoverRef}
                    className="absolute bottom-full left-0 mb-3 w-full p-3 bg-card border border-border rounded-xl shadow-lg animate-slide-in-up"
                    style={{ animationDuration: '0.2s' }}
                  >
                    <div className="flex justify-center items-center flex-wrap gap-2">
                      <ModeButton targetMode="learn" icon={<LearnModeIcon className="w-4 h-4" />} label="Chế độ học" />
                      <ModeButton targetMode="theory" icon={<TheoryModeIcon className="w-4 h-4" />} label="Học lý thuyết" />
                       <ModeButton targetMode="flashcard" icon={<FlashcardIcon className="w-4 h-4" />} label="Flashcard" />
                      <ModeButton targetMode="exam" icon={<ExamModeIcon className="w-4 h-4" />} label="Chế độ thi" />
                      <ModeButton targetMode="mind_map" icon={<MindMapIcon className="w-4 h-4" />} label="Sơ đồ tư duy" />
                      <ModeButton targetMode="create_exam" icon={<CreateExamIcon className="w-4 h-4" />} label="Tạo đề thi" />
                      <ModeButton targetMode="create_file" icon={<CreateFileIcon className="w-4 h-4" />} label="Tạo tệp" />
                      <ModeButton targetMode="scramble_exam" icon={<ShuffleIcon className="w-4 h-4" />} label="Tạo mã đề" />
                      <ModeButton targetMode="similar_exam" icon={<CloneIcon className="w-4 h-4" />} label="Tạo đề tương tự" />
                      <ModeButton targetMode="solve_exam" icon={<SolveExamIcon className="w-4 h-4" />} label="Giải đề" />
                      <ModeButton targetMode="create_schedule" icon={<CreateScheduleIcon className="w-4 h-4" />} label="Tạo lịch" />
                    </div>
                  </div>
                )}
                <ChatInput 
                  onSendMessage={handleSendMessage} 
                  isLoading={isLoading} 
                  placeholder={getPlaceholder()}
                  featuresButton={featuresButton}
                />
              </div>
            </div>
          </footer>
        </div>
      </div>

      {isCalculatorOpen && (
        <ToolModal title="Máy tính" onClose={() => setIsCalculatorOpen(false)} initialSize={{width: 420, height: 650}}>
            <Calculator />
        </ToolModal>
      )}
      {isPeriodicTableOpen && (
        <ToolModal title="Bảng tuần hoàn" onClose={() => setIsPeriodicTableOpen(false)} initialSize={{width: 900, height: 700}}>
            <PeriodicTable />
        </ToolModal>
      )}

      {mindMapModalData && <MindMapModal data={mindMapModalData} onClose={() => setMindMapModalData(null)} onCreateNewMindMap={handleCreateNewMindMap} />}
      {flashcardData && <FlashcardView cards={flashcardData} onClose={() => setFlashcardData(null)} />}
      {isSettingsOpen && currentUser && ( <SettingsModal user={currentUser} onClose={() => setIsSettingsOpen(false)} onUpdateUser={handleUpdateUser} /> )}
    </>
  );
};

export default App;