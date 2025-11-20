
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jypggmijikgdogcteogb.supabase.co';
// Đã cập nhật Key chuẩn (JWT) của bạn
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cGdnbWlqaWtnZG9nY3Rlb2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjkwOTIsImV4cCI6MjA3OTIwNTA5Mn0.XI1Rd7YtuUFA_7q71t5qWOj1Pjjs71cpDAC8luzn7iM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
