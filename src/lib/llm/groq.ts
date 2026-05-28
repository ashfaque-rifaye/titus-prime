/**
 * Groq provider — fallback engine.
 *
 * Groq's inference API is OpenAI-compatible, so the streaming frame format is
 * identical to what the Workshop pane already parses. Groq is extremely fast
 * (typically < 500ms to first token) which makes it an ideal fallback when
 * Gemini hits rate limits during parallel agent runs.
 *
 * Key:   GROQ_API_KEY
 * Model: GROQ_MODEL (default: llama-3.3-70b-versatile)
 *
 * Groq uses standard `max_tokens` (not `max_completion_tokens` like Gemini 2.5).
 */
import type {
  LlmHealth,
  LlmProvider,
  LlmRequest,
  LlmStreamChunk,
} from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqProvider implements LlmProvider {
  readonly engine = "groq" as const;

  private get apiKey(): string | undefined {
    return process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || undefined;
  }

  private get model(): string {
    return process.env.GROQ_MODEL || process.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile";
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
        detail: "GROQ_API_KEY missing — provider in stub mode.",
        checkedAt,
      };
    }
    const started = Date.now();
    try {
      const resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
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
      return {
        engine: this.engine,
        ok: true,
        latencyMs,
        detail: `${this.model} reachable via Groq`,
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
      throw new Error("Groq not configured (GROQ_API_KEY missing)");
    }
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 800,
        temperature: req.temperature ?? 0.4,
        stream: false,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Groq HTTP ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  }

  async *streamComplete(req: LlmRequest): AsyncIterable<LlmStreamChunk> {
    if (!this.isConfigured()) {
      yield { type: "error", message: "Groq not configured (GROQ_API_KEY missing)" };
      return;
    }
    let resp: Response;
    try {
      resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 1200,
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
