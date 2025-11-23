
import { User, ChatSession, LearningStats, SharedResource } from '../types';
import { supabase } from './supabaseClient';

const USERS_KEY = 'kl_ai_users';
const CHATS_KEY_PREFIX = 'kl_ai_chats-';
const LOCAL_RESOURCES_KEY = 'kl_ai_local_resources';

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
  try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
      console.error("Failed to save users locally (Quota exceeded?)", e);
  }
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
    try {
        localStorage.setItem(CHATS_KEY_PREFIX + username, JSON.stringify(chats));
    } catch (e) {
        console.warn("Failed to save chats locally (Quota exceeded)", e);
    }
};

// Helper to timeout a promise
const timeoutPromise = (promise: Promise<any>, ms: number) => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Request timed out"));
        }, ms);
        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
};

// --- Helper: Generate Safe Auth Email ---
export const generateAuthEmail = (username: string) => {
    if (!username) throw new Error("Tên đăng nhập không được để trống");
    let clean = username.trim().toLowerCase();
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    clean = clean.replace(/\s+/g, '_');
    clean = clean.replace(/[^a-z0-9._-]/g, '');
    clean = clean.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (clean.length < 3) {
        throw new Error("Tên đăng nhập phải chứa ít nhất 3 ký tự chữ hoặc số.");
    }
    return `${clean}@kl-ai.app`;
};

// --- Main API Object ---

