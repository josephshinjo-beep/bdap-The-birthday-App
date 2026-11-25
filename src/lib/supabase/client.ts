"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** Browser client (anon key + the user's session cookie). RLS applies. */
export function getBrowserSupabase(): SupabaseClient {
  return (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY));
}
