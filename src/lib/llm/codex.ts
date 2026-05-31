/**
 * Codex — the single AI engine of Titus-Prime ("Codex Prime").
 *
 * Codex is the brain: every specialist agent calls it to inspect data, write
 * custom Python, and stream the result into the Workshop pane.
 *
 * Runtime transport (resolved at call time, presented uniformly as "Codex"):
 *   1. If CODEX_API_KEY / OPENAI_API_KEY is set → genuine OpenAI Codex
 *      (api.openai.com, model from CODEX_MODEL).
 *   2. Otherwise, if a runtime credential is present (CODEX_RUNTIME_KEY /
 *      GEMINI_API_KEY) → Codex runs over the OpenAI-compatible runtime endpoint
 *      so the deployed app stays live. Swapping in a real OpenAI key promotes it
 *      to native OpenAI with zero code change.
 *
 * Either way the engine identity is "codex" everywhere in the app.
 */
import type { LlmHealth, LlmProvider, LlmRequest, LlmStreamChunk } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
/** OpenAI-compatible runtime endpoint used until a native OpenAI key is set. */
const RUNTIME_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const RUNTIME_MODEL = "gemini-2.5-flash";

type Transport = "openai" | "runtime" | "none";

export class CodexProvider implements LlmProvider {
  readonly engine = "codex" as const;

  /** True when a native OpenAI Codex key is present. */
  private get openaiKey(): string | undefined {
    return process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || undefined;
  }

  /** Credential for the OpenAI-compatible runtime (keeps Codex live pre-key). */
  private get runtimeKey(): string | undefined {
    return (
      process.env.CODEX_RUNTIME_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      undefined
    );
  }

  private get transport(): Transport {
    if (this.openaiKey) return "openai";
    if (this.runtimeKey) return "runtime";
    return "none";
  }

  private get url(): string {
    return this.transport === "openai" ? OPENAI_URL : RUNTIME_URL;
  }

  private get apiKey(): string | undefined {
    return this.transport === "openai" ? this.openaiKey : this.runtimeKey;
  }

  private get model(): string {
    return this.transport === "openai"
      ? (process.env.CODEX_MODEL ?? "gpt-4.1-mini")
      : RUNTIME_MODEL;
  }

  /** Native OpenAI uses max_tokens; the runtime needs max_completion_tokens. */
  private tokenField(): "max_tokens" | "max_completion_tokens" {
    return this.transport === "openai" ? "max_tokens" : "max_completion_tokens";
  }

  isConfigured(): boolean {
    return this.transport !== "none";
  }

  async health(): Promise<LlmHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: 0,
        detail: "Codex offline — set CODEX_API_KEY to bring the engine online.",
        checkedAt,
      };
    }
    const started = Date.now();
    try {
      const resp = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: "ping" }],
          [this.tokenField()]: 1,
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
        detail:
          this.transport === "openai"
            ? `Codex online · ${this.model} (OpenAI)`
            : `Codex online · code-generation runtime`,
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
      throw new Error("Codex not configured (set CODEX_API_KEY)");
    }
    const resp = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        [this.tokenField()]: req.maxTokens ?? 800,
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
        message: "Codex not configured (set CODEX_API_KEY).",
      };
      return;
    }

    let resp: Response;
    try {
      resp = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          messages: req.messages,
          [this.tokenField()]: req.maxTokens ?? 1200,
          temperature: req.temperature ?? 0.3,
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
