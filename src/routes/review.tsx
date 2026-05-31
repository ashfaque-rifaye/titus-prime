/**
 * Review — deep-dive page for non-urgent items.
 *
 * Contains Tax Nexus, Scenario Modeler, Treasury Knobs,
 * Agent Activity Log, and the Skill Library — all moved
 * out of the Boardroom to keep it action-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Trophy,
  Sliders,
  Activity,
  Code2,
  ChevronDown,
  Coins,
  Landmark,
  Send,
  Calendar,
} from "lucide-react";
import { SkillLibrarySidebar } from "@/components/SkillLibrarySidebar";
import { ApprovalQueue } from "@/components/ApprovalQueue";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review · Titus-Prime" },
      {
        name: "description",
        content:
          "Deep-dive into tax nexus, scenario plans, treasury assumptions, and agent activity history.",
      },
    ],
  }),
  component: ReviewPage,
});

/* ─────────────────  collapsible section wrapper  ───────────────── */

function Section({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-background/40 transition"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 accent-text" />
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="text-[10px] mono rounded-full bg-primary/15 accent-text px-2 py-0.5">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────  page  ───────────────── */

function ReviewPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review & Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Non-urgent analysis, historical agent activity, and configuration. Items here don't need
          immediate action.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Tax Nexus */}
          <Section
            icon={FileText}
            title="Tax · Multi-State Nexus"
            badge="1 nexus crossed"
            defaultOpen
          >
            <TaxReview />
          </Section>

          {/* Scenario Modeler */}
          <Section icon={Trophy} title="Scenario · Ranked Survival Plans" badge="3 plans">
            <ScenarioReview />
          </Section>

          {/* Treasury Knobs */}
          <Section icon={Sliders} title="Treasury · Assumption Knobs">
            <TreasuryReview />
          </Section>

          {/* Agent Activity Log */}
          <Section icon={Activity} title="Agent Activity Log" badge="5 recent" defaultOpen>
            <ActivityLogReview />
          </Section>
        </div>

        {/* Right column — Skill Library + Approval Queue */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <ApprovalQueue />
          <SkillLibrarySidebar />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  Tax Review  ───────────────── */

function TaxReview() {
  const states = [
    { state: "CA", revenueYTD: 84_300, threshold: 500_000, nexusCrossed: false, taxOwed: 0 },
    { state: "TX", revenueYTD: 100_200, threshold: 100_000, nexusCrossed: true, taxOwed: 1420.5 },
    { state: "NY", revenueYTD: 62_800, threshold: 500_000, nexusCrossed: false, taxOwed: 0 },
    { state: "FL", revenueYTD: 47_900, threshold: 100_000, nexusCrossed: false, taxOwed: 0 },
  ];
  const preFilled = {
    state: "Texas",
    period: "Q4 2026",
    base: 100_200 * 0.8,
    rate: 0.0625 + 0.0194,
    owed: 1420.5,
    citation: "TX Tax Code 151.0101 · SaaS taxable as data-processing service · 20% exemption",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {states.map((s) => (
          <div
            key={s.state}
            className={`rounded-lg border p-2.5 ${s.nexusCrossed ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background/40"}`}
          >
            <div className="text-[10px] mono uppercase text-muted-foreground">{s.state}</div>
            <div className="text-xs font-semibold mt-0.5">${s.revenueYTD.toLocaleString()}</div>
            <div
              className={`text-[10px] mono mt-0.5 ${s.nexusCrossed ? "text-rose-300" : "text-muted-foreground"}`}
            >
              {s.nexusCrossed
                ? `Owes $${s.taxOwed.toFixed(2)}`
                : `${Math.round((s.revenueYTD / (s.threshold || 1)) * 100)}% of threshold`}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
        <div className="text-[10px] mono uppercase tracking-wider text-rose-300 mb-1">
          Pre-filled return preview
        </div>
        <div className="text-xs">
          {preFilled.state} · {preFilled.period} · taxable base ${preFilled.base.toLocaleString()} ×{" "}
          {(preFilled.rate * 100).toFixed(2)}% = ${preFilled.owed.toFixed(2)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">{preFilled.citation}</div>
      </div>
    </div>
  );
}

/* ─────────────────  Scenario Review  ───────────────── */

function ScenarioReview() {
  const plans = [
    {
      name: "Plan A · Aggressive collect + pause",
      successPct: 92,
      bufferGain: 19_078,
      rationale: "Maximizes recoverable cash under high success probability.",
    },
    {
      name: "Plan B · Vendor delay",
      successPct: 85,
      bufferGain: 14_210,
      rationale: "Buys time without irritating customers.",
    },
    {
      name: "Plan C · Bridge line",
      successPct: 78,
      bufferGain: 16_970,
      rationale: "Smallest behavioral change but draws on credit.",
    },
  ];

  return (
    <div className="space-y-2">
      {plans.map((p, i) => (
        <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">{p.name}</div>
            <span className="text-[10px] mono accent-text">{p.successPct}%</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{p.rationale}</div>
          <div className="mt-2 flex items-center gap-2 text-[10px] mono">
            <span className="text-muted-foreground">Buffer gain</span>
            <span className="text-emerald-300">+${p.bufferGain?.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────  Treasury Review  ───────────────── */

function TreasuryReview() {
  const knobs = [
    { label: "Safety floor", value: "$5,000" },
    { label: "Payroll day", value: "Day 15" },
    { label: "Payroll amount", value: "$22,000" },
    { label: "AR recovery rate", value: "50%" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {knobs.map((k) => (
        <div key={k.label} className="rounded-md border border-border bg-background/60 px-3 py-2">
          <div className="text-[10px] mono uppercase text-muted-foreground">{k.label}</div>
          <div className="text-sm font-semibold mono mt-0.5">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────  Activity Log Review  ───────────────── */

function ActivityLogReview() {
  const runs = [
    {
      id: 1,
      agent: "Treasury",
      action: "Cash Sweep",
      time: "12 mins ago",
      detail: "Picked up 3 anomalies, Modified 1 AR record",
      icon: <Coins className="h-3.5 w-3.5" />,
      color: "text-primary",
    },
    {
      id: 2,
      agent: "Tax",
      action: "Nexus Scan",
      time: "1 hour ago",
      detail: "Found 1 new state (Texas), Generated pre-filled preview",
      icon: <Landmark className="h-3.5 w-3.5" />,
      color: "text-amber-400",
    },
    {
      id: 3,
      agent: "Subscription",
      action: "Renewal Check",
      time: "3 hours ago",
      detail: "Flagged 2 upcoming renewals. Cancel window closing soon.",
      icon: <Calendar className="h-3.5 w-3.5" />,
      color: "text-emerald-400",
    },
    {
      id: 4,
      agent: "Collection",
      action: "Draft Reminder",
      time: "5 hours ago",
      detail: "Drafted 1 firm email for Invoice INV-1042",
      icon: <Send className="h-3.5 w-3.5" />,
      color: "text-rose-400",
    },
    {
      id: 5,
      agent: "Scenario",
      action: "Optimize Survival",
      time: "1 day ago",
      detail: "Ranked 3 plans based on new AR delay",
      icon: <Trophy className="h-3.5 w-3.5" />,
      color: "text-indigo-400",
    },
  ];

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div key={run.id} className="flex gap-3">
          <div
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface border border-border text-xs ${run.color}`}
          >
            {run.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{run.agent} Agent</span>
              <span className="text-[10px] text-muted-foreground mono">• {run.time}</span>
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-foreground">{run.action}</div>
            <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              {run.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
