/**
 * AnomalyFeed — the proactive "sentinel" surface.
 *
 * Shows what Titus-Prime caught without being asked: late-payer churn signals,
 * renewal traps, concentration risk, cash danger. This is the difference between
 * a dashboard you read and a guardian that watches.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radar, AlertTriangle, TriangleAlert, Eye, RefreshCw } from "lucide-react";

type Anomaly = {
  id: string;
  severity: "high" | "medium" | "low";
  kind: string;
  title: string;
  detail: string;
  amountUsd?: number;
  agent: string;
};

const sevStyle: Record<Anomaly["severity"], string> = {
  high: "border-rose-500/30 bg-rose-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border bg-background/40",
};
const sevDot: Record<Anomaly["severity"], string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-muted-foreground",
};

export function AnomalyFeed({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannedAt, setScannedAt] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/value/anomalies");
      const j = await r.json();
      setItems(j.anomalies ?? []);
      setScannedAt(j.scannedAt ?? Date.now());
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const highCount = items.filter((a) => a.severity === "high").length;

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-background/40">
        <div className="flex items-center gap-2">
          <Radar className={`h-4 w-4 text-primary ${loading ? "animate-pulse" : ""}`} />
          <h3 className="text-sm font-semibold">Sentinel</h3>
          <span className="text-[11px] text-muted-foreground mono">{items.length} flagged</span>
          {highCount > 0 && (
            <span className="rounded-full bg-rose-500/15 text-rose-300 px-2 py-0.5 text-[10px]">
              {highCount} urgent
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          title="Re-scan"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-[360px] overflow-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-lg border p-3 ${sevStyle[a.severity]}`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${sevDot[a.severity]} ${a.severity === "high" ? "pulse-dot" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{a.title}</span>
                    {a.severity === "high" ? (
                      <TriangleAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
                  <div className="mt-1 text-[10px] mono uppercase tracking-wider text-muted-foreground">
                    {a.agent} agent
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Eye className="h-5 w-5 text-emerald-400" />
            All clear. Sentinel is watching — nothing needs your attention right now.
          </div>
        )}
      </div>

      {scannedAt && (
        <div className="border-t border-border px-4 py-1.5 text-[10px] mono text-muted-foreground">
          last scan · {new Date(scannedAt).toLocaleTimeString([], { hour12: false })}
        </div>
      )}
    </div>
  );
}
