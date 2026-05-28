/**
 * GET /api/snapshot
 *
 * Returns the current canonical snapshot used by the Boardroom UI. If no
 * snapshot exists yet, triggers an initial sync to populate it.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ensureSnapshot } from "@/lib/connectors/registry";

export const Route = createFileRoute("/api/snapshot")({
  server: {
    handlers: {
      GET: async () => {
        const snap = await ensureSnapshot();
        return new Response(JSON.stringify(snap), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
