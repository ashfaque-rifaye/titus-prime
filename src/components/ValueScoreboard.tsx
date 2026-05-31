/**
 * ValueScoreboard — the "Money Found" receipt.
 *
 * The single component that answers a CFO's first question: "what did this
 * actually get me?" Shows a running tally of dollars protected/recovered/saved
 * and time returned, split into realized vs. projected, with a proven recovery
 * rate from outcome tracking. Refreshes after every agent run.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  ShieldCheck,
  Mail,
  CalendarX,
  Clock,
  Sparkles,
  Target,
  RefreshCw,
} from "lucide-react";

type ValueCategory = "protected" | "recovered" | "saved" | "time";

type Scoreboard = {
  totalUsd: number;
  realizedUsd: number;
  projectedUsd: number;
  minutesSaved: number;
  hoursSaved: number;
  byCategory: Record<ValueCategory, number>;
  recentEvents: { id: string; label: string; amountUsd: number; status: string; agent: string }[];
  eventCount: number;
};

type OutcomeStats = {
  recoveryRatePct: number;
  success: number;
  resolved: number;
  recoveredUsd: number;
};

const CATS: { key: ValueCategory; label: string; Icon: React.ElementType }[] = [
  { key: "protected", label: "Cash protected", Icon: ShieldCheck },
  { key: "recovered", label: "AR recovered", Icon: Mail },
  { key: "saved", label: "Renewals & spend saved", Icon: CalendarX },
];

/** Smooth count-up to a target value. */
function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function ValueScoreboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomeStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [b, o] = await Promise.all([
        fetch("/api/value/scoreboard").then((r) => r.json()),
        fetch("/api/value/outcomes").then((r) => r.json()),
      ]);
      setBoard(b);
      setOutcomes(o);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const total = useCountUp(board?.totalUsd ?? 0);
  const hours = board?.hoursSaved ?? 0;
  const realizedPct =
    board && board.totalUsd > 0 ? Math.round((board.realizedUsd / board.totalUsd) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface/60 to-surface/60 p-5 ambient-glow">
      {/* glow accent */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        {/* Hero number */}
        <div className="min-w-[260px]">
          <div className="flex items-center gap-2 text-[11px] mono uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Money Found · this month
          </div>
          <div className="mt-1 flex items-end gap-3">
            <motion.div
              key={board?.totalUsd ?? 0}
              initial={{ scale: 0.98, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-5xl font-bold tracking-tight tabular-nums accent-text"
            >
              {usd(total)}
            </motion.div>
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="mb-2 text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            across <span className="text-foreground font-medium">{hours} hours</span> of work the
            agents handled for you{board ? ` · ${board.eventCount} actions` : ""}.
          </p>

          {/* realized vs projected bar */}
          <div className="mt-3 max-w-sm">
            <div className="flex justify-between text-[10px] mono text-muted-foreground mb-1">
              <span className="text-emerald-300">Realized {usd(board?.realizedUsd ?? 0)}</span>
              <span className="text-amber-300">Projected {usd(board?.projectedUsd ?? 0)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-amber-500/20">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${realizedPct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Proven recovery rate */}
        {outcomes && (
          <div className="rounded-xl border border-border bg-background/40 p-4 text-center min-w-[150px]">
            <div className="flex items-center justify-center gap-1.5 text-[10px] mono uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3" /> Proven recovery
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-emerald-300">
              {outcomes.recoveryRatePct}%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {outcomes.success}/{outcomes.resolved} reminders paid
            </div>
            <div className="mt-1 text-[11px] mono text-emerald-300/80">
              {usd(outcomes.recoveredUsd)} collected
            </div>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CATS.map(({ key, label, Icon }) => (
          <div key={key} className="rounded-lg border border-border bg-background/40 p-3">
            <Icon className="h-4 w-4 text-primary/80" />
            <div className="mt-2 text-sm font-semibold tabular-nums">
              {usd(board?.byCategory[key] ?? 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <Clock className="h-4 w-4 text-primary/80" />
          <div className="mt-2 text-sm font-semibold tabular-nums">{hours}h</div>
          <div className="text-[10px] text-muted-foreground">Time saved</div>
        </div>
      </div>

      {/* Recent ledger ticker */}
      {board && board.recentEvents.length > 0 && (
        <div className="relative mt-4 border-t border-border pt-3">
          <div className="text-[10px] mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Recent value events
          </div>
          <div className="flex flex-wrap gap-1.5">
            {board.recentEvents.slice(0, 6).map((e) => (
              <span
                key={e.id}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${
                  e.status === "realized"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-200/90"
                }`}
              >
                <span className="mono">{usd(e.amountUsd)}</span>
                <span className="truncate max-w-[180px]">{e.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {board && board.eventCount === 0 && (
        <div className="relative mt-4 rounded-lg border border-dashed border-border bg-background/30 p-4 text-center text-sm text-muted-foreground">
          No value recorded yet. Run a full sweep — every action the agents take will tally here as
          proven dollars and hours.
        </div>
      )}
    </div>
  );
}
