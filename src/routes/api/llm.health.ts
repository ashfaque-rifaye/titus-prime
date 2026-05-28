/**
 * GET /api/llm/health
 *
 * Pings both LLM providers. Returns a JSON document the client can render in
 * the top-bar HealthBadge. Also writes a clean ascii block to the server log
 * (the user explicitly asked for a clear console message).
 */
import { createFileRoute } from "@tanstack/react-router";
import { healthAll } from "@/lib/llm";

export const Route = createFileRoute("/api/llm/health")({
  server: {
    handlers: {
      GET: async () => {
        const result = await healthAll();
        return new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
