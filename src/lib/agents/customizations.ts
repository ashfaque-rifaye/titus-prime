/**
 * Customization loader.
 *
 * Reads the latest active row per agent from `agent_customizations` (Supabase)
 * with a graceful fallback to the in-process memo store the customize endpoint
 * uses when the migration hasn't run yet. The orchestrator and Codex Prime
 * both call `getCustomization(agent)` to inject the user's instruction into
 * each agent's system prompt at run time.
 */
import { supabaseAdmin } from "../supabase-admin.server";
import type { AgentId } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __TITUS_AGENT_CUSTOMIZATIONS__: Record<string, string> | undefined;
}

const memoStore = (): Record<string, string> =>
  globalThis.__TITUS_AGENT_CUSTOMIZATIONS__ ??
  (globalThis.__TITUS_AGENT_CUSTOMIZATIONS__ = {});

export async function getCustomization(agent: AgentId): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("agent_customizations")
      .select("instruction")
      .eq("agent", agent)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.instruction) return data.instruction as string;
  } catch {
    /* fall through to memo */
  }
  return memoStore()[agent] ?? null;
}

export async function getAllCustomizations(): Promise<Partial<Record<AgentId, string>>> {
  const out: Partial<Record<AgentId, string>> = {};
  try {
    const { data } = await supabaseAdmin
      .from("agent_customizations")
      .select("agent, instruction")
      .eq("active", true);
    if (Array.isArray(data)) {
      for (const row of data) out[row.agent as AgentId] = row.instruction as string;
    }
  } catch {
    /* fall through */
  }
  for (const [a, i] of Object.entries(memoStore())) {
    if (!out[a as AgentId]) out[a as AgentId] = i;
  }
  return out;
}
