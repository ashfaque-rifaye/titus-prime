/**
 * ConnectionsPanel — the integration tile bar at the top of the Boardroom.
 *
 * Shows every connector with its category, region badges, real-vs-sandbox
 * status, and last-sync timestamp. A single "Sync now" button kicks off a
 * fan-out across every connector.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plug, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

type ConnectorMeta = {
  id: string;
  displayName: string;
  category: string;
  icon: string;
  description: string;
  regions: string[];
  real: boolean;
  configured: boolean;
  lastSync: number | null;
};

type SyncReport = {
  durationMs: number;
  results: Array<{ connector: string; ok: boolean; itemsIngested: number; detail: string; error?: string }>;
};

export function ConnectionsPanel({
  onSynced,
}: {
  onSynced?: (report: SyncReport) => void;
}) {
  const [items, setItems] = useState<ConnectorMeta[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);

  async function fetchList() {
    try {
      const r = await fetch("/api/connectors/list");
      if (!r.ok) return;
      const j = await r.json();
      setItems(j.connectors);
    } catch {
      /* ignore */
    }
  }

  async function syncAll() {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(`sync failed: ${r.status}`);
      const report: SyncReport = await r.json();
      setLastReport(report);
      onSynced?.(report);
      const okCount = report.results.filter((x) => x.ok).length;
      toast.success(`Synced ${okCount} sources in ${report.durationMs}ms`);
      await fetchList();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchList();
    // Auto-sync on mount — the cockpit is "alive" when you walk in.
    syncAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Connected Sources</h3>
          <span className="text-[11px] mono text-muted-foreground">
            {items.filter((i) => i.lastSync).length}/{items.length} synced
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastReport && (
            <span className="text-[10px] mono text-muted-foreground">
              last sync · {lastReport.durationMs}ms · {lastReport.results.reduce((s, r) => s + r.itemsIngested, 0)} items
            </span>
          )}
          <button
            onClick={syncAll}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 hover:bg-primary/25 px-3 py-1.5 text-[11px] font-semibold accent-text border border-primary/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((c, idx) => {
          const synced = !!c.lastSync;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`rounded-xl border ${synced ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background/40"} p-2.5 relative overflow-hidden`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{c.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{c.displayName}</div>
                    <div className="text-[10px] text-muted-foreground capitalize mono">{c.category}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {c.real ? (
                    <span className="text-[8px] mono uppercase rounded bg-emerald-500/15 text-emerald-300 px-1 py-px border border-emerald-500/30">live</span>
                  ) : (
                    <span className="text-[8px] mono uppercase rounded bg-muted/40 text-muted-foreground px-1 py-px border border-border">sandbox</span>
                  )}
                  {synced ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : syncing ? (
                    <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-muted-foreground/60" />
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1 flex-wrap">
                {c.regions.map((r) => (
                  <span key={r} className="text-[9px] mono uppercase rounded bg-background/60 text-muted-foreground px-1 border border-border">{r}</span>
                ))}
              </div>
              <AnimatePresence>
                {synced && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-0 right-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
                  />
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {lastReport && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 accent-text" />
          <span className="text-[11px] text-foreground">
            Boardroom hydrated from {lastReport.results.filter((r) => r.ok && r.itemsIngested > 0).length} sources.
            Agents will read these as ground truth.
          </span>
        </div>
      )}
    </div>
  );
}
