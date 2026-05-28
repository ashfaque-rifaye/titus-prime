import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SKILL_TEMPLATES, type SkillKey } from "@/lib/skill-templates";
import { commitSkill } from "@/lib/skills-store";
import { toast } from "sonner";

export type WorkshopJob = {
  skillKey: SkillKey;
  intent: string;
  agent: string;
  mode: "stream" | "template";
};

export function Workshop({
  job,
  onComplete,
  onClose,
}: {
  job: WorkshopJob | null;
  onComplete?: () => void;
  onClose?: () => void;
}) {
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;
    const key = `${job.skillKey}-${job.mode}-${Date.now()}`;
    if (startedFor.current === key) return;
    startedFor.current = key;

    setOutput("");
    setError(null);
    setDone(false);
    setRunning(true);

    let cancelled = false;
    const tpl = SKILL_TEMPLATES[job.skillKey];

    async function finish() {
      if (cancelled) return;
      setRunning(false);
      setDone(true);
      try {
        await commitSkill(job!.skillKey);
        toast.success(`Committed ${tpl.agent}/${tpl.name}.py`);
      } catch (e) {
        console.error("commit failed", e);
      }
      onComplete?.();
    }

    async function typewrite(text: string, chunk = 14, delay = 12) {
      for (let i = 0; i < text.length; i += chunk) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        setOutput((s) => s + text.slice(i, i + chunk));
      }
    }

    async function run() {
      if (job!.mode === "template") {
        await typewrite(tpl.code);
        await finish();
        return;
      }
      try {
        const resp = await fetch("/api/codex/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent: job!.agent, intent: job!.intent, context: tpl.summary }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Stream failed" }));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        if (!resp.body) throw new Error("No response body");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          if (cancelled) return;
          const { done: rd, value } = await reader.read();
          if (rd) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") { await finish(); return; }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) setOutput((s) => s + delta);
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
        await finish();
      } catch (e: any) {
        if (cancelled) return;
        setError((e?.message ?? "Stream failed") + " — falling back to canonical template");
        await typewrite(tpl.code, 18, 10);
        await finish();
      }
    }

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.skillKey, job?.mode]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [output]);

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-2xl">💻</div>
        <h3 className="text-base font-semibold">Workshop is idle</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Click any number, alert, or <span className="mono accent-text">provenance:</span> badge in the Boardroom.
          Codex Prime will write the Python that produced it — token by token.
        </p>
      </div>
    );
  }

  const tpl = SKILL_TEMPLATES[job.skillKey];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-amber-400 pulse-dot" : done ? "bg-emerald-400" : "bg-muted-foreground"}`} />
            <span className="mono">codex-prime</span>
            <span>·</span>
            <span>{job.agent}</span>
            <span>·</span>
            <span className="mono truncate">{tpl.agent}/{tpl.name}.py</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground/80 truncate">{job.intent}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-secondary">close</button>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden bg-background/40">
        <pre ref={preRef} className="mono h-full overflow-auto p-4 text-[12.5px] leading-relaxed scrollbar-thin">
          <code className="text-foreground/90">{output}</code>
          {running && <span className="caret" />}
        </pre>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-2 left-2 right-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {done && (
        <div className="border-t border-border bg-surface/60 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted-foreground">stdout:</span>
            <span className="mono accent-text">{tpl.outputSummary}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">duration <span className="text-foreground">{tpl.durationMs}ms</span></span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">committed <span className="mono text-foreground">workspace/skills/{tpl.agent}/{tpl.name}.py</span></span>
          </div>
        </div>
      )}
    </div>
  );
}