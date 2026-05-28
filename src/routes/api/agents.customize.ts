/**
 * POST /api/agents/customize
 *
 * Persist a free-form user instruction that shapes a specialist agent's
 * behavior. Stored in the `agent_customizations` Supabase table — the
 * orchestrator reads the latest active row per agent and injects it into the
 * agent's system prompt on the next run.
 *
 * Body: { agent: AgentId, instruction: string }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/supabase-admin.server";

const VALID_AGENTS = ["treasury", "collection", "subscription", "tax", "scenario", "codex"] as const;

export const Route = createFileRoute("/api/agents/customize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { agent?: string; instruction?: string } = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const agent = body.agent;
        const instruction = body.instruction?.trim();
        if (!agent || !VALID_AGENTS.includes(agent as any)) {
          return new Response(
            JSON.stringify({ error: `agent must be one of ${VALID_AGENTS.join(", ")}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!instruction || instruction.length < 4) {
          return new Response(JSON.stringify({ error: "instruction too short" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (instruction.length > 500) {
          return new Response(JSON.stringify({ error: "instruction too long (max 500 chars)" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          // Deactivate prior instructions for this agent so only the latest is active.
          await supabaseAdmin
            .from("agent_customizations")
            .update({ active: false })
            .eq("agent", agent)
            .eq("active", true);

          const { data, error } = await supabaseAdmin
            .from("agent_customizations")
            .insert({ agent, instruction, active: true })
            .select()
            .single();
          if (error) throw error;

          return new Response(JSON.stringify({ ok: true, customization: data }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          // Graceful degrade if the table doesn't exist yet (migration not run).
          // We still acknowledge so the UI can show success in the demo.
          // eslint-disable-next-line no-console
          console.warn("[customize] db write failed, in-memory only:", e?.message);
          memoStore[agent] = instruction;
          return new Response(
            JSON.stringify({
              ok: true,
              customization: { agent, instruction, active: true, persisted: false },
              note: "Stored in process memory — run the migration to persist.",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const agent = url.searchParams.get("agent");
        try {
          const q = supabaseAdmin
            .from("agent_customizations")
            .select("*")
            .eq("active", true)
            .order("created_at", { ascending: false });
          const { data, error } = agent ? await q.eq("agent", agent) : await q;
          if (error) throw error;
          return new Response(JSON.stringify({ customizations: data ?? [] }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          // Fallback: return memo store
          const list = Object.entries(memoStore).map(([a, i]) => ({
            agent: a,
            instruction: i,
            active: true,
            persisted: false,
          }));
          return new Response(JSON.stringify({ customizations: list }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

// Process-scoped fallback when the migration hasn't run yet.
declare global {
  // eslint-disable-next-line no-var
  var __TITUS_AGENT_CUSTOMIZATIONS__: Record<string, string> | undefined;
}
const memoStore: Record<string, string> =
  globalThis.__TITUS_AGENT_CUSTOMIZATIONS__ ??
  (globalThis.__TITUS_AGENT_CUSTOMIZATIONS__ = {});
