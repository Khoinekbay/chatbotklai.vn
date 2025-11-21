
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenAI, Chat } from '@google/genai';
import { type Message, type ChatSession, type User, type MindMapNode, type Mode, type FollowUpAction, type Role } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { CreateExamIcon, SolveExamIcon, CreateScheduleIcon, NewChatIcon, KlAiLogo, UserIcon, LogoutIcon, EditIcon, SearchIcon, PinIcon, LearnModeIcon, ExamModeIcon, DownloadIcon, SunIcon, MoonIcon, TheoryModeIcon, MenuIcon, FeaturesIcon, FlashcardIcon, ShuffleIcon, CloneIcon, CalculatorIcon, PeriodicTableIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CreateFileIcon, MindMapIcon, TrashIcon, SettingsIcon, MoreHorizontalIcon, KeyIcon, MagicIcon, PresentationIcon, GraderIcon, DocumentSearchIcon, TimerIcon, ChartIcon, LockIcon, ScaleIcon, DiceIcon, NotebookIcon, GamepadIcon, XIcon } from './Icons';
import { api } from '../utils/api';

// Lazy load heavy components
const SettingsModal = React.lazy(() => import('./SettingsModal'));
const FlashcardView = React.lazy(() => import('./FlashcardView'));
const Calculator = React.lazy(() => import('./Calculator'));
const PeriodicTable = React.lazy(() => import('./PeriodicTable'));
const ToolModal = React.lazy(() => import('./ToolModal'));
const MindMapModal = React.lazy(() => import('./MindMapModal'));
const Whiteboard = React.lazy(() => import('./Whiteboard'));
const PomodoroTimer = React.lazy(() => import('./PomodoroTimer'));
const UnitConverter = React.lazy(() => import('./UnitConverter'));
const ProbabilitySim = React.lazy(() => import('./ProbabilitySim'));
const FormulaNotebook = React.lazy(() => import('./FormulaNotebook'));
const BreathingExercise = React.lazy(() => import('./BreathingExercise'));
const LofiPlayer = React.lazy(() => import('./LofiPlayer'));
const TarotReader = React.lazy(() => import('./TarotReader'));
const EntertainmentMenu = React.lazy(() => import('./EntertainmentMenu'));

// Add type declaration for XLSX on window to fix TypeScript errors.
declare global {
    interface Window {
      XLSX: any;
    }
}


const DEMO_MESSAGE_LIMIT = 10;
const MODEL_NAME = 'gemini-2.5-flash';
// Primary model
const IMAGE_MODEL_NAME = 'imagen-4.0-generate-001';
// Fallback model if 4.0 fails
const IMAGE_MODEL_FALLBACK = 'imagen-3.0-generate-001';

const getSystemInstruction = (role: User['aiRole'] = 'assistant', tone: User['aiTone'] = 'balanced', customInstruction?: string, currentMode?: Mode): string => {
    
    // --- SPECIAL MODES OVERRIDE (Ignore user settings) ---
    if (currentMode === 'flashcard') {
        return `Bạn là chuyên gia tạo Flashcard học tập.
        
        NHIỆM VỤ CHÍNH:
        Tạo danh sách các cặp "Thuật ngữ" (Term) và "Định nghĩa" (Definition) từ yêu cầu của người dùng.
        
        QUY TẮC ĐỊNH DẠNG (BẮT BUỘC):
        1. Tuyệt đối KHÔNG trả về bảng Markdown.
        2. Tuyệt đối KHÔNG trả về danh sách gạch đầu dòng.
        3. CHỈ trả về một khối mã JSON duy nhất với nhãn \`flashcard_json\`.
        4. Cấu trúc JSON phải là một mảng các đối tượng:
        \`\`\`flashcard_json
        [
          {"term": "Từ vựng/Câu hỏi", "definition": "Nghĩa/Câu trả lời"},
          {"term": "Apple", "definition": "Quả táo"}
        ]
        \`\`\`
        5. Bạn có thể viết 1 câu dẫn ngắn gọn ở đầu (ví dụ: "Dưới đây là bộ flashcard của bạn:").
        `;
    }
     if (currentMode === 'mind_map') {
        return `Bạn là một chuyên gia tạo sơ đồ tư duy. Khi người dùng cung cấp một chủ đề, hãy tạo ra một cấu trúc sơ đồ tư duy dưới dạng danh sách markdown (dùng dấu - hoặc *). Các mục con phải được lùi vào trong.
        Ví dụ:
        - Động vật
          - Động vật có vú
            - Chó
            - Mèo
          - Bò sát
            - Rắn
        `;
    }
    if (currentMode === 'rpg') {
        return `Bạn là Game Master (GM) của một trò chơi nhập vai dạng văn bản (Text Adventure). Hãy dẫn dắt người chơi qua một cốt truyện thú vị, sáng tạo. Bắt đầu bằng việc mô tả bối cảnh hiện tại và hỏi người chơi muốn làm gì. Luôn mô tả hậu quả của hành động một cách sinh động. Giữ giọng văn lôi cuốn.`;
    }
    if (currentMode === 'roast') {
        return `Bạn là một danh hài độc thoại cực kỳ xéo xắt, chua ngoa và hài hước (Roast Master). Nhiệm vụ của bạn là 'khịa', châm biếm và 'roast' người dùng một cách thâm thúy nhưng buồn cười. Hãy dùng ngôn ngữ mạnh, slang, teencode, meme nếu cần. Biến mọi câu nói của người dùng thành trò đùa. Đừng quá nghiêm túc.`;
    }
    if (currentMode === 'akinator') {
        return `Bạn là Thần đèn Akinator. Người dùng đang nghĩ về một nhân vật nổi tiếng (thực hoặc hư cấu). Nhiệm vụ của bạn là đoán ra nhân vật đó bằng cách đặt các câu hỏi Yes/No. Hãy hỏi tối đa 20 câu. Sau mỗi câu trả lời, hãy đưa ra câu hỏi tiếp theo hoặc đoán nhân vật.`;
    }
    if (currentMode === 'tarot') {
        return `Bạn là một Tarot Reader (Người đọc bài Tarot) chuyên nghiệp, huyền bí và sâu sắc. Bạn sẽ nhận được tên lá bài và vấn đề của người dùng. Hãy giải thích ý nghĩa lá bài trong bối cảnh đó, đưa ra lời khuyên chữa lành. Giọng văn nhẹ nhàng, thấu cảm, mang màu sắc tâm linh.`;
    }
    if (currentMode === 'mbti') {
        return `Bạn là chuyên gia tâm lý học. Hãy đặt các câu hỏi trắc nghiệm ngắn để xác định tính cách MBTI của người dùng. Hỏi từng câu một. Sau khoảng 10 câu, hãy đưa ra dự đoán về nhóm tính cách của họ.`;
    }

    // --- STANDARD MODES ---
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

    const basePrompt = `Bạn là KL AI, một trợ lý AI được thiết kế đặc biệt cho giáo viên và học sinh Việt Nam. Các câu trả lời của bạn phải bằng tiếng Việt. Sử dụng markdown để định dạng khi thích hợp, bao gồm cả công thức toán học LaTeX (sử dụng $...$ cho inline và $$...$$ cho block). 
    
    1. Đồ thị hàm số: sử dụng khối mã "graph". Ví dụ:
    \`\`\`graph
    f(x) = x^2
    y = sin(x)
    \`\`\`
    
    2. Bảng biến thiên: TUYỆT ĐỐI phải sử dụng khối mã \`bbt\`. Ví dụ:
    \`\`\`bbt
    | x | -∞ | 1 | +∞ |
    |---|---|---|---|
    | y'| | + | 0 | - |
    | y | | ↗ | 2 | ↘ |
    \`\`\`
    
    3. Bảng xét dấu: sử dụng khối mã \`bsd\`. Ví dụ:
    \`\`\`bsd
    | x | -∞ | 2 | +∞ |
    |---|---|---|---|
    | f(x) | - | 0 | + |
    \`\`\`

    4. Biểu đồ dữ liệu: Khi được yêu cầu vẽ biểu đồ từ dữ liệu, bạn hãy trả về một khối JSON đặc biệt có tên \`chart_json\`. JSON này phải tuân theo cấu hình của Chart.js. KHÔNG dùng code block thông thường cho cái này, hãy bọc JSON trong block \`\`\`chart_json ... \`\`\`.
    Ví dụ:
    \`\`\`chart_json
    {
        "type": "bar",
        "data": {
            "labels": ["A", "B", "C"],
            "datasets": [{ "label": "Dữ liệu", "data": [10, 20, 30] }]
        }
    }
    \`\`\`

    5. Lập lịch (Google Calendar): Khi được yêu cầu tạo lịch, ngoài văn bản, hãy trả về khối JSON \`\`\`schedule_json\`\`\` để tạo nút thêm vào lịch.
    Ví dụ:
    \`\`\`schedule_json
    {
        "title": "Học Toán",
        "startTime": "2023-10-27T08:00:00",
        "endTime": "2023-10-27T10:00:00",
        "details": "Ôn tập chương 1",
        "location": "Nhà"
    }
    \`\`\`
    `;

    let finalPrompt = `${roleDescription} ${toneInstruction} ${basePrompt}`;

    if (customInstruction && customInstruction.trim()) {
        finalPrompt += `\n\n## HƯỚNG DẪN TÙY CHỈNH TỪ NGƯỜI DÙNG (MỨC ĐỘ ƯU TIÊN CAO NHẤT - BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):\n${customInstruction.trim()}`;
    }

    return finalPrompt;
}

