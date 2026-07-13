"use client";

import { createContext, useCallback, useContext } from "react";

export type Language = "en" | "th";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
});

/** v24: Thai support only ever covered the Inventory page (every other page
 *  is English-only), which read as a broken/half-translated toggle — the
 *  Settings switcher was removed, and this now always stays "en" (ignoring
 *  any "th" a player switched to before that removal) rather than leaving a
 *  dead code path that could still show a half-translated app. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language: Language = "en";
  const setLanguage = useCallback(() => {}, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Pick the right string for the current language out of an {en, th} pair —
 *  the common case for short inline UI labels that don't need a full
 *  translation-table lookup. */
export function useT() {
  const { language } = useLanguage();
  return useCallback((pair: { en: string; th: string }) => (language === "th" ? pair.th : pair.en), [language]);
}
