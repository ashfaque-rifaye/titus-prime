/**
 * Gemini 2.5 Flash provider — primary engine.
 *
 * Uses Google's OpenAI-compatible endpoint at generativelanguage.googleapis.com.
 * This gives us standard SSE streaming with the same frame format as OpenAI,
 * so the Workshop pane's existing parser works unchanged.
 *
 * Key: GEMINI_API_KEY (direct Google AI Studio key)
 * Fallback: LOVABLE_API_KEY (Lovable AI Gateway — legacy path)
 *
 * Important: Gemini 2.5 Flash uses "thinking tokens" internally, so we must use
 * `max_completion_tokens` instead of `max_tokens` to avoid the model exhausting
 * its budget on thinking before producing output.
 */
import type {
  LlmHealth,
  LlmProvider,
  LlmRequest,
  LlmStreamChunk,
} from "./types";

/** Google AI Studio OpenAI-compatible endpoint */
const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
/** Lovable AI Gateway (legacy fallback) */
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODEL_ID = "gemini-2.5-flash";

export class GeminiProvider implements LlmProvider {
  readonly engine = "gemini" as const;

  private get apiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.LOVABLE_API_KEY || undefined;
  }

  private get useGoogleDirect(): boolean {
    return Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
  }

  private get baseUrl(): string {
    return this.useGoogleDirect ? GOOGLE_URL : LOVABLE_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async health(): Promise<LlmHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: 0,
        detail: "GEMINI_API_KEY (or LOVABLE_API_KEY) missing — set one in .env to enable Gemini.",
        checkedAt,
      };
    }
    const started = Date.now();
    try {
      const resp = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [{ role: "user", content: "ping" }],
          max_completion_tokens: 50,
          stream: false,
        }),
      });
      const latencyMs = Date.now() - started;
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        return {
          engine: this.engine,
          ok: false,
          latencyMs,
          detail: `HTTP ${resp.status}: ${body.slice(0, 160)}`,
          checkedAt,
        };
      }
      const via = this.useGoogleDirect ? "Google AI Studio" : "Lovable Gateway";
      return {
        engine: this.engine,
        ok: true,
        latencyMs,
        detail: `${MODEL_ID} reachable via ${via}`,
        checkedAt,
      };
    } catch (e: any) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: Date.now() - started,
        detail: `network: ${e?.message ?? "unknown"}`,
        checkedAt,
      };
    }
  }

  async complete(req: LlmRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Gemini not configured (GEMINI_API_KEY missing)");
    }
    const resp = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: MODEL_ID,
        messages: req.messages,
        max_completion_tokens: req.maxTokens ?? 800,
        temperature: req.temperature ?? 0.4,
        stream: false,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Gemini HTTP ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  }

  async *streamComplete(req: LlmRequest): AsyncIterable<LlmStreamChunk> {
    if (!this.isConfigured()) {
      yield { type: "error", message: "Gemini not configured (GEMINI_API_KEY missing)" };
      return;
    }
    let resp: Response;
    try {
      resp = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: MODEL_ID,
          messages: req.messages,
          max_completion_tokens: req.maxTokens ?? 1200,
          temperature: req.temperature ?? 0.4,
          stream: true,
        }),
      });
    } catch (e: any) {
      yield { type: "error", message: `network: ${e?.message ?? "unknown"}` };
      return;
    }
    if (!resp.ok || !resp.body) {
      const detail = await resp.text().catch(() => "");
      yield { type: "error", message: `HTTP ${resp.status}: ${detail.slice(0, 200)}` };
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            yield { type: "done", finishReason: "stop" };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
            const finish: string | undefined = parsed.choices?.[0]?.finish_reason;
            if (delta) yield { type: "delta", text: delta };
            if (finish && finish !== "null") {
              yield { type: "done", finishReason: finish };
              return;
            }
          } catch {
            // Partial frame: push the line back and break to read more.
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      yield { type: "done" };
    } finally {
      reader.releaseLock?.();
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}
