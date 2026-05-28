import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, X } from "lucide-react";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { TreasurySection } from "@/components/TreasurySection";
import { AskMode } from "@/components/AskMode";
import { AgentArtifact } from "@/components/AgentArtifact";
import { AgentConsole } from "@/components/AgentConsole";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { SkillLibrarySidebar } from "@/components/SkillLibrarySidebar";
import { CsvUpload } from "@/components/CsvUpload";
import { LiveWorkshop } from "@/components/LiveWorkshop";
import { SKILL_TEMPLATES } from "@/lib/skill-templates";
import { formatMoney, formatCompact } from "@/lib/currency";
import { toast } from "sonner";

type SnapshotPayload = {
  inflows: any[];
  outflows: any[];
  subscriptions: any[];
  banks: any[];
  totals: { cashUsd: number; arUsd: number; apUsd: number; monthlySubsUsd: number };
};

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Boardroom · Titus-Prime" },
      { name: "description", content: "Autonomous CFO cockpit — connectors, treasury solvency, ask mode, and agent artifacts." },
    ],
  }),
  component: Boardroom,
});

function Boardroom() {
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [liveSkill, setLiveSkill] = useState<{ skillKey: string; code: string } | null>(null);
  const consoleRef = useRef<{ start: () => void } | null>(null);

  // Hydrate snapshot once on mount (ConnectionsPanel will trigger sync separately).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/snapshot");
        if (!r.ok || cancelled) return;
        const j: SnapshotPayload = await r.json();
        if (!cancelled) setSnapshot(j);
      } catch {
        /* noop */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const onConnectorsSynced = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onCodexToken = useCallback((skillKey: string, delta: string) => {
    setLiveSkill((cur) =>
      !cur || cur.skillKey !== skillKey ? { skillKey, code: delta } : { skillKey, code: cur.code + delta },
    );
  }, []);

  async function customizeAgent(agent: string, instruction: string) {
    const r = await fetch("/api/agents/customize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, instruction }),
    });
    if (r.ok) toast.success(`${agent} agent customized`);
    else toast.error(`Customization failed (${r.status})`);
  }

  // Trigger orchestrator run via the AgentConsole component's exposed method.
  const triggerSweep = useCallback(() => {
    consoleRef.current?.start();
  }, []);

  const cashFmt = snapshot ? formatCompact(snapshot.totals.cashUsd, "USD") : "—";
  const arFmt = snapshot ? formatCompact(snapshot.totals.arUsd, "USD") : "—";
  const apFmt = snapshot ? formatCompact(snapshot.totals.apUsd, "USD") : "—";
  const subsFmt = snapshot ? formatCompact(snapshot.totals.monthlySubsUsd, "USD") : "—";

  return (
    <div className="mx-auto max-w-[1700px] px-4 sm:px-6 py-5 space-y-4">
      {/* Header strip with KPIs */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The Boardroom</h1>
          <p className="text-sm text-muted-foreground">
            Live cockpit · {snapshot?.banks.length ?? 0} bank{snapshot?.banks.length === 1 ? "" : "s"} · {snapshot?.inflows.length ?? 0} open AR · {snapshot?.outflows.length ?? 0} AP · {snapshot?.subscriptions.length ?? 0} subscriptions
        </p>
        </div>
        <div className="flex items-center gap-2">
          <Kpi label="Cash" value={cashFmt} tone="primary" />
          <Kpi label="AR" value={arFmt} tone="amber" />
          <Kpi label="AP" value={apFmt} tone="rose" />
          <Kpi label="Subs/mo" value={subsFmt} tone="indigo" />
          <button
            onClick={() => setCsvOpen(true)}
            className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/40 transition inline-flex items-center gap-1.5"
            title="Import a one-off CSV (rare path)"
          >
            <Upload className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Connections — top of fold, auto-syncs on mount */}
      <ConnectionsPanel onSynced={onConnectorsSynced} />

      <div className="grid gap-4 lg:grid-cols-[1fr_520px]">
        {/* LEFT — primary cockpit */}
        <div className="space-y-4">
          <TreasurySection onRunSweep={triggerSweep} sweeping={sweeping} refreshKey={refreshKey} />

          <AskMode />

          {/* Agent artifacts grid */}
          <div className="grid gap-3 md:grid-cols-2">
            <AgentArtifact
              kind="collection"
              title="📨 Collection · top draft"
              skill={SKILL_TEMPLATES.draft_email}
              data={{
                tone: "firm",
                invoice:
                  snapshot && snapshot.inflows.length > 0
                    ? {
                        id: snapshot.inflows[0].id,
                        customer: snapshot.inflows[0].customer,
                        amount: Math.round(snapshot.inflows[0].amountUsd),
                        daysLate: snapshot.inflows[0].daysLate,
                      }
                    : undefined,
              }}
              onCustomize={(i) => customizeAgent("collection", i)}
            />
            <AgentArtifact
              kind="subscription"
              title="📋 Subscription · upcoming actions"
              skill={SKILL_TEMPLATES.renewal_scan}
              data={{
                subscriptions: (snapshot?.subscriptions ?? []).slice(0, 3).map((s: any) => ({
                  id: s.id,
                  vendor: s.vendor,
                  monthlyCost: Math.round(s.monthlyCostUsd),
                  renewsIn: s.renewsIn,
                  cancelWindowClosesIn: s.cancelWindowClosesIn,
                })),
              }}
              onCustomize={(i) => customizeAgent("subscription", i)}
            />
            <AgentArtifact
              kind="tax"
              title="🏛 Tax · multi-state nexus"
              skill={SKILL_TEMPLATES.tx_saas_calc}
              data={{
                states: [
                  { state: "CA", revenueYTD: 84_300, threshold: 500_000, nexusCrossed: false, taxOwed: 0 },
                  { state: "TX", revenueYTD: 100_200, threshold: 100_000, nexusCrossed: true, taxOwed: 1420.5 },
                  { state: "NY", revenueYTD: 62_800, threshold: 500_000, nexusCrossed: false, taxOwed: 0 },
                  { state: "FL", revenueYTD: 47_900, threshold: 100_000, nexusCrossed: false, taxOwed: 0 },
                ],
                preFilled: {
                  state: "Texas",
                  period: "Q4 2026",
                  base: 100_200 * 0.8,
                  rate: 0.0625 + 0.0194,
                  owed: 1420.5,
                  citation: "TX Tax Code 151.0101 · SaaS taxable as data-processing service · 20% exemption",
                },
              }}
              onCustomize={(i) => customizeAgent("tax", i)}
            />
            <AgentArtifact
              kind="scenario"
              title="📊 Scenario · ranked plans"
              skill={SKILL_TEMPLATES.optimize_survival}
              data={{
                plans: [
                  { name: "Plan A · Aggressive collect + pause", successPct: 92, bufferGain: 19_078, rationale: "Maximizes recoverable cash under high success probability." },
                  { name: "Plan B · Vendor delay", successPct: 85, bufferGain: 14_210, rationale: "Buys time without irritating customers." },
                  { name: "Plan C · Bridge line", successPct: 78, bufferGain: 16_970, rationale: "Smallest behavioral change but draws on credit." },
                ],
              }}
              onCustomize={(i) => customizeAgent("scenario", i)}
            />
          </div>

          {/* Treasury knobs (artifact for treasury) */}
          <AgentArtifact
            kind="treasury"
            title="🔭 Treasury · assumption knobs"
            skill={SKILL_TEMPLATES.cash_forecast}
            data={{ assumptions: { floor: 5000, payrollDay: 15, payrollAmount: 22_000, recoveryPct: 50 } }}
            onCustomize={(i) => customizeAgent("treasury", i)}
          />

          {/* Live agent transcript */}
          <AgentConsoleHandle
            ref={consoleRef as any}
            onCodexToken={onCodexToken}
            onSweepingChange={setSweeping}
          />

          {/* Approvals */}
          <ApprovalQueue />
        </div>

        {/* RIGHT — workshop + library */}
        <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-xl border border-border bg-surface/60 overflow-hidden h-[460px]">
            {liveSkill ? (
              <LiveWorkshop skillKey={liveSkill.skillKey} code={liveSkill.code} />
            ) : (
              <IdleWorkshop />
            )}
          </div>
          <SkillLibrarySidebar />
        </div>
      </div>

      {/* CSV Drawer (one-off imports) */}
      <AnimatePresence>
        {csvOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur grid place-items-center p-4"
            onClick={() => setCsvOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs mono text-muted-foreground">One-off CSV import (fallback)</div>
                <button
                  onClick={() => setCsvOpen(false)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:text-foreground text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <CsvUpload />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "primary" | "rose" | "indigo" | "amber" }) {
  const color =
    tone === "primary" ? "text-primary" :
    tone === "rose" ? "text-rose-300" :
    tone === "amber" ? "text-amber-300" :
    "text-indigo-300";
  return (
    <div className="rounded-md border border-border bg-surface/60 px-3 py-1.5">
      <div className="text-[9px] mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mono ${color}`}>{value}</div>
    </div>
  );
}

function IdleWorkshop() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-2xl">💻</div>
      <h3 className="text-base font-semibold">Workshop is idle</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Click <span className="accent-text">Run all agents</span> in the Treasury panel.
        Codex Prime will compose Python skills for each specialist — token by token.
      </p>
    </div>
  );
}

/* ─────────────────  Console wrapper exposing imperative start  ───────────────── */
import { forwardRef, useImperativeHandle } from "react";

const AgentConsoleHandle = forwardRef<
  { start: () => void },
  { onCodexToken: (skillKey: string, delta: string) => void; onSweepingChange: (v: boolean) => void }
>(function AgentConsoleHandle({ onCodexToken, onSweepingChange }, ref) {
  const innerStart = useRef<(() => void) | null>(null);
  useImperativeHandle(ref, () => ({
    start: () => innerStart.current?.(),
  }));
  return (
    <AgentConsole
      mode="stream"
      onCodexToken={onCodexToken}
      onRunStarted={() => onSweepingChange(true)}
      onRunCompleted={() => onSweepingChange(false)}
      registerStarter={(fn) => (innerStart.current = fn)}
    />
  );
});
