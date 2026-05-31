/**
 * POST /api/voice/tts
 *
 * Text-to-Speech via the Inference Gateway.
 * Accepts text and returns a synthesized audio blob.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text } = await request.json().catch(() => ({ text: "" }));

        if (!text) {
          return new Response(JSON.stringify({ error: "No text provided" }), { status: 400 });
        }

        const gatewayUrl =
          process.env.GATEWAY_URL || "https://ashfaque94-inference-gateway.hf.space";
        const gatewayKey = process.env.GATEWAY_API_KEY || "";

        try {
          const response = await fetch(`${gatewayUrl}/v1/audio/speech`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {}),
            },
            body: JSON.stringify({ input: text }),
          });

          if (!response.ok) {
            throw new Error(`Gateway returned ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          return new Response(arrayBuffer, {
            headers: { "Content-Type": "audio/wav" },
          });
        } catch (e: any) {
          // If the gateway fails (due to hackathon env/auth), we return a 500
          // and the frontend will fallback to the browser's native SpeechSynthesis API.
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      },
    },
  },
});
