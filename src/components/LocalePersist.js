"use client";

import { useEffect } from "react";

const localeCookie = "chessview_locale";
const storageKey = "chessview_locale";

export function LocalePersist({ locale }) {
  useEffect(() => {
    localStorage.setItem(storageKey, locale);
    document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
