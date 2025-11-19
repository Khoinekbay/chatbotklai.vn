

import { User } from '../types';

const USERS_KEY = 'kl_ai_users';

// Helper to get all users from local storage
const getUsers = (): Record<string, User> => {
  try {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : {};
  } catch (e) {
    console.error("Error reading users from local storage", e);
    return {};
  }
};

// Helper to save users to local storage
const saveUsers = (users: Record<string, User>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const api = {
  // Simulate Login
  login: async (username: string, password: string): Promise<{ user: User; token: string }> => {
    // Small delay for better UX (feels like processing)
    await new Promise(resolve => setTimeout(resolve, 400));

    const users = getUsers();
    const user = users[username];

    // Simple plaintext password check (Client-side only demo)
    if (!user || user.password !== password) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    return { 
      user, 
      token: `local-token-${Date.now()}-${Math.random().toString(36).substr(2)}` 
    };
  },

  // Simulate Registration
  register: async (username: string, password: string): Promise<{ user: User; token: string }> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const users = getUsers();
    if (users[username]) {
      throw new Error('Tên đăng nhập này đã được sử dụng.');
    }

    const newUser: User = {
      username,
      password,
      aiRole: 'assistant',
      aiTone: 'balanced',
      theme: 'dark', // Default to dark mode
      avatar: '😊',
      fontPreference: "'Inter', sans-serif",
      isDemo: false
    };

    users[username] = newUser;
    saveUsers(users);

    return { 
      user: newUser, 
      token: `local-token-${Date.now()}-${Math.random().toString(36).substr(2)}` 
    };
  },
  
  // Simulate Demo User Creation
  createDemoUser: async (): Promise<{ user: User; token: string }> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const demoUser: User = {
          username: 'Khách (Demo)',
          password: '',
          aiRole: 'assistant',
          aiTone: 'balanced',
          theme: 'dark',
          avatar: '🚀',
          isDemo: true
      };
      
      return { 
          user: demoUser, 
          token: `demo-token-${Date.now()}` 
      };
  }
};