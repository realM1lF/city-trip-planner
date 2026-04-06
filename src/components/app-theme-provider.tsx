"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeSetting = "dark" | "light" | "system";

type ThemeContextValue = {
  /** Auswahl in localStorage */
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  /** Effektiv hell/dunkel (nach System, wenn theme === system) */
  resolvedTheme: "dark" | "light";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveEffective(theme: ThemeSetting): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return getSystemDark();
}

export function AppThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeSetting>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(
    "light"
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeSetting | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
    setResolvedTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const dark = resolveEffective(theme);
    document.documentElement.classList.toggle("dark", dark);
    setResolvedTheme(dark ? "dark" : "light");

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const d = getSystemDark();
      document.documentElement.classList.toggle("dark", d);
      setResolvedTheme(d ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, ready]);

  const setTheme = useCallback((t: ThemeSetting) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme muss innerhalb von AppThemeProvider stehen.");
  }
  return ctx;
}
