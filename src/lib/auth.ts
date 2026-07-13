import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createPlayer, getPlayerByEmail, verifyPassword } from "./db/player";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // v24: Auth.js's default Google provider does live OIDC discovery on
      // EVERY sign-in attempt (a fetch to accounts.google.com/.well-known/
      // openid-configuration inside getAuthorizationUrl) — that fetch was
      // throwing consistently in this Vercel deployment (confirmed via the
      // server log stack trace, which dies inside that exact function) and
      // Auth.js masks any non-whitelisted thrown error as a generic
      // "Configuration" page, which is what was showing up. Supplying the
      // authorization URL directly skips discovery entirely — these are
      // Google's own stable, publicly documented OAuth 2.0 endpoints, not
      // going to change.
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: { scope: "openid email profile" },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const player = await verifyPassword(credentials.email as string, credentials.password as string);
        if (!player) return null;
        // v16: banned accounts can't log in at all — Admin's ban/suspend
        // button (see /admin) is otherwise unenforceable.
        if (player.isBanned) return null;
        return { id: player.id, email: player.email, name: player.username, isAdmin: player.isAdmin };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: create the player row in Google Sheets on first login (no adapter/DB to do this for us)
      if (account?.provider === "google" && user.email) {
        const existing = await getPlayerByEmail(user.email);
        if (!existing) {
          const created = await createPlayer({ email: user.email, username: user.name ?? "Soldier" });
          user.id = created.id;
          user.isAdmin = created.isAdmin;
        } else {
          if (existing.isBanned) return false;
          user.id = existing.id;
          user.isAdmin = existing.isAdmin;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isAdmin = token.isAdmin as boolean | undefined;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  // v24: NEXTAUTH_URL is pinned to one specific domain (military-shooter.vercel.app),
  // but Vercel serves this project on several aliases (military-shooter-kappa.vercel.app,
  // the per-deploy *.vercel.app URL, etc.) — Auth.js v5 refuses any request whose
  // actual Host header doesn't match NEXTAUTH_URL unless the host is explicitly
  // trusted, which was surfacing as a generic "Configuration" error on every
  // domain except the one exact NEXTAUTH_URL value. trustHost: true is the
  // standard fix for platforms (Vercel included) that serve one app on multiple
  // domains — same as this project's `/api/auth/[...nextauth]` route already
  // trusting the platform-provided host.
  trustHost: true,
});
