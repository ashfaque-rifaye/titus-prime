import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Telescope,
  Mail,
  ClipboardList,
  Landmark,
  BarChart3,
  Code2,
  ArrowRight,
  TrendingDown,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Plug,
  GitBranch,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Titus-Prime · The Autonomous CFO" },
      {
        name: "description",
        content:
          "Titus-Prime is an autonomous financial operations agent. It connects your stack, predicts cash crunches, and coordinates six specialist agents to keep you solvent.",
      },
    ],
  }),
  component: Landing,
});

const AGENTS = [
  { name: "Treasury Sentinel", tone: "Predicts cash crunches 2–4 weeks out.", Icon: Telescope },
  { name: "Collection Agent", tone: "Chases overdue invoices, tone-aware.", Icon: Mail },
  {
    name: "Subscription Watchdog",
    tone: "Kills silent renewals & price creep.",
    Icon: ClipboardList,
  },
  { name: "Tax Compliance", tone: "Tracks nexus across US states & GST.", Icon: Landmark },
  { name: "Scenario Modeler", tone: "Ranks survival plans under pressure.", Icon: BarChart3 },
  { name: "Codex Prime", tone: "Writes custom Python for every problem.", Icon: Code2 },
];

const PAINS = [
  {
    Icon: Clock,
    stat: "12 hrs",
    label: "lost monthly to manual finance ops",
    tone: "amber" as const,
  },
  {
    Icon: TrendingDown,
    stat: "1 in 3",
    label: "SaaS startups die from cash mismanagement",
    tone: "rose" as const,
  },
  {
    Icon: AlertTriangle,
    stat: "$50k+",
    label: "leaked yearly to silent renewals & late fees",
    tone: "rose" as const,
  },
];

const VALUE = [
  {
    stat: "+$54,965",
    label: "cash recovered per crunch, autopilot vs. standby",
    tone: "primary" as const,
  },
  {
    stat: "18 days",
    label: "median early warning before a shortfall hits",
    tone: "primary" as const,
  },
  { stat: "4 min", label: "to review a full sweep — down from 12 hours", tone: "primary" as const },
];

const STEPS = [
  {
    Icon: Plug,
    title: "Connect",
    body: "Stripe, Salesforce, Gmail, Plaid, QuickBooks, Razorpay & more — synced into one canonical ledger.",
  },
  {
    Icon: Sparkles,
    title: "Detect",
    body: "Treasury Sentinel projects 30 days of cash and flags the breach before it happens.",
  },
  {
    Icon: GitBranch,
    title: "Coordinate",
    body: "A crunch escalates across agents — collections, subscriptions, and scenarios react in lockstep.",
  },
  {
    Icon: ShieldCheck,
    title: "Approve",
    body: "Inside your policy envelope it acts autonomously; outside it, you get one clean approval queue.",
  },
];

const toneText: Record<"primary" | "amber" | "rose", string> = {
  primary: "accent-text",
  amber: "text-amber-300",
  rose: "text-rose-300",
};

function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-[300px] w-[400px] rounded-full bg-indigo-500/10 blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-[1100px] px-6 pt-20 pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
            Autonomous financial operations · Built for US & India SaaS
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Your finance team is a<br />
            <span className="accent-text">codebase that writes itself.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Titus-Prime is an autonomous CFO. It connects your financial stack, predicts cash
            crunches weeks ahead, and coordinates six specialist agents to keep you solvent —
            writing custom Python for every problem.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              Open the Boardroom <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/skills"
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface/60 px-6 py-3 text-sm font-semibold hover:border-primary/40 transition"
            >
              See the code it writes
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Problem band */}
      <section className="mx-auto max-w-[1100px] px-6 pb-16">
        <div className="text-center mb-6">
          <span className="text-[11px] mono uppercase tracking-[0.2em] text-muted-foreground">
            The problem
          </span>
          <h2 className="mt-2 text-2xl font-semibold">
            Finance ops is reactive, manual, and expensive.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PAINS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-xl border border-border bg-surface/60 p-5"
            >
              <p.Icon className={`h-5 w-5 ${toneText[p.tone]}`} />
              <div className={`mt-3 text-3xl font-bold ${toneText[p.tone]}`}>{p.stat}</div>
              <p className="mt-1 text-sm text-muted-foreground">{p.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Value callouts */}
      <section className="mx-auto max-w-[1100px] px-6 pb-16">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className="text-[11px] mono uppercase tracking-[0.2em] text-primary">
              The outcome
            </span>
            <h2 className="mt-2 text-2xl font-semibold">What autonomy is worth.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUE.map((v, i) => (
              <motion.div
                key={v.label}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="text-center"
              >
                <div className={`text-4xl font-bold ${toneText[v.tone]}`}>{v.stat}</div>
                <p className="mt-2 text-sm text-muted-foreground">{v.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1100px] px-6 pb-16">
        <div className="text-center mb-6">
          <span className="text-[11px] mono uppercase tracking-[0.2em] text-muted-foreground">
            How it works
          </span>
          <h2 className="mt-2 text-2xl font-semibold">Connect once. It runs the rest.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="relative rounded-xl border border-border bg-surface/60 p-5"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/30 bg-primary/10">
                  <s.Icon className="h-4 w-4 accent-text" />
                </span>
                <span className="text-[10px] mono text-muted-foreground">STEP {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agent grid */}
      <section className="mx-auto max-w-[1100px] px-6 pb-24">
        <div className="text-center mb-6">
          <span className="text-[11px] mono uppercase tracking-[0.2em] text-muted-foreground">
            The team
          </span>
          <h2 className="mt-2 text-2xl font-semibold">Six specialists. One shared brain.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-xl border border-border bg-surface/60 p-5 hover:border-primary/40 transition"
            >
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-background/60 group-hover:border-primary/40 transition">
                <a.Icon className="h-5 w-5 accent-text" />
              </span>
              <h3 className="mt-3 font-semibold text-lg">{a.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.tone}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            See it run live <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
