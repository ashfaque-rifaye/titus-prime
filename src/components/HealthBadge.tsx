/**
 * HealthBadge
 *
 * The dot + label reflect the Codex engine's *configured* status, polled from
 * the credit-free /api/llm/health endpoint (no API call, no token spend).
 *
 * The popover has an explicit "Ping Codex" button. ONLY that button performs a
 * real Codex API call (/api/llm/ping, ~1 token). Nothing else here spends
 * credits — the auto-poll is purely configuration status.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Health = {
  engine: "codex";
  ok: boolean;
  latencyMs: number;
  detail: string;
  checkedAt: string;
};
type HealthResponse = {
  primary: "codex";
  fallback: "codex";
  active: "codex";
  results: Health[];
};

export function HealthBadge() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<Health | null>(null);

  // Credit-free configuration status poll. Never calls the Codex API.
  async function checkConfig() {
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

  // REAL ping — spends ~1 token. Manual only.
  async function pingCodex() {
    if (pinging) return;
    setPinging(true);
    setPingResult(null);
    try {
      const resp = await fetch("/api/llm/ping", { method: "POST" });
      if (resp.ok) {
        const json: HealthResponse = await resp.json();
        setPingResult(json.results[0] ?? null);
      } else {
        setPingResult({
          engine: "codex",
          ok: false,
          latencyMs: 0,
          detail: `Ping failed (HTTP ${resp.status})`,
          checkedAt: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      setPingResult({
        engine: "codex",
        ok: false,
        latencyMs: 0,
        detail: e?.message ?? "network error",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setPinging(false);
    }
  }

  useEffect(() => {
    checkConfig();
    const t = setInterval(checkConfig, 30_000);
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
        title="Codex engine status"
      >
        <span className="relative inline-flex h-2 w-2">
          <span
            className={`absolute inset-0 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
          />
          <motion.span
            key={pulse}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 1.2 }}
            className={`absolute inset-0 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
          />
        </span>
        <span>codex</span>
        <span className="text-foreground/70">{ok ? "operational" : "offline"}</span>
      </motion.button>
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-[340px] rounded-lg border border-border bg-surface/95 backdrop-blur p-3 text-xs shadow-xl z-50"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">Codex Engine</div>
              <span className="text-[10px] mono text-muted-foreground">config status · no tokens</span>
            </div>

            {data.results.map((r) => (
              <div
                key={r.engine}
                className="rounded-md border border-border bg-background/60 p-2 mb-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-emerald-400" : "bg-rose-400"}`}
                    />
                    <span className="mono">codex</span>
                    <span className="rounded bg-primary/15 px-1 py-px text-[9px] accent-text">
                      {r.ok ? "OPERATIONAL" : "OFFLINE"}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-muted-foreground line-clamp-2">{r.detail}</div>
              </div>
            ))}

            {/* Manual ping — the ONLY thing here that spends a token */}
            <button
              onClick={pingCodex}
              disabled={pinging}
              className="w-full rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-[11px] accent-text hover:bg-primary/20 transition disabled:opacity-50"
            >
              {pinging ? "Pinging Codex…" : "Ping Codex (live · ~1 token)"}
            </button>

            <AnimatePresence>
              {pingResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-2 rounded-md border p-2 ${
                    pingResult.ok
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/5 text-rose-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="mono text-[10px]">
                      {pingResult.ok ? "LIVE" : "FAILED"}
                    </span>
                    {pingResult.latencyMs > 0 && (
                      <span className="text-[10px] text-muted-foreground">{pingResult.latencyMs}ms</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px]">{pingResult.detail}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-2 text-[10px] mono text-muted-foreground">
              Auto-status is config-only. Codex API is called on agent runs and this ping.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
