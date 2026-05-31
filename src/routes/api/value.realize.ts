/**
 * POST /api/value/realize
 *
 * Marks projected value events as realized (outcome confirmed) for a given
 * ref — e.g. when the user approves a collection email, the recovered amount
 * moves from "projected" to "realized" on the scoreboard.
 *
 * Body: { ref: string }
 */
import { createFileRoute } from "@tanstack/react-router";
import { realizeByRef } from "@/lib/value/ledger.server";

export const Route = createFileRoute("/api/value/realize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ref } = (await request.json().catch(() => ({}))) as { ref?: string };
        if (!ref) {
          return new Response(JSON.stringify({ error: "ref required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const count = await realizeByRef(ref);
        return new Response(JSON.stringify({ ok: true, realized: count }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
