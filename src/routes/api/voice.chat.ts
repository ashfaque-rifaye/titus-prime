/**
 * POST /api/voice/chat
 *
 * Takes a transcribed voice query and returns a conversational string
 * response from the LLM, grounded in the Boardroom snapshot context.
 */
import { createFileRoute } from "@tanstack/react-router";
import { selectProvider } from "@/lib/llm";
import { ensureSnapshot } from "@/lib/connectors/registry";
import { deriveView } from "@/lib/snapshot-adapter.server";

export const Route = createFileRoute("/api/voice/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text } = await request.json().catch(() => ({ text: "" }));

        if (!text || text.length < 2) {
          return new Response(JSON.stringify({ text: "I didn't quite catch that." }), {
            status: 400,
          });
        }

        const snap = await ensureSnapshot();
        const view = await deriveView();

        // Derive the projected breach directly from the 30-day projection.
        const SAFETY_FLOOR = 5_000;
        const breachPoint = view.projection.find((p) => p.balance < SAFETY_FLOOR);
        const breach = breachPoint
          ? { day: breachPoint.day, shortfall: Math.round(SAFETY_FLOOR - breachPoint.balance) }
          : null;

        const context = {
          cashUsd: snap.totals.cashUsd,
          arUsd: snap.totals.arUsd,
          apUsd: snap.totals.apUsd,
          monthlySubsUsd: snap.totals.monthlySubsUsd,
          breach,
        };

        const system = `You are Titus-Prime, a highly intelligent, autonomous CFO voice assistant.
You are currently speaking aloud to the founder in the Boardroom. 
Respond to their financial queries concisely and naturally, as if having a real conversation.
NEVER use markdown formatting, bullet points, asterisks, or complex lists because this text will be passed directly to a Text-to-Speech engine.
Use simple, easily pronounceable numbers (e.g., "three point eight million dollars").
Keep your responses brief—ideally 1 to 3 short sentences. Be confident, professional, and slightly futuristic.

Current Financial Context:
- Cash: $${context.cashUsd.toLocaleString()}
- AR: $${context.arUsd.toLocaleString()}
- AP: $${context.apUsd.toLocaleString()}
- Subscriptions: $${context.monthlySubsUsd.toLocaleString()}/mo
${context.breach ? `- ALERT: Projected cash shortfall of $${context.breach.shortfall.toLocaleString()} in ${context.breach.day} days.` : "- Reserves are stable."}
`;

        const user = `User said: "${text}"`;

        const { provider } = selectProvider();

        try {
          const raw = await provider.complete({
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            maxTokens: 500,
            temperature: 0.6,
            trace: "voice-chat",
          });

          // Clean up any stray markdown or quotes that might trip up the TTS
          const cleaned = raw.replace(/\*/g, "").replace(/#/g, "").replace(/`/g, "").trim();

          return new Response(JSON.stringify({ text: cleaned }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({
              text: "I'm having trouble connecting to the financial core right now.",
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
