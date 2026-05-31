/**
 * Common types for the LLM service.
 * The single engine, Codex, implements the `LlmProvider` interface.
 */

export type LlmEngine = "codex";

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  /** Soft-cap on output tokens. Providers honor this when they can. */
  maxTokens?: number;
  /** 0 = deterministic, 1 = creative. */
  temperature?: number;
  /** Caller-supplied tag used for tracing & cost attribution. */
  trace?: string;
};

/** A single SSE-style chunk produced by `streamComplete`. */
export type LlmStreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; finishReason?: string }
  | { type: "error"; message: string };

export type LlmHealth = {
  engine: LlmEngine;
  ok: boolean;
  latencyMs: number;
  /** Free-form detail (model name, error, "stub mode", etc.) */
  detail: string;
  checkedAt: string;
};

export interface LlmProvider {
  readonly engine: LlmEngine;
  /** Returns true if the provider has the credentials it needs to operate. */
  isConfigured(): boolean;
  /** Lightweight ping. Should complete in < 5s with minimal token spend. */
  health(): Promise<LlmHealth>;
  /** Non-streaming completion. Useful for short structured calls. */
  complete(req: LlmRequest): Promise<string>;
  /** Streaming completion as an async iterable of typed chunks. */
  streamComplete(req: LlmRequest): AsyncIterable<LlmStreamChunk>;
}
