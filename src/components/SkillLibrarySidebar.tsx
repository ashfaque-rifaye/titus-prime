import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listSkills, type SkillRow, agentColor } from "@/lib/skills-store";
import { supabase } from "@/integrations/supabase/client";

export function SkillLibrarySidebar() {
  const [skills, setSkills] = useState<SkillRow[]>([]);

  async function refresh() {
    try { setSkills(await listSkills()); } catch (e) { console.error(e); }
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("skills-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "skills" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Skill Library</h3>
        <Link to="/skills" className="text-[11px] accent-text hover:underline">View all →</Link>
      </div>
      <div className="text-[11px] text-muted-foreground mb-2 mono">workspace/skills/</div>
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">Empty. Trigger an agent to commit the first skill.</p>
      ) : (
        <ul className="space-y-1 max-h-[280px] overflow-auto scrollbar-thin">
          {skills.slice(0, 12).map((s) => (
            <li key={s.id} className="mono text-[11.5px] flex justify-between gap-2">
              <span className="truncate">
                <span className={agentColor(s.agent)}>{s.agent}/</span>
                <span className="text-foreground">{s.name}</span>
                <span className="text-muted-foreground">_v{s.version}.py</span>
              </span>
              {s.scheduled_cron && <span className="text-[10px] rounded bg-primary/20 px-1 accent-text">cron</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}