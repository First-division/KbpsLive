import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function createPublicClient() {
  if (!url && !key) return null;
  if (!url || !key) {
    console.warn('[Schedule] Both Supabase URL and public key are required.');
    return null;
  }
  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch (error) {
    console.warn('[Schedule] Invalid Supabase configuration:', error);
    return null;
  }
}

export const supabase = createPublicClient();
export const scheduleCacheKey = `@kbps/schedule/v1/${url ?? 'unconfigured'}`;
