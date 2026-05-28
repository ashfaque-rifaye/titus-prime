import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { COMPANY, AGENTS } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Titus-Prime · Your autonomous CFO" },
      { name: "description", content: "Titus-Prime is an autonomous, multi-agent CFO that writes its own Python skills to run treasury, AR, subscriptions, tax and scenario planning." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 terminal-grid opacity-[0.08]" />
        <div className="absolute inset-0 ambient-glow opacity-70" />
        <div className="relative mx-auto max-w-[1400px] px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs mono text-muted-foreground backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
            Autonomous Financial Operations · multi-agent · code-writing
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]"
          >
            Meet <span className="accent-text">Titus-Prime</span>.<br />
            Your autonomous CFO that writes its own code.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground"
          >
            Five specialist agents — Treasury, Collection, Subscription, Tax, Scenario — collaborate with
            <span className="accent-text"> Codex Prime</span>, a shared coding agent that inspects your data, writes
            Python, runs it in a sandbox, and commits the skill to a versioned library. Every number on screen carries
            a <span className="mono accent-text">provenance:</span> trail back to the file that produced it.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/app" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition">
              Enter the Boardroom →
            </Link>
            <Link to="/architecture" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm hover:border-primary/40 transition">
              See the architecture
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-14 grid gap-4 sm:grid-cols-3"
          >
            <Stat label="Scenario" value={COMPANY.name} sub="SaaS · $85K MRR · 200 customers" />
            <Stat label="Crunch in" value="13 days" sub="payroll lands · cash dips below floor" tone="alert" />
            <Stat label="Specialist agents" value="5 + Codex" sub="LangGraph orchestrated" />
          </motion.div>
        </div>
      </section>
      <section className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-[1400px] px-6 py-16">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">A boardroom of agents.</h2>
              <p className="mt-2 text-muted-foreground max-w-xl text-sm sm:text-base">
                Each agent owns a domain. None of them write code — they ask Codex Prime to. The result is a versioned
                library of Python skills that grows with your business.
              </p>
            </div>
            <Link to="/skills" className="text-sm accent-text hover:underline">workspace/skills/ →</Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-surface/60 p-5 hover:border-primary/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-background/60 text-xl">{a.icon}</span>
                  <div>
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-[11px] mono text-muted-foreground">{a.folder}/</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{a.tone}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1400px] px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Walk into the room.</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Watch a cash crunch get detected, debated, and de-risked in real time. Click any number to see the Python
          that produced it stream in token by token.
        </p>
        <Link to="/app" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition">
          Open the Boardroom →
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "alert" }) {
  return (
    <div className={`rounded-xl border ${tone === "alert" ? "border-rose-400/40" : "border-border"} bg-surface/60 p-5 backdrop-blur`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mono">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "alert" ? "text-rose-300" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
