/**
 * GET /api/value/anomalies
 *
 * The proactive "sentinel" feed — scans the current canonical snapshot and
 * returns the anomalies a CFO would want flagged without asking.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ensureSnapshot } from "@/lib/connectors/registry";
import { detectAnomalies } from "@/lib/value/anomalies.server";

export const Route = createFileRoute("/api/value/anomalies")({
  server: {
    handlers: {
      GET: async () => {
        const snap = await ensureSnapshot();
        const anomalies = detectAnomalies(snap);
        return new Response(JSON.stringify({ anomalies, scannedAt: Date.now() }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
