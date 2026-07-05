import { NextRequest, NextResponse } from "next/server";
import { invalidateAllCache } from "@/lib/google/cache";

/**
 * v8 #2: reset-test-account.ts runs as a SEPARATE Node process from the
 * running Next.js server — its own `invalidateSheetCache()` call only clears
 * that script process's own in-memory cache (which is thrown away when the
 * script exits anyway), never the live server's cache. That's why the sheet
 * data was correctly reset but the web app kept showing stale stage progress
 * until the TTL expired. This route lets the script (or anyone with the
 * shared secret) tell the ACTUAL running server to drop its cache immediately.
 *
 * Guarded by NEXTAUTH_SECRET (already required for the app to run at all) so
 * this can't be used by randoms to force repeated full-sheet re-reads and
 * make the quota problem worse.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  invalidateAllCache();
  return NextResponse.json({ success: true });
}
