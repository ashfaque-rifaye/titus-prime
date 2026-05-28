/**
 * GET /api/connectors/list
 *
 * Returns the static catalog of connectors plus their current configured /
 * last-synced status. The Connections panel in the Boardroom renders this.
 */
import { createFileRoute } from "@tanstack/react-router";
import { listConnectors } from "@/lib/connectors/registry";

export const Route = createFileRoute("/api/connectors/list")({
  server: {
    handlers: {
      GET: () => {
        return new Response(JSON.stringify({ connectors: listConnectors() }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
