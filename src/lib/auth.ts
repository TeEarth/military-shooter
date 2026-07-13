import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createPlayer, getPlayerByEmail, verifyPassword } from "./db/player";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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
  // v24 TEMP: surfaces the real underlying "Configuration" error in server
  // logs instead of the generic sanitized one the client sees — remove once
  // the Google sign-in issue is diagnosed.
  debug: true,
});
