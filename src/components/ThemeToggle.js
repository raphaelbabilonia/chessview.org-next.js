"use client";

import { Moon, Sun } from "lucide-react";

const storageKey = "chessview_theme";

export function ThemeToggle({ label }) {
  const toggleTheme = () => {
    const currentTheme = document.documentElement.dataset.theme || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(storageKey, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  };

  return (
    <button className="icon-button" type="button" onClick={toggleTheme} aria-label={label}>
      <Moon className="theme-icon theme-icon-moon" size={18} aria-hidden="true" />
      <Sun className="theme-icon theme-icon-sun" size={18} aria-hidden="true" />
    </button>
  );
}
