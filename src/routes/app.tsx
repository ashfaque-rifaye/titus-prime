import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, X } from "lucide-react";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { TreasurySection } from "@/components/TreasurySection";
import { AskMode } from "@/components/AskMode";
import { AgentArtifact } from "@/components/AgentArtifact";
import { AgentConsole } from "@/components/AgentConsole";
import { CloudFinOpsPanel } from "@/components/CloudFinOpsPanel";
import { CsvUpload } from "@/components/CsvUpload";
import { LiveWorkshop } from "@/components/LiveWorkshop";
import { ValueScoreboard } from "@/components/ValueScoreboard";
import { AnomalyFeed } from "@/components/AnomalyFeed";
import { WhatIfPanel } from "@/components/WhatIfPanel";
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
      {
        name: "description",
        content:
          "Autonomous CFO cockpit — action-only view with connectors, treasury solvency, and agent artifacts.",
      },
    ],
  }),
  component: Boardroom,
});

function Boardroom() {
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [valueRefresh, setValueRefresh] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [liveSkill, setLiveSkill] = useState<{ skillKey: string; code: string } | null>(null);
  const consoleRef = useRef<{ start: () => void } | null>(null);

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
    setValueRefresh((k) => k + 1);
  }, []);

  // After an agent sweep completes, the ledger has new value events — refresh.
  const onSweepDone = useCallback(() => {
    setSweeping(false);
    setValueRefresh((k) => k + 1);
  }, []);

  const onCodexToken = useCallback((skillKey: string, delta: string) => {
    setLiveSkill((cur) =>
      !cur || cur.skillKey !== skillKey
        ? { skillKey, code: delta }
        : { skillKey, code: cur.code + delta },
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
            Action-only cockpit · {snapshot?.banks.length ?? 0} bank
            {snapshot?.banks.length === 1 ? "" : "s"} · {snapshot?.inflows.length ?? 0} open AR ·{" "}
            {snapshot?.outflows.length ?? 0} AP · {snapshot?.subscriptions.length ?? 0}{" "}
            subscriptions
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

      {/* Value Scoreboard — the "Money Found" receipt. The answer to "what did this get me?" */}
      <ValueScoreboard refreshKey={valueRefresh} />

      {/* Connections — top of fold, auto-syncs on mount */}
      <ConnectionsPanel onSynced={onConnectorsSynced} />

      {/* Cloud cost summary */}
      <CloudFinOpsPanel />

      <div className="grid gap-4 lg:grid-cols-[1fr_520px]">
        {/* LEFT — action-only cockpit */}
        <div className="space-y-4">
          <TreasurySection onRunSweep={triggerSweep} sweeping={sweeping} refreshKey={refreshKey} />

          <div className="grid gap-3 md:grid-cols-2">
            <AskMode />
            <WhatIfPanel />
          </div>

          {/* Actionable agent artifacts — only Collection + Subscription */}
          <div className="grid gap-3 md:grid-cols-2">
            <AgentArtifact
              kind="collection"
              title="Collection · email draft"
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
              title="Subscription · actions needed"
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
          </div>

          {/* Live agent transcript */}
          <AgentConsoleHandle
            ref={consoleRef as any}
            onCodexToken={onCodexToken}
            onSweepingChange={setSweeping}
            onRunCompleted={onSweepDone}
          />
        </div>

        {/* RIGHT — live workshop + sentinel */}
        <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-xl border border-border bg-surface/60 overflow-hidden h-[460px]">
            {liveSkill ? (
              <LiveWorkshop skillKey={liveSkill.skillKey} code={liveSkill.code} />
            ) : (
              <PendingActionsPanel />
            )}
          </div>
          {/* Sentinel — proactive anomaly feed */}
          <AnomalyFeed refreshKey={valueRefresh} />
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
                <div className="text-xs mono text-muted-foreground">
                  One-off CSV import (fallback)
                </div>
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "rose" | "indigo" | "amber";
}) {
  const color =
    tone === "primary"
      ? "text-primary"
      : tone === "rose"
        ? "text-rose-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-indigo-300";
  return (
    <div className="rounded-md border border-border bg-surface/60 px-3 py-1.5">
      <div className="text-[9px] mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mono ${color}`}>{value}</div>
    </div>
  );
}

/* ─────────────────  Pending Actions Panel (replaces Activity Log)  ───────────────── */

import { AlertTriangle, CheckCircle2, Clock, Calendar, Mail, ArrowRight } from "lucide-react";

function PendingActionsPanel() {
  const actions = [
    {
      id: 1,
      urgency: "high" as const,
      title: "Slack Enterprise cancel window closes",
      detail: "2 days remaining · Annual auto-renew · $1,200/mo",
      agent: "Subscription",
      icon: <Calendar className="h-3.5 w-3.5" />,
    },
    {
      id: 2,
      urgency: "high" as const,
      title: "INV-1042 overdue email pending approval",
      detail: "Acme Robotics · $8,200 · 14 days late · Draft ready",
      agent: "Collection",
      icon: <Mail className="h-3.5 w-3.5" />,
    },
    {
      id: 3,
      urgency: "medium" as const,
      title: "Notion cancel window in 5 days",
      detail: "Annual auto-renew · $240/mo · No penalty",
      agent: "Subscription",
      icon: <Calendar className="h-3.5 w-3.5" />,
    },
    {
      id: 4,
      urgency: "low" as const,
      title: "INV-1029 friendly nudge queued",
      detail: "Nimbus Health · $1,450 · 28 days late",
      agent: "Collection",
      icon: <Mail className="h-3.5 w-3.5" />,
    },
  ];

  const urgencyStyle = {
    high: "border-rose-500/30 bg-rose-500/5 text-rose-300",
    medium: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    low: "border-border bg-background/40 text-muted-foreground",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background/40 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mono flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 pulse-dot" />
          Pending Actions
          <span className="rounded-full bg-rose-500/15 text-rose-300 px-2 py-0.5 text-[10px]">
            {actions.filter((a) => a.urgency === "high").length} urgent
          </span>
        </h3>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-2.5 scrollbar-thin">
        {actions.map((action) => (
          <div key={action.id} className={`rounded-lg border p-3 ${urgencyStyle[action.urgency]}`}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{action.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{action.title}</span>
                  {action.urgency === "high" && (
                    <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{action.detail}</div>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] mono text-muted-foreground">
                  <span>{action.agent} Agent</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                  <span className="text-foreground/70">Action required</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────  Console wrapper exposing imperative start  ───────────────── */
import { forwardRef, useImperativeHandle } from "react";

const AgentConsoleHandle = forwardRef<
  { start: () => void },
  {
    onCodexToken: (skillKey: string, delta: string) => void;
    onSweepingChange: (v: boolean) => void;
    onRunCompleted?: () => void;
  }
>(function AgentConsoleHandle({ onCodexToken, onSweepingChange, onRunCompleted }, ref) {
  const innerStart = useRef<(() => void) | null>(null);
  useImperativeHandle(ref, () => ({
    start: () => innerStart.current?.(),
  }));
  return (
    <AgentConsole
      mode="stream"
      onCodexToken={onCodexToken}
      onRunStarted={() => onSweepingChange(true)}
      onRunCompleted={() => {
        onSweepingChange(false);
        onRunCompleted?.();
      }}
      registerStarter={(fn) => (innerStart.current = fn)}
    />
  );
});
