/**
 * POST /api/codex/stream
 *
 * Workshop-pane streaming endpoint. Powered by Codex — the single AI engine.
 * Streams Codex tokens to the Workshop pane as it writes Python. The body shape
 * is unchanged so the existing Workshop component keeps working without changes.
 *
 * Body: { agent: string, intent: string, context?: string }
 */
import { createFileRoute } from "@tanstack/react-router";
import { selectProvider, streamWithFallback } from "@/lib/llm";

const SYSTEM = `You are Codex Prime, the shared coding agent inside Titus-Prime — an
autonomous financial operations system. You are called by specialist agents to
write Python that solves a specific problem on specific data.

Hard rules:
- Output ONLY a single Python file. No prose. No markdown fences.
- Header docstring: calling agent, business reason, an input-hash placeholder, UTC timestamp.
- Use pandas / numpy / scipy / pulp where useful. Type hints required.
- Concise inline comments citing the financial reasoning.
- End with \`if __name__ == "__main__":\` printing a one-line human summary.
- 60-120 lines. Tight.`;

export const Route = createFileRoute("/api/codex/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          agent?: string;
          intent?: string;
          context?: string;
        };
        const agent = body.agent ?? "Specialist Agent";
        const intent = body.intent ?? "Generate skill";
        const context = body.context ?? "";

        const userPrompt = [
          `Calling agent: ${agent}`,
          `Intent: ${intent}`,
          context && `Context: ${context}`,
          "",
          "Generate the Python skill now.",
        ]
          .filter(Boolean)
          .join("\n");

        const { active } = selectProvider();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const encoder = new TextEncoder();
            const send = (obj: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            // OpenAI-compatible frame so the existing client parses unchanged.
            const sendDelta = (text: string, engine: string) =>
              send({ choices: [{ delta: { content: text } }], engine });

            try {
              for await (const chunk of streamWithFallback({
                messages: [
                  { role: "system", content: SYSTEM },
                  { role: "user", content: userPrompt },
                ],
                maxTokens: 1400,
                temperature: 0.3,
                trace: `workshop.${agent}`,
              })) {
                if (chunk.type === "delta") sendDelta(chunk.text, chunk.engine);
                else if (chunk.type === "error") {
                  sendDelta(`\n# stream-error[${chunk.engine}]: ${chunk.message}\n`, chunk.engine);
                }
              }
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            } catch (e: any) {
              sendDelta(`\n# fatal: ${e?.message ?? "unknown"}\n`, active);
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            } finally {
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Active-Engine": active,
          },
        });
      },
    },
  },
});
