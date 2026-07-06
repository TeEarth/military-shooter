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
        return { id: player.id, email: player.email, name: player.username };
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
        } else {
          user.id = existing.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
});
