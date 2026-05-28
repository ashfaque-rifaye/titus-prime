/**
 * Server-side skill-library store.
 *
 * This is the boundary between the agent system and the persistence layer.
 * In production we'd swap this for a real on-disk git repo (filesystem MCP +
 * simple-git), but for the demo we use the Supabase `skills` table — which is
 * still a real, queryable, versioned, exportable artifact.
 *
 * Treat this module as the "Filesystem MCP / Git MCP" adapter.
 */
import { supabaseAdmin } from "./supabase-admin.server";
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

export type CommitInput = {
  agent: AgentId | string;
  name: string;
  code: string;
  summary?: string;
  outputSummary?: string;
  inputHash?: string;
  durationMs?: number;
  scheduledCron?: string;
};

/** Bumps version automatically: v(n+1) where n = current max for (agent, name). */
export async function commitSkill(input: CommitInput): Promise<SkillRow> {
  const { data: prev, error: prevErr } = await supabaseAdmin
    .from("skills")
    .select("version")
    .eq("agent", input.agent)
    .eq("name", input.name)
    .order("version", { ascending: false })
    .limit(1);
  if (prevErr) throw prevErr;
  const nextVersion = ((prev?.[0]?.version as number | undefined) ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("skills")
    .insert({
      agent: input.agent,
      name: input.name,
      version: nextVersion,
      language: "python",
      code: input.code,
      summary: input.summary ?? null,
      output_summary: input.outputSummary ?? null,
      input_hash: input.inputHash ?? null,
      duration_ms: input.durationMs ?? null,
      scheduled_cron: input.scheduledCron ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SkillRow;
}

export async function listSkillsServer(): Promise<SkillRow[]> {
  const { data, error } = await supabaseAdmin
    .from("skills")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SkillRow[];
}
