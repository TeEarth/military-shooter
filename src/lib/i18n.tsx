"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Language = "en" | "th";

const STORAGE_KEY = "app_language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
});

/** Defaults to English; only ever becomes Thai if the player explicitly
 *  switched it in Settings (persisted in localStorage) — per the request
 *  that pages like Inventory must not silently default to Thai anymore. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "th" || saved === "en") setLanguageState(saved);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

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