const parseFlashcardsFromResponse = (text: string): { intro: string; cards: { term: string; definition: string }[] } | null => {
    // Legacy parser for Markdown Tables
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

const parseSpecialJsonBlock = (text: string, blockName: string): any | null => {
    // Improved regex to handle optional newlines/spaces after the block name
    const regex = new RegExp(`\`\`\`${blockName}\\s*([\\s\\S]*?)\`\`\``);
    const match = text.match(regex);
    if (match && match[1]) {
        try {
            let jsonStr = match[1].trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error(`Failed to parse ${blockName}`, e);
            return null;
        }
    }
    return null;
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

const mindMapToMarkdown = (node: MindMapNode, depth = 0): string => {
    const indent = '  '.repeat(depth);
    let result = `${indent}- ${node.name}\n`;
    if (node.children) {
        result += node.children.map(child => mindMapToMarkdown(child, depth + 1)).join('');
    }
    return result;
};

const mapMessageToHistory = (m: Message) => {
   const parts: any[] = [];
   if (m.text) parts.push({ text: m.text });
   
   if (m.mindMapData) {
       const mindMapText = `\n[Context: Mind Map Data]\n${mindMapToMarkdown(m.mindMapData)}`;
       parts.push({ text: mindMapText });
   }

   if (m.files) {
       m.files.forEach(file => {
           if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf' || file.mimeType.startsWith('text/')) {
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
   if (parts.length === 0) return null;
   
   return {
       role: m.role,
       parts: parts
   };
};

// Helper to read spreadsheet files
const readSpreadsheet = (file: { data: string; mimeType: string }): Promise<string | null> => {
    return new Promise((resolve) => {
        try {
            // Convert base64 to binary string
            const binaryStr = atob(file.data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            
            // Read workbook
            if (window.XLSX) {
                const workbook = window.XLSX.read(bytes.buffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Convert to CSV text
                const csv = window.XLSX.utils.sheet_to_csv(worksheet);
                resolve(csv);
            } else {
                resolve(null);
            }
        } catch (e) {
            console.error("Error reading spreadsheet", e);
            resolve(null);
        }
    });
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
  const [isEntertainmentPopoverOpen, setIsEntertainmentPopoverOpen] = useState(false);
  const [flashcardData, setFlashcardData] = useState<{ term: string; definition: string }[] | null>(null);
  const [mindMapModalState, setMindMapModalState] = useState<{ data: MindMapNode, messageIndex: number } | null>(null);
  
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPeriodicTableOpen, setIsPeriodicTableOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [isUnitConverterOpen, setIsUnitConverterOpen] = useState(false);
  const [isProbabilitySimOpen, setIsProbabilitySimOpen] = useState(false);
  const [isFormulaNotebookOpen, setIsFormulaNotebookOpen] = useState(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);
  const [isTarotOpen, setIsTarotOpen] = useState(false);
  
  const [demoMessageCount, setDemoMessageCount] = useState(0);
  const [showDemoLimitModal, setShowDemoLimitModal] = useState(false);
  const [showLoginPromptModal, setShowLoginPromptModal] = useState(false);


  const chatInstances = useRef<{ [key: string]: Chat }>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const featuresPopoverRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLButtonElement>(null);
  const entertainmentPopoverRef = useRef<HTMLDivElement>(null);
  const entertainmentButtonRef = useRef<HTMLButtonElement>(null);
  
  const activeChat = chatSessions.find(c => c.id === activeChatId);
  
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
        return response.text || null;
    } catch (error) {
        console.error("OCR failed:", error);
        return null;
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string, files: { name: string; data: string; mimeType: string }[] = [], options?: { modeOverride?: Mode }) => {
    if (!activeChatId || isLoading || !currentUser) return;
    
    // DEMO LIMIT CHECK
    if (currentUser.isDemo) {
        if (demoMessageCount >= DEMO_MESSAGE_LIMIT) {
            setShowDemoLimitModal(true);
            return;
        }
        // Increment locally for UI
        setDemoMessageCount(prev => {
            const newCount = prev + 1;
            localStorage.setItem('kl-ai-demo-count', newCount.toString());
            return newCount;
        });
    }

    const finalMode = options?.modeOverride || mode;

    if (!chatInstances.current[activeChatId] && finalMode !== 'generate_image') return;
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
        mode: finalMode,
    };

    // Optimistic Update: Add User Message
    setChatSessions(prev =>
        prev.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: [...chat.messages, userMessage, { role: 'model', text: '', timestamp: new Date().toISOString(), mode: finalMode }] }
                : chat
        )
    );
    setIsLoading(true);
    setError(null);

    // Logic for Generating Title (only for first message)
    const generateTitleIfNeeded = async (promptText: string) => {
        const activeChatForTitle = chatSessions.find(c => c.id === activeChatId);
        const isFirstUserMessage = activeChatForTitle ? activeChatForTitle.messages.filter(m => m.role === 'user').length === 0 : false;

        if (isFirstUserMessage && promptText) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            try {
                const titleGenPrompt = `Dựa vào yêu cầu đầu tiên này: "${promptText}", hãy tạo một tiêu đề ngắn gọn (tối đa 5 từ) bằng tiếng Việt cho cuộc trò chuyện. Chỉ trả về tiêu đề.`;
                const titleResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: titleGenPrompt });
                let newTitle = titleResponse.text.trim().replace(/^"|"$/g, '');
                if (newTitle) {
                    setChatSessions(prev =>
                        prev.map(chat => chat.id === activeChatId ? { ...chat, title: newTitle } : chat)
                    );
                    if (activeChatForTitle && !currentUser.isDemo) {
                        await api.saveChatSession(currentUser.username, { ...activeChatForTitle, title: newTitle });
                    }
                }
            } catch (titleError) { console.error("Không thể tạo tiêu đề", titleError); }
        }
    };

    if (finalMode !== 'generate_image') {
        generateTitleIfNeeded(text);
    }

    try {
        // --- IMAGE GENERATION MODE ---
        if (finalMode === 'generate_image') {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
             let generatedImage;
             
             try {
                 // Try Imagen 4 first (High Quality)
                 const response = await ai.models.generateImages({
                    model: IMAGE_MODEL_NAME,
                    prompt: text,
                    config: {
                      numberOfImages: 1,
                      aspectRatio: '1:1',
                    },
                 });
                 generatedImage = response.generatedImages?.[0]?.image;
             } catch (err: any) {
                 console.warn(`Imagen 4 failed: ${err.message}. Falling back to Imagen 3...`);
                 // Fallback to Imagen 3 (More stable)
                 try {
                    const response = await ai.models.generateImages({
                        model: IMAGE_MODEL_FALLBACK,
                        prompt: text,
                        config: {
                            numberOfImages: 1,
                            aspectRatio: '1:1',
                        },
                    });
                    generatedImage = response.generatedImages?.[0]?.image;
                 } catch (fallbackErr: any) {
                     console.error("Imagen 3 fallback failed:", fallbackErr);
                     throw fallbackErr; // Re-throw to be caught by main catch block
                 }
             }
             
             if (generatedImage) {
                 const base64ImageBytes = generatedImage.imageBytes;
                 const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                 
                 setChatSessions(prev => 
                    prev.map(chat => {
                        if (chat.id !== activeChatId) return chat;
                        const newMessages = [...chat.messages];
                        const lastMsg = { ...newMessages[newMessages.length - 1] };
                        lastMsg.text = `Đã tạo ảnh dựa trên mô tả: "${text}"`;
                        lastMsg.files = [{
                             name: 'generated-image.png',
                             dataUrl: imageUrl,
                             mimeType: 'image/png'
                        }];
                        newMessages[newMessages.length - 1] = lastMsg;
                        return { ...chat, messages: newMessages };
                    })
                );
             } else {
                 throw new Error("Không nhận được hình ảnh từ AI.");
             }
        } 
        // --- STANDARD CHAT MODE ---
        else {
            const activeChatInstance = chatInstances.current[activeChatId];
            
            let messageTextToSend = text;
            let finalFiles = [...files];

            // Pre-process Excel files for Data Analysis
            if (finalMode === 'data_analysis' && files.length > 0) {
                 for (const file of files) {
                     if (file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel') || file.name.endsWith('.csv')) {
                         const csvContent = await readSpreadsheet(file);
                         if (csvContent) {
                             messageTextToSend += `\n\n[Dữ liệu từ file ${file.name}]:\n${csvContent}\n`;
                             finalFiles = finalFiles.filter(f => f !== file);
                         }
                     }
                 }
            }

            if (finalMode === 'grader') {
                messageTextToSend = `BẠN LÀ MỘT GIÁO VIÊN CHẤM THI...\nNội dung bài làm: ${messageTextToSend}`;
            } else if (finalMode === 'chat_document') {
                messageTextToSend = `BẠN LÀ TRỢ LÝ PHÂN TÍCH TÀI LIỆU...\nCâu hỏi: ${messageTextToSend}`;
            }

            const parts: any[] = [{ text: messageTextToSend }];
            if (finalFiles.length > 0) {
                finalFiles.forEach(file => {
                    parts.push({
                        inlineData: { mimeType: file.mimeType, data: file.data }
                    });
                });
            }

            const result = await activeChatInstance.sendMessageStream({ message: parts });
            let fullText = '';
            
            for await (const chunk of result) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullText += chunkText;
                    setChatSessions(prev => 
                        prev.map(chat => {
                            if (chat.id !== activeChatId) return chat;
                            const newMessages = [...chat.messages];
                            const lastMsg = { ...newMessages[newMessages.length - 1] };
                            if (lastMsg.role === 'model') lastMsg.text = fullText;
                            newMessages[newMessages.length - 1] = lastMsg;
                            return { ...chat, messages: newMessages };
                        })
                    );
                }
            }
            
            // Post-process the full response once streaming is complete
            setChatSessions(prev => 
                prev.map(chat => {
                    if (chat.id !== activeChatId) return chat;

                    const newMessages = [...chat.messages];
                    const lastMsg = { ...newMessages[newMessages.length - 1] };

                    if (finalMode === 'flashcard') {
                        // Try to parse JSON first (New reliable method)
                        const jsonBlock = parseSpecialJsonBlock(fullText, 'flashcard_json');
                        
                        if (jsonBlock && Array.isArray(jsonBlock)) {
                             // Clean up text by removing the JSON block
                             lastMsg.text = fullText.replace(/```flashcard_json[\s\S]*?```/, '').trim() || "Dưới đây là bộ flashcard bạn yêu cầu:";
                             lastMsg.flashcards = jsonBlock;
                        } else {
                            // Fallback to Markdown Table parser (Legacy support)
                            const parsed = parseFlashcardsFromResponse(fullText);
                            if (parsed && parsed.cards.length > 0) {
                                lastMsg.text = parsed.intro;
                                lastMsg.flashcards = parsed.cards;
                            } else {
                                lastMsg.text = fullText + "\n\n(Không thể tạo bộ thẻ từ nội dung này. Vui lòng thử lại.)";
                                lastMsg.isError = true;
                            }
                        }
                    } else if (finalMode === 'mind_map') {
                        const { intro, data } = parseMindMapFromResponse(fullText);
                        lastMsg.text = intro;
                        if (data) {
                            lastMsg.mindMapData = data;
                        } else if (fullText && fullText.trim().length > intro.trim().length) { // Heuristic: if there was content that looked like a list but failed to parse
                            lastMsg.text = fullText + "\n\n(Không thể phân tích sơ đồ tư duy. Vui lòng thử lại.)";
                            lastMsg.isError = true;
                        }
                    } else {
                        // Default handling for other modes
                        lastMsg.text = fullText;
                        lastMsg.chartConfig = parseSpecialJsonBlock(fullText, 'chart_json');
                        lastMsg.scheduleData = parseSpecialJsonBlock(fullText, 'schedule_json');
                    }
                    
                    newMessages[newMessages.length - 1] = lastMsg;
                    return { ...chat, messages: newMessages };
                })
            );
        }

    } catch (error: any) {
        console.error("Error processing request:", error);
        let errorMessage = "Đã có lỗi xảy ra khi xử lý yêu cầu. ";
        errorMessage += "(Kiểm tra API Key của bạn hoặc định dạng file)";

        setError(errorMessage);
        setChatSessions(prev => 
            prev.map(chat => {
                if (chat.id !== activeChatId) return chat;
                const newMessages = [...chat.messages];
                const lastMsg = { ...newMessages[newMessages.length - 1] };
                lastMsg.isError = true;
                lastMsg.text = errorMessage;
                newMessages[newMessages.length - 1] = lastMsg;
                return { ...chat, messages: newMessages };
            })
        );
    } finally {
        setIsLoading(false);
    }
  }, [activeChatId, chatSessions, mode, isLoading, currentUser, demoMessageCount]);

  const handleFlashcardsFromCurrentChat = useCallback(() => {
    setIsFeaturesPopoverOpen(false); // Close menu
    if (!activeChat) {
        alert("Hãy bắt đầu một cuộc trò chuyện trước.");
        return;
    }

    const chatContent = activeChat.messages
      .filter(m => m.text) // only messages with text
      .slice(0, -1) // Exclude the current empty model message if it exists
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`)
      .join('\n\n');

    if (!chatContent) {
      alert("Không có đủ nội dung trong cuộc trò chuyện để tóm tắt.");
      return;
    }
    
    // STRICT PROMPT FOR JSON
    const prompt = `Dựa trên nội dung cuộc trò chuyện trên, hãy tạo danh sách Flashcard tóm tắt các ý chính.
    
    QUY TẮC QUAN TRỌNG (BẮT BUỘC TUÂN THỦ):
    1. Output PHẢI là một khối mã JSON với nhãn \`flashcard_json\`.
    2. KHÔNG trả về bảng markdown. KHÔNG trả về danh sách gạch đầu dòng.
    3. Cấu trúc JSON:
    \`\`\`flashcard_json
    [
      {"term": "Thuật ngữ 1", "definition": "Định nghĩa 1"},
      {"term": "Câu hỏi 2", "definition": "Câu trả lời 2"}
    ]
    \`\`\`
    `;
    
    handleSendMessage(prompt, [], { modeOverride: 'flashcard' });
  }, [activeChat, handleSendMessage]);

  const handleNewChat = useCallback(async (initialMode: Mode = 'chat', initialMessage?: Message) => {
    if (!currentUser) return;
    
    let welcomeText = "Xin chào! Tôi là KL AI. Tôi có thể giúp gì cho bạn hôm nay?";
    let title = 'Đoạn chat mới';

    switch (initialMode) {
        case 'create_exam': title = 'Tạo đề thi'; welcomeText = 'Chế độ Tạo Đề Thi đã được kích hoạt. Hãy cho tôi biết chủ đề, số lượng câu hỏi và độ khó bạn muốn.'; break;
        case 'solve_exam': title = 'Giải đề'; welcomeText = 'Chế độ Giải Đề đã sẵn sàng. Vui lòng tải lên ảnh hoặc dán nội dung đề bài vào đây.'; break;
        case 'grader': title = 'Chấm bài'; welcomeText = 'Chế độ Chấm Bài đã bật. Hãy tải lên hình ảnh bài làm của học sinh để tôi chấm điểm và nhận xét.'; break;
        case 'chat_document': title = 'Chat với Tài liệu'; welcomeText = 'Chế độ Chat với Tài liệu. Hãy đính kèm file PDF, TXT... và đặt câu hỏi về nội dung bên trong.'; break;
        case 'data_analysis': title = 'Phân tích Dữ liệu'; welcomeText = 'Chế độ Phân tích Dữ liệu. Hãy tải lên file Excel/CSV và yêu cầu tôi phân tích hoặc vẽ biểu đồ.'; break;
        case 'create_schedule': title = 'Lập lịch học'; welcomeText = 'Chế độ Lập Lịch Học. Cung cấp các môn học, thời gian rảnh và mục tiêu của bạn để tôi tạo thời gian biểu.'; break;
        case 'learn': title = 'Học tập'; welcomeText = 'Chế độ Học Tập. Hãy bắt đầu với một chủ đề bạn muốn tìm hiểu sâu hơn.'; break;
        case 'exam': title = 'Thi thử'; welcomeText = 'Chế độ Thi Thử. Hãy cho tôi biết môn học và dạng bài bạn muốn luyện tập.'; break;
        case 'theory': title = 'Hệ thống Lý thuyết'; welcomeText = 'Chế độ Lý Thuyết. Bạn muốn tôi hệ thống lại kiến thức về chủ đề nào?'; break;
        case 'flashcard': title = 'Tạo Flashcard'; welcomeText = 'Chế độ Flashcard. Cung cấp chủ đề hoặc danh sách các thuật ngữ để tôi tạo bộ thẻ học cho bạn.'; break;
        case 'mind_map': title = 'Sơ đồ tư duy'; welcomeText = 'Chế độ Sơ đồ Tư duy. Hãy nhập chủ đề chính và tôi sẽ phác thảo sơ đồ cho bạn.'; break;
        case 'scramble_exam': title = 'Trộn đề'; welcomeText = 'Chế độ Trộn Đề. Vui lòng cung cấp đề gốc để tôi tạo ra các phiên bản khác nhau.'; break;
        case 'similar_exam': title = 'Tạo đề tương tự'; welcomeText = 'Chế độ Tạo Đề Tương Tự. Gửi cho tôi một đề bài và tôi sẽ tạo một đề mới với cấu trúc và độ khó tương đương.'; break;
        case 'create_file': title = 'Tạo file'; welcomeText = 'Chế độ Tạo File. Bạn muốn tôi tạo file gì? (Văn bản, code, v.v...)'; break;
        case 'generate_image': title = 'Tạo ảnh AI'; welcomeText = 'Chế độ Tạo Ảnh AI. Hãy mô tả chi tiết hình ảnh bạn muốn tạo.'; break;
        case 'rpg': title = 'Game Nhập Vai'; welcomeText = "Chào mừng lữ khách! Bạn muốn phiêu lưu trong bối cảnh nào (Trung cổ, Cyberpunk, Kiếm hiệp...)?"; break;
        case 'roast': title = 'Chế độ Mỏ Hỗn'; welcomeText = "Ồ, lại thêm một kẻ muốn nghe sự thật trần trụi à? Được thôi, nói gì đi nào."; break;
        case 'akinator': title = 'Thần đèn Akinator'; welcomeText = "Ta là Thần đèn Akinator. Hãy nghĩ về một nhân vật và ta sẽ đoán ra. Sẵn sàng chưa?"; break;
        case 'mbti': title = 'Trắc nghiệm MBTI'; welcomeText = "Chào bạn. Hãy bắt đầu bài trắc nghiệm tính cách MBTI nhé. Bạn sẵn sàng chưa?"; break;
    }

    const welcomeMessage: Message = { role: 'model', text: welcomeText, mode: initialMode };

    const newId = Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: title,
      messages: initialMessage ? [initialMessage] : [welcomeMessage],
      isPinned: false,
    };

    if (initialMessage && initialMessage.role === 'user') {
        newChat.messages.push({ role: 'model', text: '', timestamp: new Date().toISOString(), mode: initialMode });
    }

    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    setMode(initialMode);
    setIsMobileSidebarOpen(false);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const systemInstruction = getSystemInstruction(currentUser?.aiRole, currentUser?.aiTone, currentUser?.customInstruction, initialMode);
        const chatInstance = ai.chats.create({
            model: MODEL_NAME,
            config: { systemInstruction },
        });
        chatInstances.current[newChat.id] = chatInstance;

        if (initialMessage && initialMessage.role === 'user') {
            setIsLoading(true);
            chatInstance.sendMessageStream({ message: [{ text: initialMessage.text }] }).then(async (result) => {
                 let fullText = '';
                 for await (const chunk of result) {
                     if (chunk.text) fullText += chunk.text;
                     setChatSessions(prev => prev.map(chat => {
                         if (chat.id !== newChat.id) return chat;
                         const msgs = [...chat.messages];
                         const last = { ...msgs[msgs.length - 1] };
                         if (last.role === 'model') last.text = fullText;
                         msgs[msgs.length - 1] = last;
                         return { ...chat, messages: msgs };
                     }));
                 }
            }).catch(err => {
                console.error("Initial response failed", err);
                setChatSessions(prev => prev.map(chat => {
                    if (chat.id !== newChat.id) return chat;
                    const msgs = [...chat.messages];
                    const last = { ...msgs[msgs.length - 1] };
                    last.isError = true;
                    last.text = "Đã có lỗi xảy ra.";
                    msgs[msgs.length - 1] = last;
                    return { ...chat, messages: msgs };
                }));
            }).finally(() => setIsLoading(false));
        }
    } catch (error) {
        console.error("Failed to initialize chat instance", error);
    }

    if (!currentUser.isDemo) {
        api.saveChatSession(currentUser.username, newChat).catch(err => console.error("Background save failed", err));
    }

  }, [currentUser]);

  const menuItems = [
      { id: 'chat', label: 'Trò chuyện', icon: <UserIcon className="w-5 h-5" /> },
      { id: 'chat_document', label: 'Chat tài liệu', icon: <DocumentSearchIcon className="w-5 h-5 text-blue-500" /> },
      { id: 'data_analysis', label: 'Phân tích Dữ liệu', icon: <ChartIcon className="w-5 h-5 text-teal-500" /> },
      { id: 'generate_image', label: 'Tạo ảnh AI', icon: <MagicIcon className="w-5 h-5 text-purple-500" /> },
      { id: 'whiteboard', label: 'Bảng trắng', icon: <PresentationIcon className="w-5 h-5 text-blue-500" />, action: () => setIsWhiteboardOpen(true) },
      { id: 'probability', label: 'Xác suất', icon: <DiceIcon className="w-5 h-5 text-indigo-500" />, action: () => setIsProbabilitySimOpen(true) },
      { id: 'grader', label: 'Chấm bài', icon: <GraderIcon className="w-5 h-5 text-green-600" /> },
      { id: 'create_exam', label: 'Tạo đề thi', icon: <CreateExamIcon className="w-5 h-5" /> },
      { id: 'solve_exam', label: 'Giải đề', icon: <SolveExamIcon className="w-5 h-5" /> },
      { id: 'create_schedule', label: 'Lập lịch', icon: <CreateScheduleIcon className="w-5 h-5" /> },
      { id: 'learn', label: 'Học tập', icon: <LearnModeIcon className="w-5 h-5" /> },
      { id: 'exam', label: 'Thi thử', icon: <ExamModeIcon className="w-5 h-5" /> },
      { id: 'theory', label: 'Lý thuyết', icon: <TheoryModeIcon className="w-5 h-5" /> },
      { id: 'flashcard', label: 'Tạo Flashcard', icon: <FlashcardIcon className="w-5 h-5" /> },
      { id: 'flashcard_from_chat', label: 'Flashcard từ Chat', icon: <MagicIcon className="w-5 h-5 text-purple-500"/>, action: handleFlashcardsFromCurrentChat },
      { id: 'mind_map', label: 'Sơ đồ tư duy', icon: <MindMapIcon className="w-5 h-5" /> },
      { id: 'scramble_exam', label: 'Trộn đề', icon: <ShuffleIcon className="w-5 h-5" /> },
      { id: 'similar_exam', label: 'Đề tương tự', icon: <CloneIcon className="w-5 h-5" /> },
      { id: 'create_file', label: 'Tạo file', icon: <CreateFileIcon className="w-5 h-5" /> },
      
      // Tools
      { id: 'calculator', label: 'Máy tính', icon: <CalculatorIcon className="w-5 h-5 text-orange-500"/>, action: () => setIsCalculatorOpen(true) },
      { id: 'periodic_table', label: 'Bảng tuần hoàn', icon: <PeriodicTableIcon className="w-5 h-5 text-green-500"/>, action: () => setIsPeriodicTableOpen(true) },
      { id: 'formula_notebook', label: 'Sổ công thức', icon: <NotebookIcon className="w-5 h-5 text-red-500"/>, action: () => setIsFormulaNotebookOpen(true) },
      { id: 'unit_converter', label: 'Đổi đơn vị', icon: <ScaleIcon className="w-5 h-5 text-cyan-500"/>, action: () => setIsUnitConverterOpen(true) },
      { id: 'pomodoro', label: 'Pomodoro', icon: <TimerIcon className="w-5 h-5 text-red-400"/>, action: () => setIsPomodoroOpen(true) },
  ];
  
  const toolsIds = ['whiteboard', 'probability', 'calculator', 'periodic_table', 'formula_notebook', 'unit_converter', 'pomodoro'];
  const toolItems = menuItems.filter(m => toolsIds.includes(m.id));
  // Items with an action that are not just opening a tool are now handled as modes with actions
  const modeItems = menuItems.filter(m => !toolsIds.includes(m.id));

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

  // Sync mode with active chat to ensure UI is always correct when switching chats
  useEffect(() => {
      if (!activeChatId) return;
      const chat = chatSessions.find(c => c.id === activeChatId);
      if (chat && chat.messages.length > 0) {
          // Find the last message that has a mode defined, starting from the end.
          const lastMessageWithMode = [...chat.messages].reverse().find(msg => msg.mode);
          const chatMode = lastMessageWithMode?.mode || 'chat'; // Default to 'chat'

          if (chatMode !== mode) {
              setMode(chatMode);
          }
      } else if (!chat && chatSessions.length > 0) {
          // If active chat is gone (e.g., deleted), switch to the first available chat
          setActiveChatId(chatSessions[0].id);
      }
  }, [activeChatId, chatSessions, mode]);

  const handleUpdateUserInternal = async (updates: Partial<User>) => {
      if (!currentUser) return false;
      try {
          await onUpdateUser(updates);
          
          if (updates.aiRole || updates.aiTone || updates.customInstruction !== undefined) {
               const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
               const systemInstruction = getSystemInstruction(
                   updates.aiRole || currentUser.aiRole, 
                   updates.aiTone || currentUser.aiTone, 
                   updates.customInstruction !== undefined ? updates.customInstruction : currentUser.customInstruction
               );
               
               chatSessions.forEach(session => {
                   const chatHistory = session.messages
                       .map(mapMessageToHistory)
                       .filter((content): content is { role: Role; parts: any[] } => content !== null);
                    
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
    setMindMapModalState(prev => prev ? { ...prev, data: newData } : null);
  };

  const handleCreateNewMindMap = (newData: MindMapNode) => {
    if (!activeChatId) return;
    
    if (chatInstances.current[activeChatId]) {
        delete chatInstances.current[activeChatId];
    }

    setChatSessions(prev => 
        prev.map(chat => {
            if (chat.id !== activeChatId) return chat;
            
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
      // Check for Demo User before opening settings
      if (currentUser?.isDemo) {
          setShowLoginPromptModal(true);
          return;
      }
      setIsSettingsOpen(true);
  };
  
  const handleWhiteboardCapture = (imageData: string) => {
      const base64Data = imageData.split(',')[1];
      handleSendMessage("Hãy giải bài toán hoặc phân tích hình ảnh này.", [{
          name: 'whiteboard_drawing.png',
          data: base64Data,
          mimeType: 'image/png'
      }]);
      setIsWhiteboardOpen(false);
  };

  // Entertainment Menu Handler
  const handleEntertainmentSelect = (selected: Mode | 'breathing') => {
      // DO NOT CLOSE MENU HERE ON MOBILE
      // The user will close it manually.
      // For desktop (hover), the popover behavior handles closing via click outside.
      
      if (selected === 'breathing') {
          setIsBreathingOpen(true);
      } else if (selected === 'tarot') {
          setIsTarotOpen(true);
      } else {
          handleNewChat(selected);
      }
  };

  const handleTarotReading = (cardName: string, question: string) => {
      // Start new chat in 'tarot' mode with the context
      const initialMessage: Message = {
          role: 'user',
          text: `Tôi vừa rút được lá bài Tarot: "${cardName}". Vấn đề của tôi là: "${question}". Hãy giải mã lá bài này và đưa ra lời khuyên cho tôi.`,
          mode: 'tarot',
          timestamp: new Date().toISOString()
      };
      handleNewChat('tarot', initialMessage);
  };


  const handleDeleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUser) return;

      const newSessions = chatSessions.filter(c => c.id !== chatId);
      setChatSessions(newSessions);
      
      if (!currentUser.isDemo) {
          await api.deleteChatSession(currentUser.username, chatId);
      }

      if (newSessions.length === 0) {
          handleNewChat();
      } else if (activeChatId === chatId) {
          setActiveChatId(newSessions[0].id);
      }
  }, [currentUser, chatSessions, activeChatId, handleNewChat]);
  
  const togglePin = useCallback(async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUser) return;

      let updatedSession: ChatSession | undefined;
      const newSessions = chatSessions.map(c => {
          if (c.id === chatId) {
              updatedSession = { ...c, isPinned: !c.isPinned };
              return updatedSession;
          }
          return c;
      });
      setChatSessions(newSessions);
      
      if (updatedSession && !currentUser.isDemo) {
          await api.saveChatSession(currentUser.username, updatedSession);
      }
  }, [currentUser, chatSessions]);


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
          
          {currentUser.isDemo && (
            <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                <div className="flex justify-between text-xs font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                    <span>Dùng thử miễn phí</span>
                    <span>{DEMO_MESSAGE_LIMIT - demoMessageCount}/{DEMO_MESSAGE_LIMIT}</span>
                </div>
                <div className="w-full bg-yellow-500/20 rounded-full h-1.5">
                    <div 
                        className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${((DEMO_MESSAGE_LIMIT - demoMessageCount) / DEMO_MESSAGE_LIMIT) * 100}%` }}
                    ></div>
                </div>
            </div>
          )}

          <div className="p-3">
              <button 
                  onClick={() => handleNewChat()}
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
      <aside className="hidden md:block w-72 lg:w-80 flex-shrink-0 bg-sidebar/50 backdrop-blur-md border-r border-border transition-all duration-300">
        {renderSidebar()}
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-3/4 max-w-xs bg-card shadow-2xl transform transition-transform duration-300 ease-out">
            {renderSidebar()}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-full relative min-w-0">
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
                 {/* Tools moved to header for quick access */}
                 <button onClick={() => setIsCalculatorOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Máy tính">
                     <CalculatorIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setIsPeriodicTableOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Bảng tuần hoàn">
                     <PeriodicTableIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setIsFormulaNotebookOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Sổ tay công thức">
                     <NotebookIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setIsUnitConverterOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Đổi đơn vị">
                     <ScaleIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setIsPomodoroOpen(true)} className="p-2 text-text-secondary hover:bg-sidebar rounded-lg transition-colors hidden sm:block" title="Pomodoro Timer">
                     <TimerIcon className="w-5 h-5" />
                 </button>
                 
                 <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block"></div>
                 
                 {/* Entertainment Menu */}
                 <div className="relative" ref={entertainmentPopoverRef}>
                     <button 
                        ref={entertainmentButtonRef}
                        onClick={() => setIsEntertainmentPopoverOpen(!isEntertainmentPopoverOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isEntertainmentPopoverOpen ? 'bg-purple-500/10 text-purple-500' : 'text-text-secondary hover:bg-sidebar'}`}
                        title="Giải trí & Chữa lành"
                     >
                         <GamepadIcon className="w-5 h-5" />
                         <span className="hidden sm:inline text-sm font-medium">Giải trí</span>
                     </button>

                     {isEntertainmentPopoverOpen && (
                         <div className="hidden sm:flex absolute z-50 bg-card border border-border shadow-xl p-0 animate-slide-in-up bottom-auto top-full left-auto right-0 mt-2 rounded-xl overflow-hidden">
                             <React.Suspense fallback={<div className="p-4 text-center text-xs text-text-secondary">Đang tải menu...</div>}>
                                <EntertainmentMenu onSelect={handleEntertainmentSelect} />
                             </React.Suspense>
                         </div>
                     )}
                 </div>

                 <div className="relative" ref={featuresPopoverRef}>
                      <button 
                        ref={featuresButtonRef}
                        onClick={() => setIsFeaturesPopoverOpen(!isFeaturesPopoverOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isFeaturesPopoverOpen ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-sidebar'}`}
                      >
                          <FeaturesIcon className="w-5 h-5" />
                          <span className="hidden sm:inline text-sm font-medium">Chế độ</span>
                      </button>
                      
                      {/* Desktop Menu (Dropdown) */}
                      {isFeaturesPopoverOpen && (
                          <div className="hidden sm:flex absolute z-50 bg-card border border-border shadow-xl p-2 animate-slide-in-up bottom-auto top-full left-auto right-0 mt-2 w-64 rounded-xl flex-col gap-1 max-h-[60vh] overflow-y-auto origin-top-right scrollbar-thin scrollbar-thumb-border">
                              {modeItems.map((m) => (
                                  <button
                                      key={m.id}
                                      onClick={() => { 
                                          if (m.action) {
                                              m.action();
                                          } else {
                                              handleNewChat(m.id as Mode);
                                          }
                                          setIsFeaturesPopoverOpen(false); 
                                      }}
                                      className={`
                                          w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors justify-start flex-shrink-0
                                          ${mode === m.id && !m.action ? 'bg-brand text-white shadow-md' : 'text-text-secondary hover:bg-sidebar hover:text-text-primary bg-transparent'}
                                      `}
                                  >
                                      <div className="flex-shrink-0">{m.icon}</div>
                                      <span className="truncate">{m.label}</span>
                                  </button>
                              ))}
                          </div>
                      )}
                 </div>
            </div>
        </header>

        {/* Mobile Menu Portal (Bottom Sheet) */}
        {isFeaturesPopoverOpen && createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsFeaturesPopoverOpen(false)} />
                <div className="mobile-menu-content relative bg-card border-t border-border rounded-t-3xl p-5 shadow-2xl animate-slide-in-up max-h-[85vh] overflow-y-auto flex flex-col">
                   {/* Handle bar with Close Button */}
                   <div className="flex items-center justify-between mb-4 flex-shrink-0">
                       <h3 className="text-lg font-bold">Menu Chức năng</h3>
                       <button 
                           onClick={() => setIsFeaturesPopoverOpen(false)}
                           className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors font-bold text-sm flex items-center gap-1"
                       >
                           <XIcon className="w-4 h-4" /> Đóng
                       </button>
                   </div>
                   
                   <div className="overflow-y-auto pb-8 space-y-6">
                      <div>
                          <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 px-1">Chế độ chính</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {modeItems.map(m => (
                                <button
                                    key={m.id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (m.action) {
                                            m.action();
                                        } else {
                                            handleNewChat(m.id as Mode);
                                        }
                                        setIsFeaturesPopoverOpen(false);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all active:scale-95
                                        ${mode === m.id && !m.action
                                            ? 'bg-brand/10 border-brand text-brand font-semibold shadow-sm' 
                                            : 'bg-input-bg border-transparent hover:bg-sidebar text-text-secondary'}
                                    `}
                                >
                                    <div className={`p-2 rounded-full ${mode === m.id && !m.action ? 'bg-brand text-white' : 'bg-card text-current'}`}>
                                        {m.icon}
                                    </div>
                                    <span className="text-sm truncate w-full text-center">{m.label}</span>
                                </button>
                            ))}
                          </div>
                      </div>

                      <div>
                          <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 px-1">Công cụ học tập</h4>
                          <div className="grid grid-cols-2 gap-3">
                             {toolItems.map(m => (
                                <button
                                    key={m.id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (m.action) m.action();
                                        setIsFeaturesPopoverOpen(false);
                                    }}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-input-bg hover:bg-sidebar border border-transparent text-text-secondary transition-all active:scale-95"
                                >
                                    <div className="p-2 rounded-full bg-card text-current">
                                        {m.icon}
                                    </div>
                                    <span className="text-sm truncate w-full text-center">{m.label}</span>
                                </button>
                             ))}
                          </div>
                      </div>
                   </div>
                </div>
            </div>,
            document.body
        )}

        {/* Mobile Entertainment Menu */}
        {isEntertainmentPopoverOpen && createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsEntertainmentPopoverOpen(false)} />
                <div className="mobile-menu-content relative bg-card border-t border-border rounded-t-3xl p-5 shadow-2xl animate-slide-in-up max-h-[75vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold">Giải trí & Chữa lành</h3>
                       <button 
                           onClick={() => setIsEntertainmentPopoverOpen(false)}
                           className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors font-bold text-sm flex items-center gap-1"
                       >
                           <XIcon className="w-4 h-4" /> Đóng
                       </button>
                   </div>
                   
                   <div className="pb-8">
                        <React.Suspense fallback={<div className="p-4 text-center text-xs text-text-secondary">Đang tải menu...</div>}>
                            <EntertainmentMenu onSelect={handleEntertainmentSelect} />
                        </React.Suspense>
                   </div>
                </div>
            </div>,
            document.body
        )}

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
                            // This callback is for old markdown text parsing if needed, 
                            // but we now support structured JSON which is handled inside ChatMessage via buttons
                        }}
                        onOpenFlashcards={(cards) => setFlashcardData(cards)}
                        onOpenMindMap={(data) => setMindMapModalState({ data, messageIndex: idx })}
                        onAskSelection={(text) => handleSendMessage(`Giải thích giúp tôi đoạn này: "${text}"`)}
                        onRegenerate={idx === activeChat.messages.length - 1 && msg.role === 'model' ? () => {
                             const lastUserMsgIndex = activeChat.messages.length - 2;
                             if (lastUserMsgIndex >= 0) {
                                 const lastUserMsg = activeChat.messages[lastUserMsgIndex];
                                 setChatSessions(prev => prev.map(c => {
                                     if (c.id !== activeChatId) return c;
                                     return { ...c, messages: c.messages.slice(0, -1) };
                                 }));
                                 handleSendMessage(lastUserMsg.text, []);
                             }
                        } : undefined}
                        userAvatar={currentUser.avatar}
                    />
                ))}
                {isLoading && <TypingIndicator />}
                <div className="h-4" />
            </div>
        </div>

        <div className="flex-shrink-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border z-20">
            <div className="max-w-3xl mx-auto">
                <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading}
                    placeholder={
                        mode === 'flashcard' ? "Nhập chủ đề để tạo flashcard (VD: 10 từ vựng IT)..." :
                        mode === 'generate_image' ? "Mô tả hình ảnh bạn muốn vẽ..." :
                        mode === 'create_exam' ? "Nhập chủ đề, số lượng câu hỏi, độ khó..." :
                        mode === 'solve_exam' ? "Chụp ảnh hoặc dán nội dung đề bài..." :
                        mode === 'grader' ? "📸 Tải lên ảnh bài làm để chấm điểm..." :
                        mode === 'chat_document' ? "📎 Đính kèm PDF và đặt câu hỏi..." :
                        mode === 'data_analysis' ? "📎 Tải lên Excel/CSV để phân tích..." :
                        mode === 'create_schedule' ? "Nhập mục tiêu, thời gian rảnh, môn học..." :
                        mode === 'rpg' ? "Nhập hành động của bạn..." :
                        mode === 'roast' ? "Nói gì đó để bị 'khịa'..." :
                        mode === 'akinator' ? "Trả lời (Có/Không/Không chắc)..." :
                        mode === 'tarot' ? "Hỏi về tình yêu, sự nghiệp..." :
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
                    accept={mode === 'chat_document' ? ".pdf,.txt,.csv,.json" : mode === 'data_analysis' ? ".csv,.xlsx,.xls" : "image/*"}
                />
                <p className="text-xs text-center text-text-secondary mt-2 opacity-70">
                    KL AI có thể mắc lỗi. Hãy kiểm chứng thông tin quan trọng.
                </p>
            </div>
        </div>
      </main>
      
      {/* Lofi Player Widget - Wrapped in local Suspense to avoid crashing/flashing the whole app if lazy loaded */}
      <React.Suspense fallback={null}>
        <LofiPlayer />
      </React.Suspense>
        
        {isSettingsOpen && (
            <React.Suspense fallback={null}>
                <SettingsModal 
                    user={currentUser} 
                    onClose={() => setIsSettingsOpen(false)} 
                    onUpdateUser={handleUpdateUserInternal}
                />
            </React.Suspense>
        )}
        
        {flashcardData && (
            <React.Suspense fallback={null}>
                <FlashcardView 
                    cards={flashcardData} 
                    onClose={() => setFlashcardData(null)} 
                />
            </React.Suspense>
        )}
        
        {mindMapModalState && (
            <React.Suspense fallback={null}>
                <MindMapModal
                    data={mindMapModalState.data}
                    onClose={() => setMindMapModalState(null)}
                    onCreateNewMindMap={handleCreateNewMindMap}
                    onSave={handleSaveMindMap}
                />
            </React.Suspense>
        )}

        {isCalculatorOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Máy tính khoa học" onClose={() => setIsCalculatorOpen(false)}>
                    <Calculator />
                </ToolModal>
             </React.Suspense>
        )}

        {isPeriodicTableOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Bảng tuần hoàn" onClose={() => setIsPeriodicTableOpen(false)} initialSize={{width: 800, height: 500}}>
                    <PeriodicTable />
                </ToolModal>
             </React.Suspense>
        )}
        
        {isWhiteboardOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Bảng trắng tương tác" onClose={() => setIsWhiteboardOpen(false)} initialSize={{width: 800, height: 600}}>
                    <Whiteboard onCapture={handleWhiteboardCapture} />
                </ToolModal>
             </React.Suspense>
        )}

        {isPomodoroOpen && (
             <React.Suspense fallback={null}>
                <PomodoroTimer onClose={() => setIsPomodoroOpen(false)} />
             </React.Suspense>
        )}

        {isUnitConverterOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Chuyển đổi đơn vị" onClose={() => setIsUnitConverterOpen(false)} initialSize={{width: 400, height: 500}}>
                    <UnitConverter />
                </ToolModal>
             </React.Suspense>
        )}

        {isProbabilitySimOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Mô phỏng xác suất" onClose={() => setIsProbabilitySimOpen(false)} initialSize={{width: 400, height: 500}}>
                    <ProbabilitySim />
                </ToolModal>
             </React.Suspense>
        )}

        {isFormulaNotebookOpen && (
             <React.Suspense fallback={null}>
                <ToolModal title="Sổ tay công thức" onClose={() => setIsFormulaNotebookOpen(false)} initialSize={{width: 500, height: 600}}>
                    <FormulaNotebook />
                </ToolModal>
             </React.Suspense>
        )}
        
        {isBreathingOpen && (
             <React.Suspense fallback={null}>
                <BreathingExercise onClose={() => setIsBreathingOpen(false)} />
             </React.Suspense>
        )}

        {isTarotOpen && (
             <React.Suspense fallback={null}>
                <TarotReader 
                    onClose={() => setIsTarotOpen(false)} 
                    onReadingRequest={handleTarotReading} 
                />
             </React.Suspense>
        )}

        {/* Demo Limit Modal */}
        {showDemoLimitModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-message-pop-in">
                    <div className="flex justify-center mb-4">
                         <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                            <LockIcon className="w-8 h-8 text-red-500" />
                         </div>
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">Hết lượt dùng thử</h2>
                    <p className="text-center text-text-secondary mb-6 text-sm">
                        Bạn đã sử dụng hết <b>{DEMO_MESSAGE_LIMIT}</b> tin nhắn miễn phí. <br/>
                        Vui lòng đăng ký tài khoản để tiếp tục sử dụng không giới hạn và lưu lại lịch sử.
                    </p>
                    <div className="flex flex-col gap-3">
                         <button 
                            onClick={() => {
                                setShowDemoLimitModal(false);
                                onLogout(); 
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

        {/* Login Prompt Modal (Settings Access) */}
        {showLoginPromptModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-message-pop-in">
                    <div className="flex justify-center mb-4">
                         <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center">
                            <SettingsIcon className="w-8 h-8 text-brand" />
                         </div>
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">Tính năng nâng cao</h2>
                    <p className="text-center text-text-secondary mb-6 text-sm">
                        Cài đặt cá nhân hóa, lưu trữ lịch sử và đồng bộ đám mây chỉ dành cho thành viên chính thức.
                    </p>
                    <div className="flex flex-col gap-3">
                         <button 
                            onClick={() => {
                                setShowLoginPromptModal(false);
                                onLogout(); 
                            }}
                            className="w-full py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                         >
                             Đăng nhập / Đăng ký
                         </button>
                         <button 
                            onClick={() => setShowLoginPromptModal(false)}
                            className="w-full py-3 bg-sidebar hover:bg-card-hover text-text-primary font-semibold rounded-xl transition-colors"
                         >
                             Đóng
                         </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ChatInterface;
