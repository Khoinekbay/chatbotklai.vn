

export type Role = 'user' | 'model';

export type Mode = 'chat' | 'create_exam' | 'solve_exam' | 'create_schedule' | 'learn' | 'exam' | 'theory' | 'flashcard' | 'scramble_exam' | 'similar_exam' | 'create_file' | 'mind_map';

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  color?: string;
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
    extension: string;
  };
  mindMapData?: MindMapNode;
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
  avatar?: string;
  fontPreference?: string;
  aiRole?: 'assistant' | 'teacher' | 'classmate';
  aiTone?: 'balanced' | 'humorous' | 'academic' | 'concise';
  theme?: 'light' | 'dark';
  backgroundUrl?: string;
}