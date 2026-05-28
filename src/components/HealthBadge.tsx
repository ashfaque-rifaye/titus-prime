/**
 * HealthBadge
 *
 * Polls /api/llm/health and renders the live status of both engines in the top
 * navigation. Click for a popover with full diagnostics.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Health = {
  engine: "gemini" | "codex";
  ok: boolean;
  latencyMs: number;
  detail: string;
  checkedAt: string;
};
type HealthResponse = {
  primary: "gemini" | "codex";
  fallback: "gemini" | "codex";
  active: "gemini" | "codex";
  results: Health[];
};

export function HealthBadge() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(0);

  async function check() {
    try {
      const resp = await fetch("/api/llm/health");
      if (resp.ok) {
        const json: HealthResponse = await resp.json();
        setData(json);
        setPulse((p) => p + 1);
      }
    } catch {
      /* network blip; UI stays on last-known state */
    }
  }

  useEffect(() => {
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  const active = data?.results.find((r) => r.engine === data.active);
  const ok = active?.ok ?? false;

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 py-1 text-[11px] mono text-muted-foreground hover:border-primary/40 hover:text-foreground transition"
        title="LLM health"
      >
        <span className="relative inline-flex h-2 w-2">
          <span className={`absolute inset-0 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
          <motion.span
            key={pulse}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 1.2 }}
            className={`absolute inset-0 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
          />
        </span>
        <span>{data ? data.active : "…"}</span>
        {active && <span className="text-foreground/70">{active.latencyMs}ms</span>}
      </motion.button>
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-[320px] rounded-lg border border-border bg-surface/95 backdrop-blur p-3 text-xs shadow-xl z-50"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">LLM Engines</div>
              <button onClick={() => check()} className="text-[10px] mono text-muted-foreground hover:text-foreground">
                refresh
              </button>
            </div>
            {data.results.map((r) => (
              <div key={r.engine} className="rounded-md border border-border bg-background/60 p-2 mb-1.5 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-emerald-400" : "bg-rose-400"}`} />
                    <span className="mono">{r.engine}</span>
                    {r.engine === data.active && (
                      <span className="rounded bg-primary/15 px-1 py-px text-[9px] accent-text">ACTIVE</span>
                    )}
                    {r.engine === data.fallback && r.engine !== data.active && (
                      <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] text-amber-300">FALLBACK</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">{r.latencyMs}ms</span>
                </div>
                <div className="mt-1 text-muted-foreground line-clamp-2">{r.detail}</div>
              </div>
            ))}
            <div className="mt-2 text-[10px] mono text-muted-foreground">
              primary: {data.primary} · fallback: {data.fallback}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
