/** One-off connectivity smoke test — confirms the Supabase URL + service role
 *  key in .env are valid and reachable, independent of whether the runtime
 *  schema (scripts/sql/001_runtime_schema.sql) has been applied yet.
 *  Run with: npx tsx scripts/test-supabase-connection.ts */
import "dotenv/config";
import { getSupabaseClient } from "../src/lib/supabase/client";

async function main() {
  const supabase = getSupabaseClient();
  // auth.admin works with the service-role key regardless of whether any
  // app tables exist yet — a pure "is this project reachable" check.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (error) {
    console.error("Connection FAILED:", error.message);
    process.exit(1);
  }
  console.log("Connection OK — project reachable. Auth users on this project:", data.users.length >= 0 ? "(query succeeded)" : "?");

  // Now check whether the runtime schema has been applied yet.
  const { error: playersError } = await supabase.from("players").select("id").limit(1);
  if (playersError) {
    console.log("`players` table not found yet — run scripts/sql/001_runtime_schema.sql in the Supabase SQL Editor.");
  } else {
    console.log("`players` table exists — schema already applied.");
  }
}

main();
