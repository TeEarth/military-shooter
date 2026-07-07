import { NextRequest, NextResponse } from "next/server";

/**
 * Deliberate logout (the HOME page's LOGOUT button) — bypasses next-auth/react's
 * client-side signOut() entirely. That call was producing a raw Vercel platform
 * 404 (NOT_FOUND) instead of landing on /login, which points at a redirect/
 * callbackUrl resolution issue in this specific deployment rather than
 * anything session-related. Since this app uses the JWT session strategy
 * (no server-side session row to invalidate), clearing the session cookie
 * IS a complete logout — no different from what force-logout/route.ts already
 * does for the "stale session" case, just triggered intentionally here.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));

  const expired = { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax" as const };
  res.cookies.set("authjs.session-token", "", expired);
  res.cookies.set("__Secure-authjs.session-token", "", { ...expired, secure: true });

  return res;
}
