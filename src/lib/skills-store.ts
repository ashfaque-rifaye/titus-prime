import { supabase } from "@/integrations/supabase/client";
import { SKILL_TEMPLATES, type SkillKey } from "./skill-templates";
import type { AgentId } from "./mock-data";

export type SkillRow = {
  id: string;
  agent: string;
  name: string;
  version: number;
  language: string;
  code: string;
  summary: string | null;
  output_summary: string | null;
  input_hash: string | null;
  duration_ms: number | null;
  scheduled_cron: string | null;
  created_at: string;
};

export async function listSkills(): Promise<SkillRow[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SkillRow[];
}

export async function commitSkill(key: SkillKey, opts?: { scheduledCron?: string }) {
  const tpl = SKILL_TEMPLATES[key];
  // bump version if exists
  const { data: existing } = await supabase
    .from("skills")
    .select("version")
    .eq("agent", tpl.agent)
    .eq("name", tpl.name)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = ((existing?.[0]?.version as number | undefined) ?? 0) + 1;
  const inputHash = Math.random().toString(16).slice(2, 10);

  const { data, error } = await supabase
    .from("skills")
    .insert({
      agent: tpl.agent,
      name: tpl.name,
      version: nextVersion,
      language: "python",
      code: tpl.code,
      summary: tpl.summary,
      output_summary: tpl.outputSummary,
      input_hash: inputHash,
      duration_ms: tpl.durationMs,
      scheduled_cron: opts?.scheduledCron ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SkillRow;
}

export function agentColor(agent: AgentId | string): string {
  switch (agent) {
    case "treasury": return "text-emerald-400";
    case "collection": return "text-sky-400";
    case "subscription": return "text-amber-400";
    case "tax": return "text-rose-400";
    case "scenario": return "text-violet-400";
    case "codex": return "text-primary";
    default: return "text-muted-foreground";
  }
}