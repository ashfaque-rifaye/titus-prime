import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { listSkills, agentColor, type SkillRow } from "@/lib/skills-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill Library · Titus-Prime" },
      {
        name: "description",
        content:
          "Versioned Python skills authored by Codex Prime on behalf of the specialist agents.",
      },
    ],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [open, setOpen] = useState<SkillRow | null>(null);

  async function refresh() {
    try {
      setSkills(await listSkills());
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("skills-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "skills" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function exportZip() {
    if (skills.length === 0) {
      toast.error("Library is empty");
      return;
    }
    const zip = new JSZip();
    zip.file(
      "README.md",
      `# Titus-Prime · workspace/skills\n\nAuthored by Codex Prime.\n\n${skills.length} skills.\n`,
    );
    for (const s of skills) {
      zip.file(`${s.agent}/${s.name}_v${s.version}.py`, s.code);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "titus-prime-skills.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported skill library");
  }

  const grouped = skills.reduce<Record<string, SkillRow[]>>((acc, s) => {
    (acc[s.agent] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Skill Library</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Every skill here was written by <span className="accent-text">Codex Prime</span> in
            response to a specialist agent's request. Versioned, replayable, exportable.
          </p>
        </div>
        <button
          onClick={exportZip}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
        >
          Export codebase (.zip)
        </button>
      </div>
      {skills.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <div className="text-4xl">📂</div>
          <p className="mt-3 text-sm text-muted-foreground">
            Library is empty. Visit the Boardroom and trigger an agent.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(grouped).map(([agent, rows]) => (
            <div key={agent}>
              <div className="mb-2 mono text-xs">
                <span className={agentColor(agent)}>{agent}/</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {rows.length} file{rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOpen(s)}
                    className="text-left rounded-lg border border-border bg-surface/60 p-3 hover:border-primary/40 transition"
                  >
                    <div className="mono text-xs">
                      <span className="text-foreground">{s.name}</span>
                      <span className="text-muted-foreground">_v{s.version}.py</span>
                    </div>
                    {s.summary && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {s.summary}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] mono text-muted-foreground">
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                      {s.duration_ms && <span>· {s.duration_ms}ms</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl rounded-xl border border-border bg-surface overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="mono text-xs">
                  <span className={agentColor(open.agent)}>{open.agent}/</span>
                  <span className="text-foreground">{open.name}</span>
                  <span className="text-muted-foreground">_v{open.version}.py</span>
                </div>
                <button
                  onClick={() => setOpen(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  close
                </button>
              </div>
              <pre className="mono text-[12.5px] leading-relaxed overflow-auto p-4 scrollbar-thin bg-background/40 flex-1">
                {open.code}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
