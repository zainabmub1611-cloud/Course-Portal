"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/store";

/**
 * DirectionManager — runs on every page load to synchronise the HTML element's
 * lang/dir attributes with the stored language preference from localStorage.
 * This prevents FOUC (flash of untranslated content) on refresh.
 */
export function DirectionManager() {
  const { lang, dir } = useI18n();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    // Add or remove the arabic font class on body
    if (lang === "ar") {
      document.body.classList.add("font-arabic-active");
      document.body.classList.remove("font-sans");
    } else {
      document.body.classList.remove("font-arabic-active");
      document.body.classList.add("font-sans");
    }
  }, [lang, dir]);

  return null;
}
