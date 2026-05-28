/**
 * POST /api/agents/run
 *
 * Triggers a full orchestrator run and streams every typed event back to the
 * client as Server-Sent Events. The client (Boardroom) renders these events in
 * three places at once:
 *   • the Workshop pane (codex.token frames)
 *   • the Agent Console transcript
 *   • the Approval Queue (real-time via Supabase channels — this stream just
 *     tells the queue to refresh sooner)
 *
 * Body: { mode?: "stream" | "template", intent?: string }
 * Stream: text/event-stream of `data: <json>\n\n` lines, one per AgentEvent.
 */
import { createFileRoute } from "@tanstack/react-router";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { bus } from "@/lib/agents/event-bus";
import type { AgentEvent } from "@/lib/agents/types";

export const Route = createFileRoute("/api/agents/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { mode?: "stream" | "template"; intent?: string } = {};
        try {
          body = await request.json();
        } catch {
          // empty body is fine; defaults apply.
        }
        const mode = body.mode === "stream" ? "stream" : "template";

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            const send = (e: AgentEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
              } catch {
                /* client disconnected; bus listener cleanup happens below */
              }
            };

            const unsub = bus.subscribe(send);

            (async () => {
              try {
                await runOrchestrator({ mode, intent: body.intent });
              } catch (e: any) {
                send({
                  kind: "run.failed",
                  runId: "unknown",
                  ts: Date.now(),
                  error: e?.message ?? "orchestrator failed",
                });
              } finally {
                unsub();
                try {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  controller.close();
                } catch {
                  /* already closed */
                }
              }
            })();
          },
          cancel() {
            // Subscriber cleanup is handled in the start closure on completion.
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
