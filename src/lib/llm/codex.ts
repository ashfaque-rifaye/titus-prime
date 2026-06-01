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
/** OpenAI-compatible runtime endpoint used only for non-OpenAI runtime keys. */
const RUNTIME_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const RUNTIME_MODEL = "gemini-2.5-flash";

type Transport = "openai" | "runtime" | "none";

export class CodexProvider implements LlmProvider {
  readonly engine = "codex" as const;

  /** Native OpenAI Codex key, if explicitly set. */
  private get openaiKey(): string | undefined {
    return process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || undefined;
  }

  /** Runtime credential (keeps Codex live). May itself be an OpenAI sk- key. */
  private get runtimeKey(): string | undefined {
    return (
      process.env.CODEX_RUNTIME_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      undefined
    );
  }

  /** The credential we'll actually use, native key first. */
  private get resolvedKey(): string | undefined {
    return this.openaiKey || this.runtimeKey;
  }

  /** OpenAI keys start with "sk-"; anything else is the compatible runtime. */
  private get transport(): Transport {
    const k = this.resolvedKey;
    if (!k) return "none";
    return k.startsWith("sk-") ? "openai" : "runtime";
  }

  private get url(): string {
    return this.transport === "openai" ? OPENAI_URL : RUNTIME_URL;
  }

  private get apiKey(): string | undefined {
    return this.resolvedKey;
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

  /**
   * Credit-free health. Reports the engine status from configuration only —
   * it does NOT call the API, so the 30s auto-poll never spends a credit.
   * A real network ping is exposed separately via `ping()` (manual trigger).
   */
  async health(): Promise<LlmHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: 0,
        detail: "Codex offline — no runtime key configured.",
        checkedAt,
      };
    }
    return {
      engine: this.engine,
      ok: true,
      latencyMs: 0,
      detail: "Codex engine configured and operational.",
      checkedAt,
    };
  }

  /**
   * REAL connectivity check — spends ~1 token. Only call on an explicit user
   * action (the manual "Ping" button), never on a timer.
   */
  async ping(): Promise<LlmHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: 0,
        detail: "Codex offline — no runtime key configured.",
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
          detail: `Codex ping failed · HTTP ${resp.status}: ${body.slice(0, 120)}`,
          checkedAt,
        };
      }
      return {
        engine: this.engine,
        ok: true,
        latencyMs,
        detail: "Codex responded — engine live.",
        checkedAt,
      };
    } catch (e: any) {
      return {
        engine: this.engine,
        ok: false,
        latencyMs: Date.now() - started,
        detail: `Codex ping network error: ${e?.message ?? "unknown"}`,
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
