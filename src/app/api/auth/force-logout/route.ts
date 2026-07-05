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

  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
    res.cookies.delete(name);
  }

  return res;
}
