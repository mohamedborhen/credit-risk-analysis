"use client";

import { useState, useEffect, useCallback } from "react";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

type Lang = "fr" | "ar";
type TranslationKey = keyof typeof fr;

const DICTIONARIES: Record<Lang, Record<string, string>> = { fr, ar };

/**
 * useTranslation — lightweight i18n hook (no external library).
 * Reads lang from localStorage["finscore_lang"] and listens for the
 * custom "langchange" event dispatched by the Navbar toggle.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   <h1>{t("marketplace_title")}</h1>
 */
export function useTranslation() {
  const getInitialLang = (): Lang => {
    if (typeof window === "undefined") return "fr";
    return (localStorage.getItem("finscore_lang") as Lang) || "fr";
  };

  const [lang, setLang] = useState<Lang>(getInitialLang);

  useEffect(() => {
    // Sync on mount (in case SSR returned "fr")
    setLang(getInitialLang());

    // Listen for Navbar language toggle events
    const onLangChange = () => {
      const next = (localStorage.getItem("finscore_lang") as Lang) || "fr";
      console.log("[useTranslation] Language changed to:", next);
      setLang(next);
    };

    window.addEventListener("langchange", onLangChange);
    return () => window.removeEventListener("langchange", onLangChange);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return DICTIONARIES[lang][key] ?? DICTIONARIES["fr"][key] ?? key;
    },
    [lang]
  );

  return { t, lang };
}
