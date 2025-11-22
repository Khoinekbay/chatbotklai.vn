
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenAI, Chat } from '@google/genai';
import { type Message, type ChatSession, type User, type MindMapNode, type Mode, type FollowUpAction, type Role, type Flashcard } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { CreateExamIcon, SolveExamIcon, CreateScheduleIcon, NewChatIcon, KlAiLogo, UserIcon, LogoutIcon, EditIcon, SearchIcon, PinIcon, LearnModeIcon, ExamModeIcon, DownloadIcon, SunIcon, MoonIcon, TheoryModeIcon, MenuIcon, FeaturesIcon, ShuffleIcon, CloneIcon, CalculatorIcon, PeriodicTableIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CreateFileIcon, MindMapIcon, TrashIcon, SettingsIcon, MoreHorizontalIcon, KeyIcon, MagicIcon, PresentationIcon, GraderIcon, DocumentSearchIcon, TimerIcon, ChartIcon, LockIcon, ScaleIcon, DiceIcon, NotebookIcon, GamepadIcon, XIcon, FlashcardIcon, WrenchIcon, RoadmapIcon } from './Icons';
import { api } from '../utils/api';

// Lazy load heavy components
const SettingsModal = React.lazy(() => import('./SettingsModal'));
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
const EducationMenu = React.lazy(() => import('./EducationMenu'));
const FlashcardView = React.lazy(() => import('./FlashcardView'));

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
     if (currentMode === 'mind_map') {
        return `Bạn là một chuyên gia tạo sơ đồ tư duy. Khi người dùng cung cấp một chủ đề, hãy tạo ra một cấu trúc sơ đồ tư duy dưới dạng danh sách markdown (dùng dấu - hoặc *). Các mục con phải được lùi vào trong.`;
    }
    if (currentMode === 'flashcard') {
        return `Bạn là một công cụ tạo Flashcard học từ vựng chuyên nghiệp (Anh-Việt).
Nhiệm vụ: Tự động tạo danh sách các từ vựng dựa trên chủ đề người dùng yêu cầu.
QUAN TRỌNG: Bạn BẮT BUỘC phải trả về dữ liệu dưới dạng một JSON block chứa mảng các object. Mỗi object có 3 trường: 
- 'term': Từ vựng gốc (Tiếng Anh).
- 'translation': Nghĩa tiếng Việt ngắn gọn.
- 'definition': Ví dụ minh họa hoặc giải thích thêm (Optional, ngắn gọn).

Ví dụ:
\`\`\`json
[
  {"term": "Apple", "translation": "Quả táo", "definition": "A red fruit often eaten as a snack."},
  {"term": "Run", "translation": "Chạy", "definition": "Move at a speed faster than a walk."}
]
\`\`\`
Ngoài ra, bạn có thể giải thích thêm một chút bên ngoài block JSON. Hãy đảm bảo JSON hợp lệ.`;
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
    if (currentMode === 'numerology') {
        return `Bạn là chuyên gia Thần số học (Numerology) sâu sắc và tận tâm. Nhiệm vụ của bạn là tính toán các con số chủ đạo, đường đời, linh hồn... từ Tên và Ngày sinh người dùng cung cấp. Hãy giải thích chi tiết ý nghĩa các con số, điểm mạnh, điểm yếu và lời khuyên phát triển bản thân. Giọng văn chiêm nghiệm, tích cực.`;
    }
    if (currentMode === 'dream_interpreter') {
        return `Bạn là chuyên gia giải mã giấc mơ, am hiểu cả tâm lý học (Freud/Jung) và quan niệm dân gian/tâm linh Á Đông. Khi người dùng kể về giấc mơ, hãy phân tích các biểu tượng, sự kiện để tìm ra thông điệp tiềm thức hoặc điềm báo. Đưa ra lời khuyên trấn an hoặc cảnh báo nhẹ nhàng.`;
    }
    if (currentMode === 'caption_gen') {
        return `Bạn là một Content Creator và Social Media Manager cực kỳ bắt trend (Gen Z style). Nhiệm vụ của bạn là viết caption (status) cho Facebook, Instagram, TikTok dựa trên mô tả hoặc ảnh của người dùng. Hãy đưa ra nhiều lựa chọn: Hài hước, So deep, Thả thính, Ngầu... Kèm theo các hashtag # phù hợp và emoji sinh động.`;
    }
    if (currentMode === 'face_reading') {
        return `Bạn là một chuyên gia nhân tướng học AI. Nhiệm vụ của bạn là phân tích khuôn mặt từ ảnh người dùng gửi lên. Hãy nhận xét về các đặc điểm như trán, mắt, mũi, miệng, cằm... và từ đó suy đoán vui về tính cách, sự nghiệp, tình duyên. Giọng văn có chút 'thầy bói', huyền bí nhưng tích cực và hài hước. Nếu ảnh không có mặt người, hãy yêu cầu gửi lại ảnh rõ mặt.`;
    }
    if (currentMode === 'debate') {
        return `Bạn là một đối thủ tranh biện cực kỳ sắc sảo. Người dùng sẽ đưa ra một quan điểm. Nhiệm vụ của bạn là CHỌN PHE ĐỐI LẬP và đưa ra các luận điểm phản biện gay gắt, logic để bẻ lại người dùng. Hãy thách thức tư duy của họ. Cuối cùng, chấm điểm khả năng lập luận của họ trên thang 10.`;
    }
    if (currentMode === 'mystery') {
        return `Bạn là Quản trò (Game Master) của trò chơi 'Black Stories' (Thám tử tâm linh). 
        1. Bắt đầu: Hãy đưa ra một câu đố về một vụ án hoặc cái chết bí ẩn (chỉ đưa ra kết quả kỳ lạ, không đưa ra nguyên nhân).
        2. Gameplay: Người dùng sẽ hỏi các câu hỏi Yes/No. Bạn chỉ được trả lời 'Có', 'Không' hoặc 'Không liên quan'. 
        3. Mục tiêu: Người dùng phải tìm ra nguyên nhân vụ việc.
        4. Nếu người dùng đoán đúng cốt truyện chính, hãy chúc mừng và kể lại toàn bộ câu chuyện.
        Hãy tạo không khí rùng rợn, bí ẩn.`;
    }
    if (currentMode === 'rapper') {
        return `Bạn là một Rapper chuyên nghiệp (Underground style) với khả năng gieo vần đỉnh cao. Nhiệm vụ:
        1. Nếu người dùng yêu cầu 'Diss' ai đó: Hãy viết một đoạn Rap Diss 16 câu cực gắt, châm biếm hài hước dựa trên thông tin họ cung cấp. Dùng vần đôi, vần ba, punchline.
        2. Nếu người dùng yêu cầu Rap tán tỉnh/Love Rap: Viết lời rap ngọt ngào, 'thả thính' dính.
        Giọng văn: Bụi bặm, chất chơi, dùng từ lóng (slang) hợp lý.`;
    }
    if (currentMode === 'emoji_quiz') {
        return `Bạn là Quản trò của game 'Đuổi Hình Bắt Chữ' phiên bản Emoji.
        Luật chơi:
        1. Bạn nghĩ ra một câu Ca dao, Tục ngữ Việt Nam hoặc Tên bài hát nổi tiếng.
        2. Bạn CHỈ ĐƯỢC đưa ra một chuỗi các Emoji mô tả câu đó. KHÔNG hiện đáp án ngay.
        3. Đợi người dùng đoán.
        4. Nếu đúng: Chúc mừng và ra câu đố mới.
        5. Nếu sai: Gợi ý nhẹ hoặc cho đoán lại (tối đa 3 lần). Sau 3 lần thì giải đáp.`;
    }
    if (currentMode === 'dating_sim') {
        return `Bạn đang tham gia trò chơi 'Giả Lập Tán Tỉnh' ở độ khó Hard Mode.
        Vai trò: Bạn là một đối tượng cực kỳ khó tán (Crush lạnh lùng, Trap boy/girl, hoặc Sếp khó tính...).
        Nhiệm vụ: Trả lời tin nhắn của người dùng một cách hờ hững, 'seen' không rep, hoặc trả lời nhát gừng (ngắn gọn, lạnh nhạt).
        Điều kiện thắng: Chỉ khi người dùng nhắn một câu thực sự thông minh, hài hước hoặc tinh tế, bạn mới được phép 'mở lòng' một chút.
        Cuối cùng: Chấm điểm 'Rizz' (khả năng tán tỉnh) của người dùng.`;
    }
    if (currentMode === 'food_randomizer') {
        return `Bạn là chuyên gia ẩm thực đường phố Việt Nam. Người dùng đang đói và không biết ăn gì.
        Nhiệm vụ:
        1. Hỏi nhanh sở thích (Nước/Khô? Cay/Không? Ăn vặt/Ăn no?).
        2. Đưa ra MỘT quyết định chốt đơn dứt khoát (VD: "Đi ăn Bún Đậu Mắm Tôm ngay!").
        3. Kèm theo một câu review món ăn đó thật hấp dẫn, 'chảy nước miếng'.`;
    }
    if (currentMode === 'fashion_police') {
        return `Bạn là một Fashionista cực kỳ đanh đá, khó tính và có gu thẩm mỹ cao (kiểu giám khảo Next Top Model).
        Nhiệm vụ: Nhìn ảnh outfit người dùng gửi và nhận xét.
        - Nếu đẹp: Khen nức nở, dùng từ ngữ chuyên môn thời trang.
        - Nếu xấu hoặc bình thường: 'Khịa', châm biếm hài hước (VD: 'Cái áo này phối với quần kia nhìn như thảm họa thời trang năm 2000').
        Mục tiêu: Vừa tư vấn vừa giải trí.`;
    }
    if (currentMode === 'werewolf_moderator') {
        return `Bạn là Quản Trò (Moderator) của trò chơi Ma Sói (Werewolf).
        Nhiệm vụ: Điều phối trò chơi cho một nhóm người.
        1. Hỏi số lượng người chơi.
        2. Phân vai ngẫu nhiên (Bạn nhắn tin bảo người chơi chuyền máy để xem vai, hoặc liệt kê vai trò để họ tự bốc thăm).
        3. Điều hành Đêm: Gọi từng chức năng dậy (Sói, Tiên Tri, Bảo Vệ...) và yêu cầu người chơi nhập hành động.
        4. Điều hành Ngày: Công bố ai chết, cho mọi người thảo luận và bỏ phiếu treo cổ.
        Giọng văn: Bí ẩn, rùng rợn, kịch tính.`;
    }
    if (currentMode === 'style_transfer') {
        return `Bạn là bậc thầy ngôn ngữ 'Đa Vũ Trụ'.
        Nhiệm vụ: Người dùng sẽ nhập một câu nói bình thường. Bạn hãy viết lại câu đó theo nhiều phong cách khác nhau:
        1. Kiếm hiệp/Cổ trang.
        2. Gen Z (Teencode, slang).
        3. Văn bản hành chính/Quan liêu.
        4. Thơ lục bát.
        5. 'Chợ búa' hoặc 'Thảo mai'.
        Hãy làm cho sự chuyển đổi trở nên hài hước và đặc trưng nhất có thể.`;
    }
    if (currentMode === 'rap_battle') {
        return `Bạn đang tham gia Rap Battle đối kháng trực tiếp với người dùng.
        Luật chơi:
        1. Người dùng sẽ rap trước một câu (hoặc một đoạn).
        2. Bạn phải phân tích vần cuối (rhyme scheme) của họ.
        3. Rap lại ngay lập tức 2-4 câu để 'phản dame' (rebuttal), bắt buộc phải gieo vần đôi hoặc vần ba với câu của người dùng.
        Thái độ: Hung hăng, tự tin, 'swag', nhưng không dùng từ ngữ quá thô tục (giữ mức độ 'cháy' nhưng văn minh).`;
    }
    if (currentMode === 'roadmap') {
        return `Bạn là "Người Vẽ Lộ Trình" (Study Roadmap Generator).
        Nhiệm vụ: Xây dựng lộ trình học tập chi tiết cho người dùng dựa trên mục tiêu và trình độ hiện tại của họ.
        Yêu cầu output: Trình bày dưới dạng Markdown rõ ràng, chia theo từng Giai đoạn (Tuần/Tháng). Liệt kê cụ thể cần học gì, tài liệu nào, bài tập nào.
        Phong cách: Khuyến khích, rõ ràng, logic.`;
    }
    if (currentMode === 'socratic') {
        return `Bạn là một Gia sư theo phương pháp Socratic (Socratic Tutor).
        QUAN TRỌNG: KHÔNG BAO GIỜ đưa ra câu trả lời ngay lập tức.
        Nhiệm vụ:
        1. Khi người dùng hỏi, hãy hỏi ngược lại một câu hỏi gợi mở để hướng dẫn họ tự suy nghĩ.
        2. Chia nhỏ vấn đề thành các bước đơn giản hơn.
        3. Chỉ đưa ra gợi ý (hint) khi người dùng thực sự bế tắc.
        4. Mục tiêu là giúp người dùng hiểu sâu bản chất vấn đề.
        Ví dụ: User "Tại sao 1+1=2?". AI: "Theo em, con số 1 đại diện cho điều gì trong thực tế?"`;
    }
    if (currentMode === 'mock_oral') {
        return `Bạn là Giám khảo của Phòng Thi Ảo (Mock Oral Test).
        Vai trò: Giám khảo khó tính, chuyên nghiệp (IELTS Examiner hoặc Giáo viên Vấn đáp).
        Nhiệm vụ:
        1. Đặt câu hỏi cho thí sinh (người dùng) theo chủ đề họ chọn.
        2. CHỜ người dùng trả lời xong mới được hỏi câu tiếp theo hoặc nhận xét.
        3. Nếu người dùng trả lời quá ngắn hoặc ấp úng, hãy nhắc nhở nghiêm khắc hoặc trừ điểm.
        4. Cuối buổi (khi người dùng nói "Kết thúc"), hãy chấm điểm chi tiết về: Nội dung, Từ vựng, Ngữ pháp và Độ trôi chảy.`;
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

const parseSpecialJsonBlock = (text: string, blockName: string): any | null => {
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

const parseFlashcardsFromResponse = (text: string): Flashcard[] | null => {
    // Try to find JSON block first
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            const data = JSON.parse(jsonMatch[1]);
            if (Array.isArray(data) && data.length > 0 && data[0].term && data[0].translation) {
                return data;
            }
        } catch (e) {
            console.error("Failed to parse JSON flashcards", e);
        }
    }
    
    // Fallback: Try to find simple array [...] if no code block
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
        try {
            const data = JSON.parse(arrayMatch[0]);
            if (Array.isArray(data) && data.length > 0 && data[0].term && data[0].translation) {
                return data;
            }
        } catch(e) {}
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
  const [isEducationPopoverOpen, setIsEducationPopoverOpen] = useState(false);
  const [isToolsPopoverOpen, setIsToolsPopoverOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const [mindMapModalState, setMindMapModalState] = useState<{ data: MindMapNode, messageIndex: number } | null>(null);
  const [flashcardData, setFlashcardData] = useState<Flashcard[] | null>(null);
  
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

  const activeChat = chatSessions.find(c => c.id === activeChatId);
  const pinnedChats = chatSessions.filter(c => c.isPinned);
  const recentChats = chatSessions.filter(c => !c.isPinned).filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const chatInstances = useRef<{ [key: string]: Chat }>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const featuresPopoverRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLButtonElement>(null);
  const entertainmentPopoverRef = useRef<HTMLDivElement>(null);
  const entertainmentButtonRef = useRef<HTMLButtonElement>(null);
  const educationPopoverRef = useRef<HTMLDivElement>(null);
  const educationButtonRef = useRef<HTMLButtonElement>(null);
  const toolsPopoverRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
        setInstallPrompt(null);
    }
  };

  const menuItems = [
      { id: 'chat', label: 'Trò chuyện', icon: <UserIcon className="w-5 h-5" /> },
      { id: 'chat_document', label: 'Chat tài liệu', icon: <DocumentSearchIcon className="w-5 h-5 text-blue-500" /> },
      { id: 'data_analysis', label: 'Phân tích dữ liệu', icon: <ChartIcon className="w-5 h-5 text-teal-500" /> },
      { id: 'generate_image', label: 'Tạo ảnh AI', icon: <MagicIcon className="w-5 h-5 text-purple-500" /> },
      { id: 'whiteboard', label: 'Bảng trắng', icon: <PresentationIcon className="w-5 h-5 text-blue-500" />, action: () => setIsWhiteboardOpen(true) },
      { id: 'probability', label: 'Xác suất', icon: <DiceIcon className="w-5 h-5 text-indigo-500" />, action: () => setIsProbabilitySimOpen(true) },
      { id: 'grader', label: 'Chấm bài', icon: <GraderIcon className="w-5 h-5 text-green-600" /> },
      { id: 'create_exam', label: 'Tạo đề thi', icon: <CreateExamIcon className="w-5 h-5" /> },
      { id: 'solve_exam', label: 'Giải đề', icon: <SolveExamIcon className="w-5 h-5" /> },
      { id: 'create_schedule', label: 'Lập lịch', icon: <CreateScheduleIcon className="w-5 h-5" /> },
      { id: 'learn', label: 'Học tập', icon: <LearnModeIcon className="w-5 h-5" /> },
      { id: 'exam', label: 'Thi thử', icon: <ExamModeIcon className="w-5 h-5" /> },
      { id: 'flashcard', label: 'Học Flashcard', icon: <FlashcardIcon className="w-5 h-5 text-yellow-500" /> },
      { id: 'theory', label: 'Lý thuyết', icon: <TheoryModeIcon className="w-5 h-5" /> },
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
          const lastMessageWithMode = [...chat.messages].reverse().find(msg => msg.mode);
          const chatMode = lastMessageWithMode?.mode || 'chat';

          if (chatMode !== mode) {
              setMode(chatMode);
          }
      } else if (!chat && chatSessions.length > 0) {
          setActiveChatId(chatSessions[0].id);
      }
  }, [activeChatId, chatSessions, mode]);

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

    setChatSessions(prev =>
        prev.map(chat =>
            chat.id === activeChatId
                ? { ...chat, messages: [...chat.messages, userMessage, { role: 'model', text: '', timestamp: new Date().toISOString(), mode: finalMode }] }
                : chat
        )
    );
    setIsLoading(true);
    setError(null);
    setFlashcardData(null);

    const generateTitleIfNeeded = async (promptText: string) => {
        const activeChat = chatSessions.find(c => c.id === activeChatId);
        const isFirstUserMessage = activeChat ? activeChat.messages.filter(m => m.role === 'user').length === 0 : false;

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
                    if (activeChat && !currentUser.isDemo) {
                        await api.saveChatSession(currentUser.username, { ...activeChat, title: newTitle });
                    }
                }
            } catch (titleError) { console.error("Không thể tạo tiêu đề", titleError); }
        }
    };

    if (finalMode !== 'generate_image') {
        generateTitleIfNeeded(text);
    }

    try {
        if (finalMode === 'generate_image') {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
             let generatedImage;
             
             try {
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
                     throw fallbackErr;
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
        else {
            const activeChat = chatInstances.current[activeChatId];
            
            let messageTextToSend = text;
            let finalFiles = [...files];

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
                messageTextToSend = `BẠN LÀ MỘT GIÁO VIÊN CHẤM THI CHUYÊN NGHIỆP...\n${messageTextToSend}`;
            } else if (finalMode === 'chat_document') {
                messageTextToSend = `BẠN LÀ TRỢ LÝ PHÂN TÍCH TÀI LIỆU...\n---\nCâu hỏi: ${messageTextToSend}`;
            } else if (finalMode === 'data_analysis') {
                messageTextToSend = `PHÂN TÍCH DỮ LIỆU:\n---\nYêu cầu: ${messageTextToSend}`;
            } else if (finalMode === 'numerology') {
                messageTextToSend = `PHÂN TÍCH THẦN SỐ HỌC cho: "${text}". Tính số chủ đạo, linh hồn, thái độ... và giải thích.`;
            } else if (finalMode === 'dream_interpreter') {
                messageTextToSend = `GIẢI MÃ GIẤC MƠ: "${text}". Phân tích biểu tượng, điềm báo dân gian và góc độ tâm lý học.`;
            } else if (finalMode === 'caption_gen') {
                messageTextToSend = `VIẾT CAPTION SÁNG TẠO cho nội dung/ảnh: "${text}". Đưa ra 3 phong cách: Hài hước, Deep, Thả thính. Kèm Hashtag.`;
            } else if (finalMode === 'flashcard') {
                messageTextToSend = `Tạo bộ flashcard cho chủ đề: "${text}". Trả về JSON hợp lệ.`;
            } else if (finalMode === 'face_reading') {
                messageTextToSend = `(NHÂN TƯỚNG HỌC AI) Phân tích ảnh khuôn mặt này và đoán tính cách, vận mệnh.`;
            } else if (finalMode === 'debate') {
                messageTextToSend = `(TRANH BIỆN) Người dùng nói: "${text}". Hãy chọn phe đối lập và phản biện lại.`;
            } else if (finalMode === 'mystery') {
                messageTextToSend = `(THÁM TỬ TÂM LINH) Người dùng nói: "${text}". Hãy tiếp tục trò chơi Black Stories.`;
            } else if (finalMode === 'rapper') {
                messageTextToSend = `(RAPPER AI) Chủ đề/Đối tượng: "${text}". Hãy viết một bài Rap 16 câu cực chất.`;
            } else if (finalMode === 'emoji_quiz') {
                messageTextToSend = `(ĐUỔI HÌNH BẮT CHỮ) Người dùng đoán: "${text}". Hãy kiểm tra đáp án hoặc ra câu đố mới bằng Emoji.`;
            } else if (finalMode === 'dating_sim') {
                messageTextToSend = `(DATING SIM - HARD MODE) Người dùng nhắn: "${text}". Hãy trả lời (lạnh lùng/chảnh) và chấm điểm Rizz.`;
            } else if (finalMode === 'food_randomizer') {
                messageTextToSend = `(HÔM NAY ĂN GÌ) Người dùng đang đói: "${text}". Hãy chọn món và review nhanh.`;
            } else if (finalMode === 'fashion_police') {
                messageTextToSend = `(CẢNH SÁT THỜI TRANG) Nhìn ảnh này và nhận xét outfit thật xéo xắt hoặc khen nức nở.`;
            } else if (finalMode === 'werewolf_moderator') {
                messageTextToSend = `(QUẢN TRÒ MA SÓI) Người dùng nói: "${text}". Hãy điều phối trò chơi tiếp.`;
            } else if (finalMode === 'style_transfer') {
                messageTextToSend = `(ĐA VŨ TRỤ NGÔN NGỮ) Hãy viết lại câu này theo nhiều phong cách (Kiếm hiệp, Gen Z, Hành chính...): "${text}"`;
            } else if (finalMode === 'rap_battle') {
                messageTextToSend = `(RAP BATTLE) Tôi rap: "${text}". Hãy đối lại ngay!`;
            } else if (finalMode === 'roadmap') {
                messageTextToSend = `(LỘ TRÌNH HỌC TẬP) Mục tiêu/Trình độ: "${text}". Hãy vẽ lộ trình học tập chi tiết.`;
            } else if (finalMode === 'socratic') {
                messageTextToSend = `(SOCRATIC TUTOR) Học sinh hỏi: "${text}". Đừng trả lời ngay, hãy hỏi gợi mở.`;
            } else if (finalMode === 'mock_oral') {
                messageTextToSend = `(PHÒNG THI ẢO) Thí sinh nói: "${text}". Hãy đóng vai giám khảo và phản hồi/chấm điểm.`;
            }

            const parts: any[] = [{ text: messageTextToSend }];
            if (finalFiles.length > 0) {
                finalFiles.forEach(file => {
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

            setChatSessions(prev => 
                prev.map(chat => {
                    if (chat.id !== activeChatId) return chat;

                    const newMessages = [...chat.messages];
                    const lastMsg = { ...newMessages[newMessages.length - 1] };

                    if (finalMode === 'mind_map') {
                        const { intro, data } = parseMindMapFromResponse(fullText);
                        lastMsg.text = intro;
                        if (data) {
                            lastMsg.mindMapData = data;
                        } else if (fullText && fullText.trim().length > intro.trim().length) { 
                            lastMsg.text = fullText + "\n\n(Không thể phân tích sơ đồ tư duy. Vui lòng thử lại.)";
                            lastMsg.isError = true;
                        }
                    } else if (finalMode === 'flashcard') {
                        const flashcards = parseFlashcardsFromResponse(fullText);
                        if (flashcards) {
                            lastMsg.flashcards = flashcards;
                        }
                    } else {
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
        
        if (finalMode === 'generate_image') {
            errorMessage = "Không thể tạo ảnh. Có thể do mô tả chứa nội dung không phù hợp hoặc dịch vụ đang bận.";
            if (!process.env.API_KEY) {
                errorMessage += " (Lỗi: Thiếu API Key trong Environment Variables)";
            } else if (error.message?.includes('403')) {
                errorMessage += " (Lỗi: API Key không có quyền truy cập Imagen. Vui lòng kiểm tra cài đặt dự án Google Cloud)";
            }
        } else {
            errorMessage += "(Kiểm tra API Key của bạn hoặc định dạng file)";
        }

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
        case 'mind_map': title = 'Sơ đồ tư duy'; welcomeText = 'Chế độ Sơ đồ Tư duy. Hãy nhập chủ đề chính và tôi sẽ phác thảo sơ đồ cho bạn.'; break;
        case 'scramble_exam': title = 'Trộn đề'; welcomeText = 'Chế độ Trộn Đề. Vui lòng cung cấp đề gốc để tôi tạo ra các phiên bản khác nhau.'; break;
        case 'similar_exam': title = 'Tạo đề tương tự'; welcomeText = 'Chế độ Tạo Đề Tương Tự. Gửi cho tôi một đề bài và tôi sẽ tạo một đề mới với cấu trúc và độ khó tương đương.'; break;
        case 'create_file': title = 'Tạo file'; welcomeText = 'Chế độ Tạo File. Bạn muốn tôi tạo file gì? (Văn bản, code, v.v...)'; break;
        case 'generate_image': title = 'Tạo ảnh AI'; welcomeText = 'Chế độ Tạo Ảnh AI. Hãy mô tả chi tiết hình ảnh bạn muốn tạo.'; break;
        case 'flashcard': title = 'Học Flashcard'; welcomeText = 'Chế độ Flashcard. Nhập chủ đề bạn muốn học (VD: Từ vựng IELTS, Lịch sử VN)..., tôi sẽ tạo bộ thẻ cho bạn.'; break;
        case 'rpg': title = 'Game Nhập Vai'; welcomeText = "Chào mừng lữ khách! Bạn muốn phiêu lưu trong bối cảnh nào (Trung cổ, Cyberpunk, Kiếm hiệp...)?"; break;
        case 'roast': title = 'Chế độ Mỏ Hỗn'; welcomeText = "Ồ, lại thêm một kẻ muốn nghe sự thật trần trụi à? Được thôi, nói gì đi nào."; break;
        case 'akinator': title = 'Thần đèn Akinator'; welcomeText = "Ta là Thần đèn Akinator. Hãy nghĩ về một nhân vật và ta sẽ đoán ra. Sẵn sàng chưa?"; break;
        case 'mbti': title = 'Trắc nghiệm MBTI'; welcomeText = "Chào bạn. Hãy bắt đầu bài trắc nghiệm tính cách MBTI nhé. Bạn sẵn sàng chưa?"; break;
        case 'numerology': title = 'Thần Số Học'; welcomeText = "Chào mừng đến với Thần Số Học. Hãy cho tôi biết Họ tên đầy đủ và Ngày tháng năm sinh (Dương lịch) của bạn."; break;
        case 'dream_interpreter': title = 'Giải Mã Giấc Mơ'; welcomeText = "Đêm qua bạn mơ thấy gì? Hãy kể chi tiết cho tôi nghe, tôi sẽ giúp bạn giải mã thông điệp."; break;
        case 'caption_gen': title = 'Tạo Caption'; welcomeText = "Bạn cần caption cho ảnh gì? Vui, buồn, thả thính hay cực ngầu? Gửi ảnh hoặc mô tả cho tôi nhé."; break;
        case 'face_reading': title = 'Nhân Tướng Học'; welcomeText = "Xin chào! Hãy gửi cho tôi một tấm ảnh selfie rõ mặt, tôi sẽ 'xem tướng' cho bạn."; break;
        case 'debate': title = 'Sàn Đấu Tranh Biện'; welcomeText = "Chào mừng đến Sàn Đấu. Hãy đưa ra một quan điểm gây tranh cãi (VD: 'Học sinh nên được nhuộm tóc'). Tôi sẽ phản biện lại bạn."; break;
        case 'mystery': title = 'Thám Tử Tâm Linh'; welcomeText = "Chào thám tử. Tôi có một vụ án bí ẩn 'Black Stories' dành cho bạn. Hãy gõ 'Bắt đầu' để nhận vụ án."; break;
        case 'rapper': title = 'Rapper AI'; welcomeText = "Yo! Đây là MC KL AI. Bạn muốn tôi Diss ai hay Rap tán tỉnh em nào? Cho xin cái tên và vài đặc điểm nào homie!"; break;
        case 'emoji_quiz': title = 'Đuổi Hình Bắt Chữ'; welcomeText = "Chào mừng đến với Đuổi Hình Bắt Chữ (Emoji Ver). Tôi sẽ tung ra các Emoji, bạn hãy đoán xem đó là câu tục ngữ hay bài hát nào nhé. Gõ 'Chơi' để bắt đầu!"; break;
        case 'dating_sim': title = 'Giả Lập Tán Tỉnh'; welcomeText = "Chế độ Dating Sim (Hard Mode) kích hoạt. Bạn muốn tán ai: 'Hot girl lạnh lùng', 'Trap boy' hay 'Sếp nữ khó tính'? Chọn đi rồi thử tài Rizz của bạn."; break;
        case 'food_randomizer': title = 'Hôm Nay Ăn Gì?'; welcomeText = "Đau đầu vì không biết ăn gì? Bấm nút cứu đói ngay! Bạn đang thèm đồ nước hay khô, cay hay không?"; break;
        case 'fashion_police': title = 'Cảnh Sát Thời Trang'; welcomeText = "Dừng lại! Giơ tay lên và gửi ngay ảnh outfit hôm nay của bạn vào đây. Cảnh sát thời trang sẽ 'check var' xem bạn mặc đẹp hay thảm họa."; break;
        case 'werewolf_moderator': title = 'Quản Trò Ma Sói'; welcomeText = "Đêm đã buông xuống... Mời mọi người tập trung. Nhập số lượng người chơi để tôi bắt đầu phân vai và điều hành game."; break;
        case 'style_transfer': title = 'Đa Vũ Trụ Ngôn Ngữ'; welcomeText = "Nhập một câu nói bình thường vào đây, tôi sẽ biến nó thành phiên bản Kiếm hiệp, Gen Z, hoặc Văn bản hành chính cực hài."; break;
        case 'rap_battle': title = 'Rap Battle'; welcomeText = "Sàn đấu đã mở! Bạn rap trước đi, tôi sẽ 'phản dame' lại ngay lập tức. Nhớ gieo vần cho gắt vào!"; break;
        case 'roadmap': title = 'Người Vẽ Lộ Trình'; welcomeText = "Chào mừng! Hãy chia sẻ mục tiêu học tập (VD: IELTS 7.0, Lập trình Python) và trình độ hiện tại của bạn. Tôi sẽ vẽ một lộ trình chi tiết cho bạn."; break;
        case 'socratic': title = 'Gia Sư Socratic'; welcomeText = "Chào bạn. Tôi là Gia sư Socratic. Hãy hỏi tôi một câu hỏi, nhưng đừng mong đợi câu trả lời ngay nhé. Chúng ta sẽ cùng nhau tìm ra nó."; break;
        case 'mock_oral': title = 'Phòng Thi Ảo'; welcomeText = "Phòng thi đã sẵn sàng. Bạn muốn thi nói chủ đề gì (IELTS, Vấn đáp Sử...)? \n(Mẹo: Hãy sử dụng nút 'Live' màu đỏ để có trải nghiệm thi nói thực tế nhất)"; break;
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

  // Load chats using API
  useEffect(() => {
    if (!currentUser) return;
    
    const loadChats = async () => {
        try {
            const loadedChats = await api.getChatSessions(currentUser.username);
            
            if (loadedChats.length > 0) {
                setChatSessions(loadedChats);
                setActiveChatId(prev => {
                    if (prev && loadedChats.find(c => c.id === prev)) return prev; 
                    const lastActive = loadedChats.find(p => !p.isPinned) || loadedChats[0];
                    return lastActive.id;
                });
            } else {
                handleNewChat();
            }
        } catch (e) {
            console.error("Không thể tải lịch sử chat", e);
            handleNewChat();
        }
    };
    loadChats();
  }, [currentUser.username, handleNewChat]);

  // Initialize Chat Instances (GenAI)
  useEffect(() => {
    if (!currentUser) return;
    
    chatSessions.forEach(session => {
        if (!chatInstances.current[session.id]) {
            const lastMsgMode = session.messages[session.messages.length - 1]?.mode || 'chat';
            
            const systemInstruction = getSystemInstruction(
                currentUser?.aiRole, 
                currentUser?.aiTone, 
                currentUser?.customInstruction, 
                lastMsgMode
            );
            
            const chatHistory = session.messages
                .map(mapMessageToHistory)
                // FIX: Use 'Role' type in type predicate
                .filter((content): content is { role: Role; parts: any[] } => content !== null);

            const historyWithoutWelcome = chatHistory.length > 0 && chatHistory[0].role === 'model' 
                ? chatHistory.slice(1) 
                : chatHistory;

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                chatInstances.current[session.id] = ai.chats.create({
                    model: MODEL_NAME,
                    config: { systemInstruction },
                    history: historyWithoutWelcome,
                });
            } catch (e) {
                console.error("Lazy init failed for chat", session.id);
            }
        }
    });
  }, [chatSessions, currentUser]);

  // Auto-save active chat to API when it changes
  useEffect(() => {
      if (!activeChatId || !currentUser || currentUser.isDemo) return;
      const currentSession = chatSessions.find(c => c.id === activeChatId);
      if (currentSession) {
          const save = async () => {
              try {
                  await api.saveChatSession(currentUser.username, currentSession);
              } catch (e) {
                  console.error("Failed to sync chat", e);
              }
          };
          save();
      }
  }, [chatSessions, activeChatId, currentUser]);


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
      const target = event.target as HTMLElement;

      if (target.closest('.mobile-menu-content')) return;

      if (
        featuresPopoverRef.current && 
        !featuresPopoverRef.current.contains(target) &&
        featuresButtonRef.current &&
        !featuresButtonRef.current.contains(target)
      ) {
        setIsFeaturesPopoverOpen(false);
      }
      if (
        entertainmentPopoverRef.current && 
        !entertainmentPopoverRef.current.contains(target) &&
        entertainmentButtonRef.current &&
        !entertainmentButtonRef.current.contains(target)
      ) {
        setIsEntertainmentPopoverOpen(false);
      }
      if (
        educationPopoverRef.current && 
        !educationPopoverRef.current.contains(target) &&
        educationButtonRef.current &&
        !educationButtonRef.current.contains(target)
      ) {
        setIsEducationPopoverOpen(false);
      }
      if (
        toolsPopoverRef.current && 
        !toolsPopoverRef.current.contains(target) &&
        toolsButtonRef.current &&
        !toolsButtonRef.current.contains(target)
      ) {
        setIsToolsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
       document.removeEventListener('touchstart', (e) => handleClickOutside(e as unknown as MouseEvent));
    };
  }, []);

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

  const handleUpdateUserInternal = async (updates: Partial<User>): Promise<boolean> => {
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
                       // FIX: Use 'Role' type in type predicate
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

  const handleEntertainmentSelect = (selected: Mode | 'breathing') => {
      if (selected === 'breathing') {
          setIsBreathingOpen(true);
      } else if (selected === 'tarot') {
          setIsTarotOpen(true);
      } else {
          handleNewChat(selected as Mode);
      }
  };
  
  const handleEducationSelect = (selected: Mode) => {
      handleNewChat(selected);
  };

  const handleTarotReading = (cardName: string, question: string) => {
      const initialMessage: Message = {
          role: 'user',
          text: `Tôi vừa rút được lá bài Tarot: "${cardName}". Vấn đề của tôi là: "${question}". Hãy giải mã lá bài này và đưa ra lời khuyên cho tôi.`,
          mode: 'tarot',
          timestamp: new Date().toISOString()
      };
      handleNewChat('tarot', initialMessage);
  };

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

          <div className="p-3 space-y-2">
              <button 
                  onClick={() => handleNewChat()}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-brand text-white rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 active:scale-[0.98] group"
              >
                  <NewChatIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  <span className="font-medium">Cuộc trò chuyện mới</span>
              </button>
              {installPrompt && (
                  <button
                      onClick={handleInstallApp}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg active:scale-[0.98] group"
                  >
                      <DownloadIcon className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                      <span className="font-medium">Cài đặt ứng dụng</span>
                  </button>
              )}
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
                 {/* Tools Dropdown Menu */}
                 <div className="relative hidden sm:block" ref={toolsPopoverRef}>
                     <button 
                        ref={toolsButtonRef}
                        onClick={() => setIsToolsPopoverOpen(!isToolsPopoverOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isToolsPopoverOpen ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-sidebar'}`}
                        title="Các công cụ bổ trợ"
                     >
                         <WrenchIcon className="w-5 h-5" />
                         <span className="hidden lg:inline text-sm font-medium">Công cụ</span>
                     </button>

                     {isToolsPopoverOpen && (
                         <div className="absolute z-50 bg-card border border-border shadow-xl p-1 animate-slide-in-up bottom-auto top-full left-auto right-0 mt-2 w-56 rounded-xl flex flex-col gap-1 origin-top-right">
                             {toolItems.map((m) => (
                                  <button
                                      key={m.id}
                                      onClick={() => { 
                                          if (m.action) m.action();
                                          setIsToolsPopoverOpen(false); 
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors justify-start hover:bg-sidebar hover:text-text-primary text-text-secondary"
                                  >
                                      <div className="flex-shrink-0">{m.icon}</div>
                                      <span className="truncate">{m.label}</span>
                                  </button>
                              ))}
                         </div>
                     )}
                 </div>
                 
                 <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block"></div>
                 
                 {/* Education Menu */}
                 <div className="relative" ref={educationPopoverRef}>
                     <button 
                        ref={educationButtonRef}
                        onClick={() => setIsEducationPopoverOpen(!isEducationPopoverOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isEducationPopoverOpen ? 'bg-blue-500/10 text-blue-500' : 'text-text-secondary hover:bg-sidebar'}`}
                        title="Học tập chuyên sâu"
                     >
                         <LearnModeIcon className="w-5 h-5" />
                         <span className="hidden sm:inline text-sm font-medium">Học tập</span>
                     </button>

                     {isEducationPopoverOpen && (
                         <div className="hidden sm:flex absolute z-50 bg-card border border-border shadow-xl p-0 animate-slide-in-up bottom-auto top-full left-auto right-0 mt-2 rounded-xl overflow-hidden">
                             <React.Suspense fallback={<div className="p-4 text-center text-xs text-text-secondary">Đang tải menu...</div>}>
                                <EducationMenu onSelect={handleEducationSelect} />
                             </React.Suspense>
                         </div>
                     )}
                 </div>

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
                      
                      {/* Desktop Menu (Dropdown) - Only Modes */}
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

        {/* Mobile Education Menu */}
        {isEducationPopoverOpen && createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsEducationPopoverOpen(false)} />
                <div className="mobile-menu-content relative bg-card border-t border-border rounded-t-3xl p-5 shadow-2xl animate-slide-in-up max-h-[75vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold">Học Tập Chuyên Sâu</h3>
                       <button 
                           onClick={() => setIsEducationPopoverOpen(false)}
                           className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors font-bold text-sm flex items-center gap-1"
                       >
                           <XIcon className="w-4 h-4" /> Đóng
                       </button>
                   </div>
                   
                   <div className="pb-8">
                        <React.Suspense fallback={<div className="p-4 text-center text-xs text-text-secondary">Đang tải menu...</div>}>
                            <EducationMenu onSelect={handleEducationSelect} />
                        </React.Suspense>
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
                        onApplySchedule={(scheduleText) => {}}
                        onOpenMindMap={(data) => setMindMapModalState({ data, messageIndex: idx })}
                        onOpenFlashcards={(data) => setFlashcardData(data)}
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
                        mode === 'numerology' ? "Nhập Họ tên & Ngày sinh (VD: Nguyen Van A 01/01/2000)..." :
                        mode === 'dream_interpreter' ? "Kể lại giấc mơ của bạn..." :
                        mode === 'caption_gen' ? "Mô tả ảnh hoặc tâm trạng để viết caption..." :
                        mode === 'flashcard' ? "Nhập chủ đề để tạo Flashcard (VD: Từ vựng IELTS, Lịch sử VN)..." :
                        mode === 'face_reading' ? "Gửi ảnh selfie để xem tướng..." :
                        mode === 'debate' ? "Đưa ra quan điểm để tranh luận..." :
                        mode === 'mystery' ? "Gõ 'Bắt đầu' hoặc hỏi câu hỏi Yes/No..." :
                        mode === 'rapper' ? "Nhập tên đối tượng để Diss hoặc Tán tỉnh..." :
                        mode === 'emoji_quiz' ? "Gõ 'Chơi' để bắt đầu..." :
                        mode === 'dating_sim' ? "Nhập tin nhắn tán tỉnh..." :
                        mode === 'food_randomizer' ? "Kêu đói đi nào..." :
                        mode === 'fashion_police' ? "Gửi ảnh outfit để chấm điểm..." :
                        mode === 'werewolf_moderator' ? "Nhập số lượng người chơi..." :
                        mode === 'style_transfer' ? "Nhập câu muốn chuyển đổi..." :
                        mode === 'rap_battle' ? "Rap một câu đi homie..." :
                        mode === 'roadmap' ? "Nhập mục tiêu học tập của bạn..." :
                        mode === 'socratic' ? "Đặt câu hỏi cho gia sư..." :
                        mode === 'mock_oral' ? "Nhập câu trả lời thi nói..." :
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

        {flashcardData && (
            <React.Suspense fallback={null}>
                <FlashcardView 
                    flashcards={flashcardData} 
                    onClose={() => setFlashcardData(null)} 
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
                            className="w-full py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl transition-all"
                         >
                             Đăng ký ngay
                         </button>
                         <button 
                            onClick={() => setShowDemoLimitModal(false)}
                            className="text-sm text-text-secondary hover:underline"
                         >
                             Để sau
                         </button>
                    </div>
                </div>
            </div>
        )}

        {showLoginPromptModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-message-pop-in">
                    <h2 className="text-xl font-bold text-text-center mb-2">Tính năng dành cho thành viên</h2>
                    <p className="text-center text-text-secondary mb-6 text-sm">
                        Vui lòng đăng nhập để sử dụng tính năng Cài đặt và lưu cấu hình cá nhân.
                    </p>
                    <div className="flex flex-col gap-3">
                         <button 
                            onClick={() => {
                                setShowLoginPromptModal(false);
                                onLogout(); 
                            }}
                            className="w-full py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl transition-all"
                         >
                             Đăng nhập / Đăng ký
                         </button>
                         <button 
                            onClick={() => setShowLoginPromptModal(false)}
                            className="text-sm text-text-secondary hover:underline text-center"
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
