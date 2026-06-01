/**
 * POST /api/llm/ping
 *
 * REAL Codex connectivity check — spends ~1 token. This is the ONLY endpoint
 * that actually calls the Codex API for a status check, and it is invoked
 * exclusively from the manual "Ping" button in the header. The 30-second
 * auto-poll uses /api/llm/health, which is credit-free (config-only).
 *
 * POST (not GET) so it can never be triggered by a prefetch / link crawler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { pingCodex } from "@/lib/llm";

export const Route = createFileRoute("/api/llm/ping")({
  server: {
    handlers: {
      POST: async () => {
        const result = await pingCodex();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
