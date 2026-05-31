import { useTheme } from "@/lib/theme";
import { motion } from "motion/react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative flex items-center rounded-full border border-border bg-surface p-0.5">
      {(["lime", "indigo"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className="relative z-10 px-3 py-1 text-xs font-medium capitalize transition-colors"
          style={{ color: theme === t ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
        >
          {theme === t && (
            <motion.span
              layoutId="theme-pill"
              className="absolute inset-0 -z-10 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {t}
        </button>
      ))}
    </div>
  );
}
