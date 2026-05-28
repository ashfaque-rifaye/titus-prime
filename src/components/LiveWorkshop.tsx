/**
 * LiveWorkshop
 *
 * Renders Codex Prime's token stream as it arrives during an orchestrator run.
 * The Boardroom shows this pane while a run is active; the regular Workshop
 * pane (single-skill, click-to-trigger) is shown when idle.
 */
import { useEffect, useRef } from "react";
import { motion } from "motion/react";

export function LiveWorkshop({ skillKey, code }: { skillKey: string | null; code: string }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [code]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 pulse-dot" />
          <span className="mono">codex-prime</span>
          <span className="text-muted-foreground">·</span>
          <motion.span
            key={skillKey ?? "idle"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mono accent-text"
          >
            {skillKey ?? "warming up"}
          </motion.span>
        </div>
        <span className="text-[10px] mono text-muted-foreground">live</span>
      </div>
      <div className="relative flex-1 overflow-hidden bg-background/40">
        <pre ref={preRef} className="mono h-full overflow-auto p-4 text-[12.5px] leading-relaxed scrollbar-thin">
          <code className="text-foreground/90">{code}</code>
          <span className="caret" />
        </pre>
      </div>
    </div>
  );
}
