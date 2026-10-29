import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Check if Supabase credentials are validly configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseUrl.trim() !== '' && 
  !supabaseUrl.includes('placeholder')
);

// High-performance dummy proxy to prevent DNS timeout hangs when Supabase is not configured
function createDummyClient() {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (val: any) => void) => resolve({ data: null, error: null });
      }
      return (..._args: any[]) => new Proxy({}, handler);
    }
  };
  return new Proxy({}, handler);
}

// Guard: jika env var belum dikonfigurasi, gunakan dummy proxy instan agar app tidak lag/timeout
export const supabase: SupabaseClient = (isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDummyClient()) as any;


