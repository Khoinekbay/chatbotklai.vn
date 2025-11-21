

export type Role = 'user' | 'model';

export type Mode = 'chat' | 'create_exam' | 'solve_exam' | 'create_schedule' | 'learn' | 'exam' | 'theory' | 'flashcard' | 'scramble_exam' | 'similar_exam' | 'create_file' | 'mind_map' | 'generate_image' | 'grader' | 'chat_document' | 'data_analysis' | 'rpg' | 'roast' | 'akinator' | 'tarot' | 'mbti';

export type FollowUpAction = 'explain' | 'example' | 'summarize';

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  color?: string;
  image?: string;
  link?: string;
}

// Basic type for Chart.js configuration
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      [key: string]: any; // Allow other dataset properties
    }[];
  };
  options?: any;
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
  flashcards?: { term: string; definition: string }[];
  fileToDownload?: {
    name: string;
    content: string;
    mimeType: string;
  }[];
  mindMapData?: MindMapNode;
  chartConfig?: ChartConfig; // Changed from any
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