

import { User, ChatSession, LearningStats, SharedResource } from '../types';
import { supabase } from './supabaseClient';

const USERS_KEY = 'kl_ai_users';
const CHATS_KEY_PREFIX = 'kl_ai_chats-';

// --- Helper functions for LocalStorage (Fallback) ---

const getLocalUsers = (): Record<string, User> => {
  try {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : {};
  } catch (e) {
    console.error("Error reading users from local storage", e);
    return {};
  }
};

const saveLocalUsers = (users: Record<string, User>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const getLocalChats = (username: string): ChatSession[] => {
    try {
        const chatsStr = localStorage.getItem(CHATS_KEY_PREFIX + username);
        return chatsStr ? JSON.parse(chatsStr) : [];
    } catch (e) {
        return [];
    }
};

const saveLocalChats = (username: string, chats: ChatSession[]) => {
    localStorage.setItem(CHATS_KEY_PREFIX + username, JSON.stringify(chats));
};

// --- Helper: Generate Safe Auth Email ---
// Removes spaces and special chars to satisfy Supabase Email validation
export const generateAuthEmail = (username: string) => {
    if (!username) throw new Error("Tên đăng nhập không được để trống");

    // 1. Lowercase
    let clean = username.trim().toLowerCase();
    
    // 2. Remove Vietnamese accents (NFD normalization)
    // NFD splits characters into base char + combining diacritic (e.g., 'ô' -> 'o' + '^')
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 3. Replace spaces with underscores
    clean = clean.replace(/\s+/g, '_');
    
    // 4. Remove non-alphanumeric characters (except . _ -)
    // This is crucial: Supabase will reject "user@name" as the local part if it has invalid chars
    clean = clean.replace(/[^a-z0-9._-]/g, '');
    
    // 5. Remove leading/trailing special chars (dots, underscores, dashes)
    clean = clean.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    
    // 6. Validation: Ensure the sanitized username is still usable
    if (clean.length < 3) {
        throw new Error("Tên đăng nhập phải chứa ít nhất 3 ký tự chữ hoặc số (không tính ký tự đặc biệt).");
    }
    
    return `${clean}@kl-ai.app`;
};

// --- Main API Object ---

export const api = {
  
  // --- Utilities ---
  checkConnection: async (): Promise<boolean> => {
      if (!supabase) return false;
      try {
          // Check auth service health
          const { error } = await supabase.auth.getSession();
          return !error;
      } catch {
          return false;
      }
  },

  // --- Session Restoration ---
  restoreSession: async (): Promise<User | null> => {
      // Try Cloud First
      if (supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    return {
                        username: profile.username,
                        password: '', // Password not stored in profile
                        email: profile.email, // Get stored real email
                        aiRole: profile.ai_role,
                        aiTone: profile.ai_tone,
                        theme: profile.theme,
                        avatar: profile.avatar,
                        fontPreference: profile.font_preference,
                        backgroundUrl: profile.background_url,
                        customInstruction: profile.custom_instruction,
                        isDemo: false,
                        xp: profile.xp || 0,
                        level: profile.level || 1,
                        pet: profile.pet || undefined,
                        stats: profile.stats || undefined
                    };
                }
                
                // AUTO-HEAL: Auth session exists but Profile is missing in DB (likely due to DB reset)
                if (error && session.user) {
                    console.log("Detected missing profile for authenticated user. Attempting to auto-heal...");
                    const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user';
                    
                    const basicUser: User = {
                        username: username,
                        password: '',
                        aiRole: 'assistant',
                        aiTone: 'balanced',
                        theme: 'dark',
                        avatar: '😊',
                        fontPreference: "'Inter', sans-serif",
                        isDemo: false,
                        xp: 0,
                        level: 1
                    };

                    const { error: insertError } = await supabase.from('profiles').insert({
                        id: session.user.id,
                        username: username,
                        ai_role: basicUser.aiRole,
                        ai_tone: basicUser.aiTone,
                        theme: basicUser.theme,
                        avatar: basicUser.avatar,
                        font_preference: basicUser.fontPreference,
                        xp: 0,
                        level: 1
                    });
                    
                    if (!insertError) {
                        return basicUser;
                    }
                }
            }
          } catch (e) {
              console.warn("Could not restore cloud session, falling back to local if available", e);
          }
      }
      
      // Fallback to Local Cache if Cloud fails or not logged in there but has local data (e.g. Demo)
      const storedUserStr = localStorage.getItem('kl-ai-user-data');
      if (storedUserStr) {
          return JSON.parse(storedUserStr);
      }
      return null;
  },

  // --- Authentication ---

  login: async (username: string, password: string): Promise<{ user: User; token: string }> => {
    const cleanUsername = username.trim();
    if (supabase) {
        // Cloud Login
        let authEmail;
        try {
            authEmail = generateAuthEmail(cleanUsername);
        } catch (e: any) {
            throw new Error(e.message);
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: password,
        });

        if (error) {
            // Fallback check for local user if cloud login fails
            const users = getLocalUsers();
            if (users[cleanUsername] && users[cleanUsername].password === password) {
                 return { user: users[cleanUsername], token: `local-token-${Date.now()}` };
            }
            // Friendly error translation
            if (error.message.includes("Invalid login credentials")) {
                throw new Error("Tên đăng nhập hoặc mật khẩu không đúng.");
            }
            throw new Error(`Lỗi đăng nhập: ${error.message}`);
        }

        if (data.user) {
             const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
            
            if (profileError) {
                // TỰ ĐỘNG SỬA LỖI: Nếu đăng nhập được nhưng không thấy Profile
                const basicUser: User = {
                    username: cleanUsername,
                    password: '',
                    aiRole: 'assistant',
                    aiTone: 'balanced',
                    theme: 'dark',
                    avatar: '😊',
                    fontPreference: "'Inter', sans-serif",
                    isDemo: false,
                    xp: 0,
                    level: 1
                };

                // Insert lại profile vào DB
                await supabase.from('profiles').insert({
                    id: data.user.id,
                    username: cleanUsername,
                    ai_role: basicUser.aiRole,
                    ai_tone: basicUser.aiTone,
                    theme: basicUser.theme,
                    avatar: basicUser.avatar,
                    font_preference: basicUser.fontPreference,
                    xp: 0,
                    level: 1
                });

                return { user: basicUser, token: data.session?.access_token || '' };
            }

            return {
                user: {
                    username: profile.username || cleanUsername,
                    password: '',
                    email: profile.email,
                    aiRole: profile.ai_role,
                    aiTone: profile.ai_tone,
                    theme: profile.theme,
                    avatar: profile.avatar,
                    fontPreference: profile.font_preference,
                    backgroundUrl: profile.background_url,
                    customInstruction: profile.custom_instruction,
                    isDemo: false,
                    xp: profile.xp || 0,
                    level: profile.level || 1,
                    pet: profile.pet || undefined,
                    stats: profile.stats || undefined
                },
                token: data.session?.access_token || ''
            };
        }
        throw new Error("Đăng nhập thất bại");

    } else {
        // LocalStorage Login
        await new Promise(resolve => setTimeout(resolve, 400));
        const users = getLocalUsers();
        const user = users[cleanUsername];
        if (!user || user.password !== password) {
            throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
        }
        // Ensure legacy users have XP
        if (user.xp === undefined) { user.xp = 0; user.level = 1; }
        
        return { 
            user, 
            token: `local-token-${Date.now()}` 
        };
    }
  },

  register: async (username: string, password: string, email?: string): Promise<{ user: User; token: string }> => {
    const cleanUsername = username.trim();
    const realEmail = email ? email.trim() : null;

    const newUser: User = {
        username: cleanUsername,
        password: '', 
        email: realEmail,
        aiRole: 'assistant',
        aiTone: 'balanced',
        theme: 'dark',
        avatar: '😊',
        fontPreference: "'Inter', sans-serif",
        isDemo: false,
        xp: 0,
        level: 1
    };

    if (supabase) {
        let authEmail;
        try {
            authEmail = generateAuthEmail(cleanUsername);
        } catch (e: any) {
            throw new Error(e.message);
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password: password,
            options: {
                data: { username: cleanUsername }
            }
        });

        if (error) {
             if (error.message.includes("Email signups are disabled")) {
                 throw new Error("Lỗi Cấu Hình Supabase: Bạn chưa bật 'Enable Email provider'.");
             }
             if (error.message.includes("User already registered")) {
                 throw new Error("Tên đăng nhập này đã được sử dụng. Hãy chọn tên khác.");
             }
             if (error.message.includes("valid email")) {
                 throw new Error("Tên đăng nhập không hợp lệ (tránh dùng toàn ký tự đặc biệt).");
             }
             throw new Error(error.message);
        }
        
        if (data.user && !data.session) {
            throw new Error("Đăng ký thành công nhưng chưa có phiên làm việc. Vui lòng tắt 'Confirm Email' trong Supabase.");
        }

        if (!data.user) throw new Error("Đăng ký thất bại");

        // Create Profile in DB - Use original username and optional real email
        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username: cleanUsername,
            email: realEmail, // Lưu email thật vào đây
            ai_role: newUser.aiRole,
            ai_tone: newUser.aiTone,
            theme: newUser.theme,
            avatar: newUser.avatar,
            font_preference: newUser.fontPreference,
            xp: 0,
            level: 1
        });

        if (profileError) console.error("Error creating profile:", profileError);

        return { user: newUser, token: data.session?.access_token || '' };

    } else {
        await new Promise(resolve => setTimeout(resolve, 400));
        const users = getLocalUsers();
        if (users[cleanUsername]) throw new Error('Tên đăng nhập này đã được sử dụng.');
        
        newUser.password = password;
        users[cleanUsername] = newUser;
        saveLocalUsers(users);
        return { user: newUser, token: `local-token-${Date.now()}` };
    }
  },
  
  createDemoUser: async (): Promise<{ user: User; token: string }> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const demoUser: User = {
          username: 'Khách (Demo)',
          password: '',
          aiRole: 'assistant',
          aiTone: 'balanced',
          theme: 'dark',
          avatar: '🚀',
          isDemo: true,
          xp: 0,
          level: 1
      };
      return { user: demoUser, token: `demo-token-${Date.now()}` };
  },

  updateUser: async (username: string, updates: Partial<User>): Promise<User> => {
      if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const dbUpdates: any = {};
              if (updates.aiRole) dbUpdates.ai_role = updates.aiRole;
              if (updates.aiTone) dbUpdates.ai_tone = updates.aiTone;
              if (updates.theme) dbUpdates.theme = updates.theme;
              if (updates.avatar) dbUpdates.avatar = updates.avatar;
              if (updates.fontPreference) dbUpdates.font_preference = updates.fontPreference;
              if (updates.backgroundUrl !== undefined) dbUpdates.background_url = updates.backgroundUrl;
              if (updates.customInstruction !== undefined) dbUpdates.custom_instruction = updates.customInstruction;
              
              if (updates.email !== undefined) dbUpdates.email = updates.email;
              if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
              if (updates.level !== undefined) dbUpdates.level = updates.level;
              if (updates.pet !== undefined) dbUpdates.pet = updates.pet;
              if (updates.stats !== undefined) dbUpdates.stats = updates.stats;

              if (updates.password) {
                  const { error } = await supabase.auth.updateUser({ password: updates.password });
                  if (error) throw new Error(error.message);
              }

              if (Object.keys(dbUpdates).length > 0) {
                  const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
                  if (error) {
                      // Gracefully ignore missing columns for new features during transition
                      if (error.code === '42703') {
                          console.warn("Skipping update: Database column missing (XP/Pet/Stats).");
                      } else {
                          console.error("Update user failed:", error);
                      }
                  }
              }
              return { username, ...updates } as User;
          }
      }

      // Fallback / Local
      const users = getLocalUsers();
      if (users[username]) {
          const updatedUser = { ...users[username], ...updates };
          users[username] = updatedUser;
          saveLocalUsers(users);
          return updatedUser;
      }
      return { username, ...updates } as User;
  },
  
  // --- Smart Stats Update Helper ---
  updateLearningStats: async (username: string, currentStats: LearningStats | undefined, mode: string) => {
      const today = new Date().toISOString().split('T')[0];
      const stats = currentStats ? { ...currentStats } : {
          totalMessages: 0,
          studyStreak: 0,
          lastStudyDate: '',
          dailyActivity: {},
          modeUsage: {}
      };

      // Update Message Count
      stats.totalMessages = (stats.totalMessages || 0) + 1;

      // Update Mode Usage
      stats.modeUsage = { ...(stats.modeUsage || {}) };
      stats.modeUsage[mode] = (stats.modeUsage[mode] || 0) + 1;

      // Update Daily Activity
      stats.dailyActivity = { ...(stats.dailyActivity || {}) };
      stats.dailyActivity[today] = (stats.dailyActivity[today] || 0) + 1;

      // Update Streak
      if (stats.lastStudyDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (stats.lastStudyDate === yesterdayStr) {
              stats.studyStreak = (stats.studyStreak || 0) + 1;
          } else if (stats.lastStudyDate < yesterdayStr) {
              stats.studyStreak = 1; // Reset
          } else if (!stats.studyStreak) {
              stats.studyStreak = 1; // First time
          }
          stats.lastStudyDate = today;
      }

      return api.updateUser(username, { stats });
  },

  // --- Chat Data Syncing ---

  getChatSessions: async (username: string): Promise<ChatSession[]> => {
      if (supabase) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false });
                
                if (!error && data) {
                    return data.map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        messages: item.messages,
                        isPinned: item.is_pinned
                    }));
                }
            }
        } catch (e) {
            console.warn("Could not fetch cloud chats, falling back to local", e);
        }
      }
      return getLocalChats(username);
  },

  saveChatSession: async (username: string, session: ChatSession) => {
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('chats')
                    .upsert({
                        id: session.id,
                        user_id: user.id,
                        title: session.title,
                        messages: session.messages,
                        is_pinned: session.isPinned,
                        updated_at: new Date().toISOString()
                    });
                return;
            }
          } catch (e) {
               console.warn("Could not save chat to cloud", e);
          }
      }
      
      // Local fallback
      const chats = getLocalChats(username);
      const index = chats.findIndex(c => c.id === session.id);
      if (index >= 0) {
          chats[index] = session;
      } else {
          chats.unshift(session);
      }
      saveLocalChats(username, chats);
  },

  deleteChatSession: async (username: string, sessionId: string) => {
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('chats').delete().eq('id', sessionId).eq('user_id', user.id);
                return;
            }
          } catch (e) {
               console.warn("Could not delete cloud chat", e);
          }
      }
      const chats = getLocalChats(username);
      const newChats = chats.filter(c => c.id !== sessionId);
      saveLocalChats(username, newChats);
  },

  // --- Leaderboard ---
  getLeaderboard: async (): Promise<{ username: string; avatar: string; xp: number; level: number }[]> => {
      if (supabase) {
          try {
              const { data, error } = await supabase
                  .from('profiles')
                  .select('username, avatar, xp, level')
                  .order('xp', { ascending: false })
                  .limit(20);
              
              if (error) {
                  // Handle missing 'xp' column error gracefully
                  if (error.code === '42703' || error.message.includes('does not exist')) {
                      console.warn("⚠️ Database Schema Missing XP columns");
                      return [];
                  }
                  throw error;
              }
              
              if (data) {
                  return data.map((item: any) => ({
                      username: item.username || 'Người dùng ẩn danh',
                      avatar: item.avatar || '😊',
                      xp: item.xp || 0,
                      level: item.level || 1
                  }));
              }
          } catch (e) {
              console.error("Could not fetch leaderboard", e);
          }
      }
      
      // Fallback: Local users (sorted)
      const users = getLocalUsers();
      return Object.values(users)
          .map(u => ({
              username: u.username,
              avatar: u.avatar || '😊',
              xp: u.xp || 0,
              level: u.level || 1
          }))
          .sort((a, b) => b.xp - a.xp)
          .slice(0, 20);
  },

  // --- Shared Resources (Community Hub) ---
  getSharedResources: async (typeFilter?: 'flashcard' | 'mindmap'): Promise<SharedResource[]> => {
      if (supabase) {
          try {
              let query = supabase
                  .from('shared_resources')
                  .select('*')
                  .order('created_at', { ascending: false })
                  .limit(50);
              
              if (typeFilter) {
                  query = query.eq('type', typeFilter);
              }

              const { data, error } = await query;
              if (error) throw error;
              
              return data as SharedResource[];
          } catch (e) {
              console.error("Could not fetch shared resources", e);
              return [];
          }
      }
      return [];
  },

  publishResource: async (resource: Omit<SharedResource, 'id' | 'user_id' | 'created_at' | 'likes' | 'downloads'>): Promise<boolean> => {
      if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return false;

          const { error } = await supabase
              .from('shared_resources')
              .insert({
                  user_id: user.id,
                  username: resource.username,
                  avatar: resource.avatar,
                  type: resource.type,
                  title: resource.title,
                  description: resource.description,
                  data: resource.data
              });
          
          if (error) {
              console.error("Publish failed", error);
              return false;
          }
          return true;
      }
      return false;
  }
};
