/**
 * POST /api/csv/ingest
 *
 * Body: text/csv (or application/json with `{ csv: "..." }`)
 * Returns: { rowCount, columns[], preview[], hash, bytes }
 *
 * Real schema-inference + optional LLM enrichment that gives each column a
 * short human-readable meaning.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ingest, enrichWithLlm } from "@/lib/services/csv-ingest";

export const Route = createFileRoute("/api/csv/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ct = request.headers.get("content-type") ?? "";
        let text = "";
        let enrich = true;
        if (ct.includes("application/json")) {
          const body = (await request.json()) as { csv?: string; enrich?: boolean };
          text = body.csv ?? "";
          enrich = body.enrich !== false;
        } else {
          text = await request.text();
        }
        if (!text) {
          return new Response(JSON.stringify({ error: "empty body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (text.length > 2_000_000) {
          return new Response(JSON.stringify({ error: "max 2MB CSV in demo" }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
        }

        let result = ingest(text);
        if (enrich) {
          try {
            result = await enrichWithLlm(result);
          } catch (e) {
            // enrichment is best-effort; never fail the upload because of it.

            console.warn("[csv.ingest] enrichment skipped:", (e as Error)?.message);
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
