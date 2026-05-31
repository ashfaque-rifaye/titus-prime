/**
 * TreasurySection — Treasury Sentinel hero card.
 *
 * Wraps the SolvencyChart with the operational caution banner, the deploy-
 * autopilot CTA, and the full-sweep button that triggers an orchestrator run.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, Rocket, Activity, CheckCircle2 } from "lucide-react";
import { SolvencyChart, type ProjectionPoint } from "./SolvencyChart";
import { toast } from "sonner";

type ProjectionPayload = {
  standby: ProjectionPoint[];
  autopilot: ProjectionPoint[];
  safetyFloor: number;
  summary: {
    standbyEndOfMonth: number;
    autopilotEndOfMonth: number;
    agentValue: number;
    breach: { day: number; balance: number; shortfall: number } | null;
    recommendedScenario: {
      chase: { id: string; customer: string; amount: number }[];
      pause: string[];
      delay: string | null;
      projectedRecovery: number;
      projectedSavings: number;
    };
  };
  view: {
    bankBalanceUsd: number;
    bankBalances: { account: string; balance: number; currency: string; balanceUsd: number }[];
    totals: { cashUsd: number; arUsd: number; apUsd: number; monthlySubsUsd: number };
  };
};

export function TreasurySection({
  onRunSweep,
  sweeping,
  refreshKey,
}: {
  onRunSweep: () => void;
  sweeping: boolean;
  refreshKey: number;
}) {
  const [data, setData] = useState<ProjectionPayload | null>(null);
  const [mode, setMode] = useState<"standby" | "autopilot">("standby");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/treasury/projection");
        if (!r.ok) return;
        const j: ProjectionPayload = await r.json();
        if (!cancelled) setData(j);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const breach = data?.summary.breach;
  const inCrunch = !!breach;

  return (
    <div className="space-y-4">
      {/* Operational caution banner */}
      <AnimatePresence mode="popLayout">
        {inCrunch ? (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 to-transparent p-5"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-pulse">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] mono uppercase tracking-widest text-rose-300 font-bold">
                    ⚠ Operational Caution: Cash Shortfall Projected
                  </div>
                  <div className="text-sm text-foreground mt-1">
                    Shortfall in <span className="mono accent-text">{breach.day} days</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    Projected deficit:{" "}
                    <span className="mono text-rose-300">${breach.balance.toLocaleString()}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="mono text-muted-foreground">
                      ${breach.shortfall.toLocaleString()} below floor
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 max-w-xl">
                    Deploy Autopilot Scenario to chase the top{" "}
                    {data?.summary.recommendedScenario.chase.length ?? 0} overdue customers, pause
                    non-essential subscriptions, and protect the safety floor.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMode("autopilot")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 px-3.5 py-2 text-[11px] mono uppercase tracking-tight text-rose-300 font-bold transition shrink-0"
              >
                <Rocket className="h-3.5 w-3.5" />
                Preview Autopilot Scenario
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="text-[11px] mono uppercase tracking-widest text-emerald-300">
                  Operating reserves stable
                </div>
                <div className="text-xs text-muted-foreground">
                  No cash shortfall projected within 30 days.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run-full-sweep CTA */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <Activity className={`h-4 w-4 accent-text ${sweeping ? "animate-pulse" : ""}`} />
          <div className="min-w-0">
            <div className="text-xs font-medium">Run Full Sweep</div>
            <div className="text-[11px] text-muted-foreground">
              Dispatch all 5 specialist agents through Codex Prime · streams events live to the
              console.
            </div>
          </div>
        </div>
        <button
          onClick={onRunSweep}
          disabled={sweeping}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5"
        >
          <Rocket className="h-3.5 w-3.5" />
          {sweeping ? "Sweeping…" : "Run all agents"}
        </button>
      </div>

      {/* Solvency chart */}
      {data ? (
        <SolvencyChart
          standby={data.standby}
          autopilot={data.autopilot}
          safetyFloor={data.safetyFloor}
          mode={mode}
          onModeChange={setMode}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-surface/40 p-12 text-center text-muted-foreground text-sm">
          Loading projections…
        </div>
      )}
    </div>
  );
}
