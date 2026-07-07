"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/lib/i18n";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </NextAuthSessionProvider>
  );
}
