/**
 * AgentConsole
 *
 * Subscribes to a /api/agents/run SSE stream and renders the live transcript
 * of agent thoughts, messages, findings, policy decisions, and approvals.
 * Each event animates in. The console doubles as a button: click "Run agents"
 * to kick off a new orchestrator pass.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { AgentEvent } from "@/lib/agents/types";
import { Badge } from "@/components/ui/badge";

const AGENT_LABEL: Record<string, string> = {
  orchestrator: "Orchestrator",
  treasury: "Treasury Sentinel",
  collection: "Collection",
  subscription: "Subscription Watchdog",
  tax: "Tax Compliance",
  scenario: "Scenario Modeler",
  codex: "Codex Prime",
};
const AGENT_ICON: Record<string, string> = {
  orchestrator: "🧠",
  treasury: "🔭",
  collection: "📨",
  subscription: "📋",
  tax: "🏛️",
  scenario: "📊",
  codex: "💻",
};

type Props = {
  mode: "stream" | "template";
  onCodexToken?: (skillKey: string, delta: string) => void;
  onRunStarted?: (runId: string) => void;
  onRunCompleted?: () => void;
  /**
   * Optional. The console will call this once on mount with its `start` fn,
   * letting parents trigger a run imperatively (e.g. from a Treasury CTA).
   */
  registerStarter?: (start: () => void) => void;
};

