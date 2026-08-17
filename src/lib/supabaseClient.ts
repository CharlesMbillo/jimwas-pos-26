import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const initialAuthRedirectError = typeof window !== 'undefined' && window.location.hash.includes('error')
  ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_code')
  : null;

let _supabase: SupabaseClient | null = null;

if (url && anonKey) {
  _supabase = createClient(url, anonKey);
}

export const supabase = _supabase;
export default supabase;
