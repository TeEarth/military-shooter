import { NextRequest, NextResponse } from "next/server";

/**
 * A session cookie can be cryptographically valid (correctly signed, not
 * expired) while pointing at a playerId that no longer exists in the Players
 * sheet — this happens whenever the sheet is wiped/reseeded (schema
 * migrations, resets) while a browser still holds an old session. Without a
 * database, NextAuth has no way to detect that on its own.
 *
 * If that happens, every protected page's `if (!player) redirect("/login")`
 * would otherwise create an infinite loop: /login sees the (still valid)
 * session and bounces to /home, /home finds no player row and bounces back
 * to /login. This route breaks that loop by actually clearing the stale
 * cookie before redirecting to /login, so the user lands on a real sign-in
 * form instead of bouncing forever.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));

  // v12: plain res.cookies.delete(name) was silently failing in production
  // specifically for "__Secure-"-prefixed cookies. Per the cookie-prefix spec
  // (RFC 6265bis), a browser REJECTS any Set-Cookie for a "__Secure-"-prefixed
  // name that doesn't also carry the Secure attribute — including deletions —
  // so on Vercel (HTTPS, where NextAuth uses the "__Secure-" prefix) the old
  // session cookie never actually got cleared, and /login -> /home ->
  // force-logout -> /login looped forever. Explicitly setting `secure: true`
  // for that name (never needed on http://localhost, which is why this only
  // showed up in production) fixes it. `httpOnly`/`sameSite` are set to match
  // the original login cookie's attributes, though only `secure` is required
  // by the browser to actually accept the deletion.
  const expired = { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax" as const };
  res.cookies.set("authjs.session-token", "", expired);
  res.cookies.set("__Secure-authjs.session-token", "", { ...expired, secure: true });

  return res;
}
