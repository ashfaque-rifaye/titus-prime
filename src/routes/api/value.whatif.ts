/**
 * POST /api/value/whatif
 *
 * CFO-grade advisory: given a hypothetical, re-project 30-day runway and report
 * the delta vs. baseline. Body: WhatIfInput (hires, lostCustomer, etc.).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ensureSnapshot } from "@/lib/connectors/registry";
import { simulateWhatIf, type WhatIfInput } from "@/lib/value/whatif.server";

export const Route = createFileRoute("/api/value/whatif")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = (await request.json().catch(() => ({}))) as WhatIfInput;
        const snap = await ensureSnapshot();
        const result = simulateWhatIf(snap, input);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
