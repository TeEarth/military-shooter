import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client, authenticated with the PUBLIC anon key —
 * never import the service-role client (src/lib/supabase/client.ts) into a
 * "use client" component; that key must never reach the browser.
 *
 * This client exists ONLY to talk to Supabase Realtime directly from the
 * browser (PvP match broadcast channels + the match-found Postgres Changes
 * subscription) — a connection that goes straight from the browser to
 * Supabase's Realtime service, not through our Next.js server, which is what
 * makes real-time sync possible at all on Vercel's serverless functions
 * (those can't hold a persistent WebSocket open).
 */
let client: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
