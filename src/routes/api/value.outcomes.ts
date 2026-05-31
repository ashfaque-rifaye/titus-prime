/**
 * GET  /api/value/outcomes  → recovery-rate stats (proves actions worked)
 * POST /api/value/outcomes  → resolve a pending outcome { ref, status }
 */
import { createFileRoute } from "@tanstack/react-router";
import { getOutcomeStats, resolveOutcome } from "@/lib/value/outcomes.server";

export const Route = createFileRoute("/api/value/outcomes")({
  server: {
    handlers: {
      GET: async () => {
        return json(getOutcomeStats());
      },
      POST: async ({ request }) => {
        const { ref, status } = await request.json().catch(() => ({ ref: "", status: "success" }));
        const resolved =
          ref && (status === "success" || status === "failed") ? resolveOutcome(ref, status) : null;
        return json({ resolved, stats: getOutcomeStats() });
      },
    },
  },
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
