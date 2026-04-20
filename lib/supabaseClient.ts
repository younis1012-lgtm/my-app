import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  /^https?:\/\//i.test(supabaseUrl);

const createSafeClient = (): SupabaseClient => {
  if (!isSupabaseConfigured) {
    return createClient('https://example.supabase.co', 'public-anon-key-placeholder', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {},
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {},
    },
  });
};

export const supabase = createSafeClient();
