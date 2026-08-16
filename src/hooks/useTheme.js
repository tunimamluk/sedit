import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "sedit-theme";

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState(initial);
  const firstRun = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked */
    }

    // Colour transitions are switched on only for the moment of the swap, so
    // they never interfere with hover states or the first paint.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    root.classList.add("theme-switching");
    const t = setTimeout(() => root.classList.remove("theme-switching"), 300);
    return () => clearTimeout(t);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);

  return [theme, toggle];
}
