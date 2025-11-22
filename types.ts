
export type Role = 'user' | 'model';

export type Mode = 'chat' | 'create_exam' | 'solve_exam' | 'create_schedule' | 'learn' | 'exam' | 'theory' | 'scramble_exam' | 'similar_exam' | 'create_file' | 'mind_map' | 'generate_image' | 'grader' | 'chat_document' | 'data_analysis' | 'rpg' | 'roast' | 'akinator' | 'tarot' | 'mbti' | 'flashcard' | 'numerology' | 'dream_interpreter' | 'caption_gen' | 'face_reading' | 'debate' | 'mystery' | 'rapper' | 'emoji_quiz' | 'dating_sim' | 'food_randomizer' | 'fashion_police' | 'werewolf_moderator' | 'style_transfer' | 'rap_battle' | 'roadmap' | 'socratic' | 'mock_oral';

export type FollowUpAction = 'explain' | 'example' | 'summarize';

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  color?: string;
  image?: string;
  link?: string;
}

export interface Flashcard {
  term: string;
  translation: string;
  definition?: string;
}

export interface Message {
  role: Role;
  text: string;
  timestamp?: string;
  files?: {
    name: string;
    dataUrl: string;
    mimeType: string;
  }[];
  fileToDownload?: {
    name: string;
    content: string;
    mimeType: string;
  }[];
  mindMapData?: MindMapNode;
  flashcards?: Flashcard[];
  chartConfig?: any; // JSON config for Chart.js
  scheduleData?: {
    title: string;
    startTime: string;
    endTime: string;
    details: string;
    location?: string;
  };
  isError?: boolean;
  mode?: Mode;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  isPinned?: boolean;
}

export interface User {
  username: string;
  password: string;
  email?: string | null; // Optional real email used for contact/recovery
  avatar?: string;
  fontPreference?: string;
  aiRole?: 'assistant' | 'teacher' | 'classmate';
  aiTone?: 'balanced' | 'humorous' | 'academic' | 'concise';
  theme?: 'light' | 'dark';
  backgroundUrl?: string;
  isDemo?: boolean;
  customInstruction?: string;
}