import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "lime" | "indigo";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ theme: "lime", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("lime");

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && (localStorage.getItem("titus-theme") as Theme)) || "lime";
    setTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("titus-theme", theme);
    } catch {
      // Ignore storage failures in private browsing or locked-down webviews.
    }
  }, [theme]);

  return (
    <ThemeCtx.Provider
      value={{ theme, setTheme, toggle: () => setTheme(theme === "lime" ? "indigo" : "lime") }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
