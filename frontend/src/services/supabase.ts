/**
 * Frontend Supabase client — used for Realtime subscriptions only.
 * This client uses the anon key and provides read-only access
 * governed by RLS policies.
 *
 * The Supabase URL and anon key are injected at build time via
 * Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseClient: SupabaseClient | null = null;

export function isRealtimeEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });
  }

  return supabaseClient;
}
