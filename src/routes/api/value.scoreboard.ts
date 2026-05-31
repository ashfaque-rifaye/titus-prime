/**
 * GET /api/value/scoreboard
 *
 * Returns the running "money found" tally: protected / recovered / saved USD,
 * minutes saved, realized vs. projected split, per-agent breakdown, and the
 * most recent value events. Drives the Boardroom Value Scoreboard.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getScoreboard } from "@/lib/value/ledger.server";

export const Route = createFileRoute("/api/value/scoreboard")({
  server: {
    handlers: {
      GET: async () => {
        const sb = await getScoreboard();
        return new Response(JSON.stringify(sb), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
