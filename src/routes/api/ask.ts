/**
 * POST /api/ask
 *
 * The CFO Ask Mode. Takes a free-form question and answers it grounded in the
 * current canonical snapshot (cash, AR, AP, subscriptions, tax). Returns a
 * structured object with the answer, key numbers, and the data the answer
 * was derived from.
 */
import { createFileRoute } from "@tanstack/react-router";
import { selectProvider } from "@/lib/llm";
import { ensureSnapshot } from "@/lib/connectors/registry";
import { deriveView } from "@/lib/snapshot-adapter.server";

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { question } = (await request.json().catch(() => ({}))) as { question?: string };
        if (!question || question.length < 3) {
          return new Response(JSON.stringify({ error: "Empty question" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const snap = await ensureSnapshot();
        const view = await deriveView();

        // Build a compact ground-truth context the LLM can cite.
        const context = {
          asOf: new Date().toISOString(),
          cash: {
            totalUsd: snap.totals.cashUsd,
            byBank: snap.banks.map((b) => ({
              account: b.account,
              balance: b.balance,
              currency: b.currency,
              balanceUsd: b.balanceUsd,
            })),
          },
          accountsReceivable: {
            totalUsd: snap.totals.arUsd,
            count: snap.inflows.length,
            top5: [...snap.inflows]
              .sort((a, b) => b.amountUsd - a.amountUsd)
              .slice(0, 5)
              .map((i) => ({
                customer: i.customer,
                amount: i.amount,
                currency: i.currency,
                amountUsd: i.amountUsd,
                daysLate: i.daysLate,
              })),
          },
          accountsPayable: {
            totalUsd: snap.totals.apUsd,
            count: snap.outflows.length,
            top5: [...snap.outflows]
              .sort((a, b) => b.amountUsd - a.amountUsd)
              .slice(0, 5)
              .map((o) => ({
                vendor: o.vendor,
                kind: o.kind,
                amount: o.amount,
                currency: o.currency,
                amountUsd: o.amountUsd,
                dueIn: Math.round((new Date(o.dueAt).getTime() - Date.now()) / 86400_000),
              })),
          },
          subscriptions: {
            monthlyUsd: snap.totals.monthlySubsUsd,
            list: snap.subscriptions.map((s) => ({
              vendor: s.vendor,
              monthlyUsd: s.monthlyCostUsd,
              renewsIn: s.renewsIn,
              essential: s.essential,
            })),
          },
          treasury: {
            projection30d: view.projection.filter((p) => p.day % 3 === 0),
            safetyFloor: 5000,
          },
        };

        const system = `You are Titus-Prime's CFO Ask Mode. Answer the user's
question concisely and quantitatively, grounded ONLY in the provided JSON
context.

CRITICAL OUTPUT FORMAT:
You MUST output a single, valid JSON object — and ONLY that object. No
markdown fences, no prose, no nesting your answer inside a string. The object
shape is exactly:

{
  "answer": "string — direct numerical answer in 1-3 sentences",
  "highlights": ["string", "string", ...],
  "citedFigures": [{"label": "string", "value": "string"}, ...]
}

Rules:
- Lead with the direct numerical answer in the first sentence of "answer".
- Quote exact dollar/INR figures from the context (with currency).
- "highlights" must be an ARRAY of strings (3-5 short bullet-shaped sentences). Never a single string.
- "citedFigures" must be an ARRAY of {label,value} objects. Never empty if numbers exist in context.
- If the question requires data not in context, say so plainly in "answer".
- Output ONLY the JSON object. Do not wrap. Do not nest. Do not fence.`;

        const user = `Question: ${question}

Ground truth (JSON):
${JSON.stringify(context)}

Answer now in strict JSON.`;

        const { provider, active } = selectProvider();
        try {
          const raw = await provider.complete({
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            maxTokens: 1500,
            temperature: 0.2,
            trace: "ask",
          });

          // Strip code fences if the model adds them.
          const stripped = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          // Robust extractor: find the largest valid JSON object that looks
          // like our wrapper { answer, highlights, citedFigures }, even if
          // the model wrapped it inside another string.
          function extractWrapper(
            s: string,
          ): { answer: string; highlights: any; citedFigures: any } | null {
            // First try direct parse.
            try {
              const obj = JSON.parse(s);
              if (obj && typeof obj === "object" && typeof obj.answer === "string") {
                // If the answer itself is a JSON-looking string, recurse.
                if (obj.answer.trim().startsWith("{") && obj.answer.includes('"answer"')) {
                  const inner = extractWrapper(obj.answer);
                  if (inner) return inner;
                }
                return obj;
              }
            } catch {
              /* fall through */
            }
            // Look for the FIRST balanced JSON object containing "answer":
            const start = s.indexOf("{");
            if (start < 0) return null;
            let depth = 0;
            let inStr = false;
            let escape = false;
            for (let i = start; i < s.length; i++) {
              const ch = s[i];
              if (escape) {
                escape = false;
                continue;
              }
              if (ch === "\\") {
                escape = true;
                continue;
              }
              if (ch === '"') inStr = !inStr;
              if (inStr) continue;
              if (ch === "{") depth++;
              else if (ch === "}") {
                depth--;
                if (depth === 0) {
                  const candidate = s.slice(start, i + 1);
                  try {
                    const obj = JSON.parse(candidate);
                    if (obj && typeof obj === "object" && typeof obj.answer === "string")
                      return obj;
                  } catch {
                    /* try next */
                  }
                }
              }
            }
            return null;
          }

          const unwrapped = extractWrapper(stripped);
          let parsed: {
            answer: string;
            highlights: string[] | string;
            citedFigures: Array<{ label: string; value: string }> | string;
          };
          if (unwrapped) {
            parsed = unwrapped;
          } else {
            parsed = { answer: stripped, highlights: [], citedFigures: [] };
          }

          // Normalize highlights — some models return a single string instead of an array.
          const highlights: string[] = Array.isArray(parsed.highlights)
            ? parsed.highlights
            : typeof parsed.highlights === "string" && parsed.highlights.length > 0
              ? [parsed.highlights]
              : [];
          const citedFigures = Array.isArray(parsed.citedFigures) ? parsed.citedFigures : [];

          return new Response(
            JSON.stringify({
              answer:
                typeof parsed.answer === "string" ? parsed.answer : String(parsed.answer ?? ""),
              highlights,
              citedFigures,
              engine: active,
              context: {
                cashUsd: snap.totals.cashUsd,
                arUsd: snap.totals.arUsd,
                apUsd: snap.totals.apUsd,
              },
            }),
            { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({
              answer: `I couldn't reach the LLM right now (${e?.message ?? "unknown"}). Here are the raw numbers I'd anchor on: cash $${snap.totals.cashUsd.toLocaleString()}, AR $${snap.totals.arUsd.toLocaleString()}, AP $${snap.totals.apUsd.toLocaleString()}.`,
              highlights: [],
              citedFigures: [
                { label: "Cash", value: `$${snap.totals.cashUsd.toLocaleString()}` },
                { label: "AR", value: `$${snap.totals.arUsd.toLocaleString()}` },
                { label: "AP", value: `$${snap.totals.apUsd.toLocaleString()}` },
              ],
              engine: "fallback",
            }),
            { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