export const api = {
  
  // --- Utilities ---
  checkConnection: async (): Promise<boolean> => {
      if (!supabase) return false;
      try {
          const { error } = await timeoutPromise(supabase.auth.getSession(), 3000) as any;
          return !error;
      } catch {
          return false;
      }
  },

  // --- Session Restoration ---
  restoreSession: async (): Promise<User | null> => {
      if (supabase) {
          try {
            const { data: { session }, error: sessionError } = await timeoutPromise(supabase.auth.getSession(), 3000) as any;
            
            if (session?.user) {
                const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    return {
                        username: profile.username,
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
                    };
                }
                
                if (error && session.user) {
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
                    await supabase.from('profiles').insert({ id: session.user.id, username: username, ...basicUser });
                    return basicUser;
                }
            }
          } catch (e) {
              console.warn("Cloud session restore failed, checking local");
          }
      }
      
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
        try {
            let authEmail;
            try { authEmail = generateAuthEmail(cleanUsername); } catch (e: any) { throw new Error(e.message); }
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: password,
            });

            if (error) throw error;

            if (data.user) {
                 const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
                 const userObj = profile ? {
                    username: profile.username,
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
                    stats: profile.stats || undefined,
                    password: ''
                 } : { username: cleanUsername, password: '', isDemo: false };

                 return { user: userObj, token: data.session?.access_token || '' };
            }
        } catch (error: any) {
             // Fallback check for local user
            const users = getLocalUsers();
            if (users[cleanUsername] && users[cleanUsername].password === password) {
                 return { user: users[cleanUsername], token: `local-token-${Date.now()}` };
            }
            throw new Error(`Lỗi đăng nhập: ${error.message}`);
        }
    }
    throw new Error("Lỗi hệ thống đăng nhập");
  },

  register: async (username: string, password: string, email?: string): Promise<{ user: User; token: string }> => {
    const cleanUsername = username.trim();
    const newUser: User = {
        username: cleanUsername,
        password: '', 
        email: email,
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
        try { authEmail = generateAuthEmail(cleanUsername); } catch (e: any) { throw new Error(e.message); }
        
        const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password: password,
            options: { data: { username: cleanUsername } }
        });

        if (error) {
             if (error.message.includes("User already registered")) throw new Error("Tên đăng nhập này đã được sử dụng.");
             throw new Error(error.message);
        }
        
        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                username: cleanUsername,
                email: email,
                ai_role: newUser.aiRole,
                ai_tone: newUser.aiTone,
                theme: newUser.theme,
                avatar: newUser.avatar,
                font_preference: newUser.fontPreference,
                xp: 0,
                level: 1
            });
            return { user: newUser, token: data.session?.access_token || '' };
        }
    } else {
        // Local Fallback
        const users = getLocalUsers();
        if (users[cleanUsername]) throw new Error('Tên đăng nhập này đã được sử dụng.');
        newUser.password = password;
        users[cleanUsername] = newUser;
        saveLocalUsers(users);
        return { user: newUser, token: `local-token-${Date.now()}` };
    }
    throw new Error("Đăng ký thất bại");
  },
  
  createDemoUser: async (): Promise<{ user: User; token: string }> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { user: { username: 'Khách (Demo)', password: '', aiRole: 'assistant', aiTone: 'balanced', theme: 'dark', avatar: '🚀', isDemo: true, xp: 0, level: 1 }, token: `demo-token-${Date.now()}` };
  },

  updateUser: async (username: string, updates: Partial<User>): Promise<User> => {
      if (supabase) {
          try {
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
                if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
                if (updates.level !== undefined) dbUpdates.level = updates.level;
                if (updates.pet !== undefined) dbUpdates.pet = updates.pet;
                if (updates.stats !== undefined) dbUpdates.stats = updates.stats;

                if (updates.password) await supabase.auth.updateUser({ password: updates.password });
                if (Object.keys(dbUpdates).length > 0) await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
                
                return { username, ...updates } as User;
            }
          } catch(e) { console.error("Cloud update failed", e); }
      }

      const users = getLocalUsers();
      if (users[username]) {
          const updatedUser = { ...users[username], ...updates };
          users[username] = updatedUser;
          saveLocalUsers(users);
          return updatedUser;
      }
      return { username, ...updates } as User;
  },
  
  updateLearningStats: async (username: string, currentStats: LearningStats | undefined, mode: string) => {
      const today = new Date().toISOString().split('T')[0];
      const stats = currentStats ? { ...currentStats } : { totalMessages: 0, studyStreak: 0, lastStudyDate: '', dailyActivity: {}, modeUsage: {} };

      stats.totalMessages = (stats.totalMessages || 0) + 1;
      stats.modeUsage = { ...(stats.modeUsage || {}) };
      stats.modeUsage[mode] = (stats.modeUsage[mode] || 0) + 1;
      stats.dailyActivity = { ...(stats.dailyActivity || {}) };
      stats.dailyActivity[today] = (stats.dailyActivity[today] || 0) + 1;

      if (stats.lastStudyDate !== today) {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          if (stats.lastStudyDate === yesterdayStr) stats.studyStreak = (stats.studyStreak || 0) + 1;
          else if (stats.lastStudyDate < yesterdayStr) stats.studyStreak = 1;
          else if (!stats.studyStreak) stats.studyStreak = 1;
          stats.lastStudyDate = today;
      }
      return api.updateUser(username, { stats });
  },

  getChatSessions: async (username: string): Promise<ChatSession[]> => {
      if (supabase) {
        try {
            const { data: { user } } = await timeoutPromise(supabase.auth.getUser(), 3000) as any;
            if (user) {
                const { data, error } = await timeoutPromise(
                    supabase.from('chats').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }), 
                    5000
                ) as any;
                
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
                await supabase.from('chats').upsert({
                        id: session.id,
                        user_id: user.id,
                        title: session.title,
                        messages: session.messages,
                        is_pinned: session.isPinned,
                        updated_at: new Date().toISOString()
                    });
            }
          } catch (e) { /* ignore cloud error */ }
      }
      const chats = getLocalChats(username);
      const index = chats.findIndex(c => c.id === session.id);
      if (index >= 0) chats[index] = session; else chats.unshift(session);
      saveLocalChats(username, chats);
  },

  deleteChatSession: async (username: string, sessionId: string) => {
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('chats').delete().eq('id', sessionId).eq('user_id', user.id);
          } catch (e) { /* ignore */ }
      }
      const chats = getLocalChats(username);
      saveLocalChats(username, chats.filter(c => c.id !== sessionId));
  },

  getLeaderboard: async (): Promise<{ username: string; avatar: string; xp: number; level: number }[]> => {
      if (supabase) {
          try {
              const { data, error } = await timeoutPromise(
                  supabase.from('profiles').select('username, avatar, xp, level').order('xp', { ascending: false }).limit(20),
                  5000
              ) as any;
              if (data && !error) return data.map((item: any) => ({ username: item.username || 'Người dùng', avatar: item.avatar || '😊', xp: item.xp || 0, level: item.level || 1 }));
          } catch (e) { /* ignore */ }
      }
      const users = getLocalUsers();
      return Object.values(users).map(u => ({ username: u.username, avatar: u.avatar || '😊', xp: u.xp || 0, level: u.level || 1 })).sort((a, b) => b.xp - a.xp).slice(0, 20);
  },

  // --- Shared Resources (Hybrid) ---
  getSharedResources: async (typeFilter?: 'flashcard' | 'mindmap' | 'exercise' | 'image' | 'document'): Promise<SharedResource[]> => {
      let resources: SharedResource[] = [];

      // 1. Get Local Resources
      try {
          const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
          if (localStr) resources = [...JSON.parse(localStr)];
      } catch (e) { console.warn("Error reading local resources", e); }

      // 2. Get Cloud Resources
      if (supabase) {
          try {
              let query = supabase.from('shared_resources').select('*').order('created_at', { ascending: false }).limit(100);
              if (typeFilter) query = query.eq('type', typeFilter);

              const { data, error } = await timeoutPromise(query, 4000) as any;
              if (!error && data) {
                  // Parse subject from data column if not present in top level (backward compatibility)
                  const mappedData = data.map((item: any) => ({
                      ...item,
                      subject: item.subject || (item.data && item.data.subject) || 'Tự do'
                  }));
                  resources = [...mappedData, ...resources];
              }
          } catch (e) { console.warn("Cloud resource fetch skipped/failed", e); }
      }

      // Deduplicate by ID
      const uniqueResources = Array.from(new Map(resources.map(item => [item.id, item])).values());

      // Parse local subjects too
      const finalResources = uniqueResources.map(r => ({
          ...r,
          subject: r.subject || (r.data && r.data.subject) || 'Tự do'
      }));

      if (typeFilter) return finalResources.filter(r => r.type === typeFilter).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return finalResources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  publishResource: async (resource: Omit<SharedResource, 'id' | 'user_id' | 'created_at' | 'likes' | 'downloads'>): Promise<{ success: boolean; status: 'cloud' | 'local' | 'error'; error?: string }> => {
      // Prepare payload
      const payloadData = { ...resource.data, subject: resource.subject || 'Tự do' };
      
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            // IMPORTANT: Do NOT use a random string like 'anon_user' if the DB expects UUID. 
            // Use undefined (Supabase/Postgres will handle default or NULL) or a valid UUID.
            // If the table schema for user_id is uuid references auth.users, passing a random string causes 22P02 or 23503.
            // If user is null, we pass null (assuming RLS allows anon inserts with null user_id).
            const userId = user ? user.id : undefined; 
            
            const { error } = await supabase.from('shared_resources').insert({
                    user_id: userId,
                    username: resource.username,
                    avatar: resource.avatar,
                    type: resource.type,
                    title: resource.title,
                    description: resource.description,
                    data: payloadData
                });
            if (!error) return { success: true, status: 'cloud' };
            
            console.warn("Cloud publish error:", error);
            // Return the specific error message to help debugging
            if (error.code === '42501') return { success: false, status: 'error', error: 'Lỗi phân quyền (RLS). Vui lòng chạy SQL cập nhật.' };
            if (error.code === '23503' || error.code === '22P02') return { success: false, status: 'error', error: 'Lỗi định dạng ID người dùng.' };
            return { success: false, status: 'error', error: error.message };

          } catch (e: any) { console.warn("Cloud publish exception, trying local", e); }
      }

      // Local Fallback
      try {
          const str = JSON.stringify(resource);
          if (str.length > 4 * 1024 * 1024) {
              return { success: false, status: 'error', error: 'File quá lớn để lưu offline.' };
          }

          const newResource: SharedResource = {
              id: `local-${Date.now()}`,
              user_id: 'local',
              created_at: new Date().toISOString(),
              likes: 0,
              downloads: 0,
              ...resource,
              subject: resource.subject,
              data: payloadData
          };

          const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
          const localData: SharedResource[] = localStr ? JSON.parse(localStr) : [];
          const updatedData = [newResource, ...localData].slice(0, 20);
          localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(updatedData));
          return { success: true, status: 'local' };
      } catch (e: any) {
          if (e.name === 'QuotaExceededError') {
              return { success: false, status: 'error', error: 'Bộ nhớ trình duyệt đầy. Vui lòng xóa bớt bài cũ.' };
          }
          return { success: false, status: 'error', error: e.message };
      }
  },

  retryPublish: async (localId: string): Promise<{ success: boolean; error?: string }> => {
      if (!supabase) return { success: false, error: "Chưa cấu hình Supabase" };
      
      try {
          const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
          if (!localStr) return { success: false, error: "Không tìm thấy dữ liệu Local" };
          
          const localData: SharedResource[] = JSON.parse(localStr);
          const resource = localData.find(r => r.id === localId);
          
          if (!resource) return { success: false, error: "Bài viết không tồn tại" };

          const { data: { user } } = await supabase.auth.getUser();
          const userId = user ? user.id : undefined; 

          const { error } = await supabase.from('shared_resources').insert({
                user_id: userId,
                username: resource.username,
                avatar: resource.avatar,
                type: resource.type,
                title: resource.title,
                description: resource.description,
                subject: resource.subject || 'Tự do',
                data: resource.data
          });

          if (!error) {
              const updatedData = localData.filter(r => r.id !== localId);
              localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(updatedData));
              return { success: true };
          } else {
              console.warn("Retry upload failed:", error);
              if (error.code === '42501') return { success: false, error: 'Lỗi quyền truy cập (RLS). Hãy kiểm tra SQL.' };
              return { success: false, error: error.message };
          }
      } catch (e: any) {
          return { success: false, error: e.message || "Lỗi không xác định" };
      }
  },

  deleteResource: async (resourceId: string): Promise<boolean> => {
      // 1. Delete from Local Storage
      if (resourceId.startsWith('local-')) {
          try {
              const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
              if (localStr) {
                  const localData: SharedResource[] = JSON.parse(localStr);
                  const updatedData = localData.filter(r => r.id !== resourceId);
                  localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(updatedData));
                  return true;
              }
          } catch(e) { return false; }
      }

      // 2. Delete from Cloud
      if (supabase) {
          try {
              const { error } = await supabase.from('shared_resources').delete().eq('id', resourceId);
              return !error;
          } catch (e) { return false; }
      }
      return false;
  },

  toggleLikeResource: async (resourceId: string, currentLikes: number, increment: boolean): Promise<number> => {
      const newCount = Math.max(0, currentLikes + (increment ? 1 : -1));
      
      if (supabase && !resourceId.startsWith('local-')) {
          try {
              // Optimistic update for UI, fire and forget DB update
              await supabase.from('shared_resources').update({ likes: newCount }).eq('id', resourceId);
          } catch (e) { console.error("Failed to update cloud likes", e); }
      } else {
          // Update local
          try {
              const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
              if (localStr) {
                  const localData: SharedResource[] = JSON.parse(localStr);
                  const index = localData.findIndex(r => r.id === resourceId);
                  if (index !== -1) {
                      localData[index].likes = newCount;
                      localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(localData));
                  }
              }
          } catch (e) {}
      }
      return newCount;
  }
};
