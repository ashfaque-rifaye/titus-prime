/**
 * POST /api/connectors/sync
 *
 * Triggers a fan-out sync across every connector (or a subset). Returns the
 * per-connector results plus the canonical snapshot.
 *
 * Body: { only?: ConnectorId[] }  // optional subset
 */
import { createFileRoute } from "@tanstack/react-router";
import { syncAll } from "@/lib/connectors/registry";
import type { ConnectorId } from "@/lib/connectors/types";

export const Route = createFileRoute("/api/connectors/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { only?: ConnectorId[] } = {};
        try {
          body = await request.json();
        } catch {
          /* empty body acceptable */
        }
        const report = await syncAll({ only: body.only });
        return new Response(JSON.stringify(report), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
