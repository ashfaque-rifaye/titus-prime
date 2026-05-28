/**
 * OpenAI Codex provider — fallback engine.
 *
 * Production-ready implementation. Activates the moment `CODEX_API_KEY` is set
 * in the environment. Until then `isConfigured()` returns false and the dual-engine
 * router falls back to Gemini automatically.
 *
 * Talks directly to the OpenAI Chat Completions API at api.openai.com.
 * Default model is set via `CODEX_MODEL` env var (default: gpt-4.1-mini, which is
 * the supported alias for code generation in late-2026 production).
 */
import type {
  LlmHealth,
  LlmProvider,
  LlmRequest,
  LlmStreamChunk,
} from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class CodexProvider implements LlmProvider {
  readonly engine = "codex" as const;

  private get apiKey(): string | undefined {
    // Honor explicit Codex key first; fall back to standard OPENAI_API_KEY.
    return process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY;
  }

  private get model(): string {
    return process.env.CODEX_MODEL ?? "gpt-4.1-mini";
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
        detail: "CODEX_API_KEY missing — provider in stub mode (code is ready).",
        checkedAt,
      };
    }
    const started = Date.now();
    try {
      const resp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
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
        detail: `${this.model} reachable via OpenAI`,
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
      throw new Error("Codex not configured (CODEX_API_KEY missing)");
    }
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 800,
        temperature: req.temperature ?? 0.3,
        stream: false,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Codex HTTP ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  }

  async *streamComplete(req: LlmRequest): AsyncIterable<LlmStreamChunk> {
    if (!this.isConfigured()) {
      yield {
        type: "error",
        message: "Codex not configured (CODEX_API_KEY missing) — falling back to Gemini.",
      };
      return;
    }

    let resp: Response;
    try {
      resp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 1200,
          temperature: req.temperature ?? 0.3,
          stream: true,
          stream_options: { include_usage: true },
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
            if (finish) yield { type: "done", finishReason: finish };
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
