import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WS from "ws";

/**
 * Server-only Supabase client, authenticated with the service-role key (full
 * access, bypasses Row Level Security entirely). NEVER import this from a
 * "use client" component or expose SUPABASE_SERVICE_ROLE_KEY to the browser —
 * every caller must be a server-side module (API route, server component, or
 * a script run via tsx), same boundary already enforced for
 * src/lib/google/auth.ts's Google service-account credentials.
 */
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 (this project's runtime) has no global WebSocket — only Node 22+
    // does — but supabase-js's realtime client constructs one eagerly even
    // when Realtime subscriptions are never used (as here, plain table
    // queries only). `ws` is the officially documented polyfill for this.
    realtime: { transport: WS as unknown as typeof WebSocket },
  });
  return client;
}