export function AgentConsole({ mode, onCodexToken, onRunStarted, onRunCompleted, registerStarter }: Props) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 5 });
  const aborter = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    if (running) return;
    setEvents([]);
    setProgress({ done: 0, total: 5 });
    setRunning(true);
    const ac = new AbortController();
    aborter.current = ac;
    try {
      const resp = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          if (!frame.startsWith("data: ")) continue;
          const data = frame.slice(6);
          if (data === "[DONE]") continue;
          try {
            const evt: AgentEvent = JSON.parse(data);
            handleEvent(evt);
          } catch {
            /* ignore partial frame */
          }
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        // eslint-disable-next-line no-console
        console.error("[AgentConsole] stream error", e);
      }
    } finally {
      setRunning(false);
      aborter.current = null;
    }
  }, [mode, running]);

  // Allow parents (e.g. the Treasury "Run all agents" CTA) to trigger a run.
  useEffect(() => {
    registerStarter?.(start);
  }, [registerStarter, start]);

  function handleEvent(evt: AgentEvent) {
    if (evt.kind === "codex.token") {
      onCodexToken?.(evt.skillKey, evt.delta);
      // Don't add token frames to the transcript — too noisy.
      return;
    }
    setEvents((prev) => [...prev, evt]);
    if (evt.kind === "run.started") onRunStarted?.(evt.runId);
    if (evt.kind === "codex.skill_committed") {
      setProgress((p) => ({ ...p, done: Math.min(p.done + 1, p.total) }));
    }
    if (evt.kind === "run.completed" || evt.kind === "run.failed") {
      onRunCompleted?.();
      setProgress((p) => ({ ...p, done: p.total }));
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-amber-400 pulse-dot" : "bg-muted-foreground"}`} />
          <h3 className="text-sm font-semibold">Agent Console</h3>
          {events.length > 0 && (
            <span className="text-[11px] text-muted-foreground mono">{events.length} events</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <div className="h-1 w-32 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.done / progress.total) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}
          <button
            onClick={running ? () => aborter.current?.abort() : start}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              running ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {running ? "Stop" : "Run agents →"}
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[360px] overflow-auto scrollbar-thin p-3 space-y-1.5">
        {events.length === 0 && !running && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Click <span className="accent-text">Run agents</span> to start an orchestrated sweep. Treasury runs first.
            If a crunch is detected, Collection / Subscription / Scenario coordinate in real time.
          </p>
        )}
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <EventRow key={i} e={e} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EventRow({ e }: { e: AgentEvent }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="text-[12px] flex items-start gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5"
    >
      <span className="mono text-[10px] text-muted-foreground tabular-nums w-[60px] shrink-0">
        {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
      </span>
      <Body e={e} />
    </motion.div>
  );
}

function Body({ e }: { e: AgentEvent }) {
  if (e.kind === "run.started") {
    return (
      <span className="text-foreground">
        <Badge variant="outline" className="mr-2">RUN</Badge>
        {e.intent} · <span className="mono accent-text">{e.runId}</span>
      </span>
    );
  }
  if (e.kind === "run.completed") {
    return (
      <span>
        <Badge className="mr-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">DONE</Badge>
        {e.summary}
      </span>
    );
  }
  if (e.kind === "run.failed") {
    return (
      <span>
        <Badge className="mr-2 bg-rose-500/20 text-rose-300 border-rose-500/30">FAIL</Badge>
        {e.error}
      </span>
    );
  }
  if (e.kind === "agent.thought") {
    return (
      <span className="text-muted-foreground">
        <span className="mr-1.5">{AGENT_ICON[e.agent]}</span>
        <span className="text-foreground/90">{AGENT_LABEL[e.agent]}</span>
        <span className="mx-1.5">·</span>
        {e.text}
      </span>
    );
  }
  if (e.kind === "agent.message") {
    return (
      <span className="text-amber-300">
        <span className="mr-1.5">📡</span>
        <span className="mono">{e.from} → {e.to}</span>
        <span className="mx-1.5">·</span>
        <span className="text-foreground">{e.subject}</span>
      </span>
    );
  }
  if (e.kind === "agent.finding") {
    const color =
      e.severity === "alert" ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
      : e.severity === "warn" ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : e.severity === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-sky-500/20 text-sky-300 border-sky-500/30";
    return (
      <span>
        <Badge className={`mr-2 ${color}`}>{e.severity.toUpperCase()}</Badge>
        <span className="mr-1.5">{AGENT_ICON[e.agent]}</span>
        <span className="text-foreground/90">{e.title}</span>
        <div className="text-muted-foreground text-[11px] mt-0.5 ml-6">{e.detail}</div>
      </span>
    );
  }
  if (e.kind === "codex.skill_request") {
    return (
      <span className="text-muted-foreground">
        <span className="mr-1.5">💻</span>
        <span className="mono accent-text">codex.{e.skillKey}</span>
        <span className="mx-1.5">·</span>
        requested by {AGENT_LABEL[e.from]}
      </span>
    );
  }
  if (e.kind === "codex.skill_committed") {
    const engineColor = e.engine.startsWith("gemini") ? "text-emerald-300" : e.engine.startsWith("groq") ? "text-amber-300" : "text-sky-300";
    return (
      <span>
        <Badge className="mr-2 bg-primary/20 accent-text border-primary/30">COMMIT</Badge>
        <span className="mono">{e.skillKey}_v{e.version}.py</span>
        <span className="mx-1.5 text-muted-foreground">·</span>
        <span className="text-muted-foreground">{e.durationMs}ms · </span>
        <span className={`mono ${engineColor}`}>{e.engine}</span>
      </span>
    );
  }
  if (e.kind === "policy.decision") {
    return (
      <span>
        <Badge className={`mr-2 ${e.decision === "auto" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
          {e.decision === "auto" ? "AUTO" : "QUEUE"}
        </Badge>
        <span className="text-foreground/90">{e.action}</span>
        <span className="text-muted-foreground"> — {e.ruleHit}</span>
      </span>
    );
  }
  if (e.kind === "approval.queued") {
    return (
      <span>
        <Badge className="mr-2 bg-violet-500/20 text-violet-300 border-violet-500/30">QUEUED</Badge>
        <span className="mr-1.5">{AGENT_ICON[e.agent]}</span>
        {e.title}
      </span>
    );
  }
  return <span className="text-muted-foreground">{(e as any).kind}</span>;
}
