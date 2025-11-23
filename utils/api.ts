
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
// Removes spaces and special chars to satisfy Supabase Email validation
export const generateAuthEmail = (username: string) => {
    if (!username) throw new Error("Tên đăng nhập không được để trống");

    // 1. Lowercase
    let clean = username.trim().toLowerCase();
    
    // 2. Remove Vietnamese accents (NFD normalization)
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 3. Replace spaces with underscores
    clean = clean.replace(/\s+/g, '_');
    
    // 4. Remove non-alphanumeric characters (except . _ -)
    clean = clean.replace(/[^a-z0-9._-]/g, '');
    
    // 5. Remove leading/trailing special chars
    clean = clean.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    
    // 6. Validation
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
          // Check auth service health with timeout
          const { error } = await timeoutPromise(supabase.auth.getSession(), 3000) as any;
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
            // Use timeout to prevent hang on slow network
            const { data: { session }, error: sessionError } = await timeoutPromise(supabase.auth.getSession(), 3000) as any;
            
            if (session?.user) {
                const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    return {
                        username: profile.username,
                        password: '', // Password not stored in profile
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
                
                // AUTO-HEAL
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
              console.warn("Cloud session restore failed or timed out, checking local", e);
          }
      }
      
      // Fallback to Local Cache
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
        try { authEmail = generateAuthEmail(cleanUsername); } catch (e: any) { throw new Error(e.message); }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: password,
        });

        if (error) {
            // Fallback check for local user
            const users = getLocalUsers();
            if (users[cleanUsername] && users[cleanUsername].password === password) {
                 return { user: users[cleanUsername], token: `local-token-${Date.now()}` };
            }
            if (error.message.includes("Invalid login credentials")) throw new Error("Tên đăng nhập hoặc mật khẩu không đúng.");
            throw new Error(`Lỗi đăng nhập: ${error.message}`);
        }

        if (data.user) {
             const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
             if (!profile) { /* Auto-heal logic exists in restoreSession */ }
             
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
             } : { username: cleanUsername, password: '', isDemo: false }; // Fallback minimal

             return { user: userObj, token: data.session?.access_token || '' };
        }
        throw new Error("Đăng nhập thất bại");

    } else {
        // LocalStorage Login
        await new Promise(resolve => setTimeout(resolve, 400));
        const users = getLocalUsers();
        const user = users[cleanUsername];
        if (!user || user.password !== password) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
        return { user, token: `local-token-${Date.now()}` };
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
        
        if (data.user && !data.session) throw new Error("Đăng ký thành công nhưng chưa có phiên làm việc. Vui lòng tắt 'Confirm Email' trong Supabase.");
        if (!data.user) throw new Error("Đăng ký thất bại");

        await supabase.from('profiles').insert({
            id: data.user.id,
            username: cleanUsername,
            email: realEmail,
            ai_role: newUser.aiRole,
            ai_tone: newUser.aiTone,
            theme: newUser.theme,
            avatar: newUser.avatar,
            font_preference: newUser.fontPreference,
            xp: 0,
            level: 1
        });

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
      return { user: { username: 'Khách (Demo)', password: '', aiRole: 'assistant', aiTone: 'balanced', theme: 'dark', avatar: '🚀', isDemo: true, xp: 0, level: 1 }, token: `demo-token-${Date.now()}` };
  },

  updateUser: async (username: string, updates: Partial<User>): Promise<User> => {
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const dbUpdates: any = {};
                // ... map updates to db columns (simplified for brevity, assumes match or handled)
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

                if (updates.password) await supabase.auth.updateUser({ password: updates.password });
                if (Object.keys(dbUpdates).length > 0) await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
                
                return { username, ...updates } as User;
            }
          } catch(e) { console.error("Cloud update failed", e); }
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

  // --- Chat Data Syncing ---

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
                return;
            }
          } catch (e) { console.warn("Could not save chat to cloud", e); }
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
            return;
          } catch (e) { console.warn("Could not delete cloud chat", e); }
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
          } catch (e) { console.error("Could not fetch leaderboard", e); }
      }
      
      const users = getLocalUsers();
      return Object.values(users).map(u => ({ username: u.username, avatar: u.avatar || '😊', xp: u.xp || 0, level: u.level || 1 })).sort((a, b) => b.xp - a.xp).slice(0, 20);
  },

  // --- Shared Resources ---
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
              let query = supabase.from('shared_resources').select('*').order('created_at', { ascending: false }).limit(50);
              if (typeFilter) query = query.eq('type', typeFilter);

              const { data, error } = await timeoutPromise(query, 5000) as any;
              if (!error && data) resources = [...resources, ...data];
          } catch (e) { console.error("Could not fetch shared resources from cloud", e); }
      }

      if (typeFilter) resources = resources.filter(r => r.type === typeFilter);
      return resources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  publishResource: async (resource: Omit<SharedResource, 'id' | 'user_id' | 'created_at' | 'likes' | 'downloads'>): Promise<boolean> => {
      let cloudSuccess = false;

      // 1. Try Cloud Publish
      if (supabase) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('shared_resources').insert({
                        user_id: user.id,
                        username: resource.username,
                        avatar: resource.avatar,
                        type: resource.type,
                        title: resource.title,
                        description: resource.description,
                        data: resource.data
                    });
                if (!error) cloudSuccess = true;
                else console.warn("Cloud publish failed:", error);
            }
          } catch (e) { console.error("Cloud publish exception:", e); }
      }

      if (cloudSuccess) return true;

      // 2. Fallback to Local Publish
      try {
          // Prevent saving huge blobs locally to avoid QuotaExceededError
          const resourceStr = JSON.stringify(resource);
          if (resourceStr.length > 4 * 1024 * 1024) { // > 4MB check
              console.warn("Resource too large for local storage");
              return false;
          }

          const newResource: SharedResource = {
              id: `local-${Date.now()}`,
              user_id: 'local-user',
              created_at: new Date().toISOString(),
              likes: 0,
              downloads: 0,
              ...resource
          };

          const localStr = localStorage.getItem(LOCAL_RESOURCES_KEY);
          const localData: SharedResource[] = localStr ? JSON.parse(localStr) : [];
          const updatedData = [newResource, ...localData].slice(0, 20);
          
          localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(updatedData));
          return true;
      } catch (e: any) {
          console.error("Local publish failed", e);
          // Check specifically for quota error
          if (e.name === 'QuotaExceededError' || e.code === 22) {
              alert("Bộ nhớ trình duyệt đã đầy. Không thể lưu thêm dữ liệu offline lớn.");
          }
          return false;
      }
  }
};
