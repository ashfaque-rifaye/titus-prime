/**
 * LLM service — single engine: Codex.
 *
 * Codex ("Codex Prime") is the only AI engine in Titus-Prime. It writes the
 * Python every agent relies on and streams it into the Workshop pane. The
 * provider resolves its transport at call time (native OpenAI when a key is
 * present, an OpenAI-compatible runtime otherwise) but always presents as Codex.
 */
import { CodexProvider } from "./codex";
import type { LlmEngine, LlmHealth, LlmProvider, LlmRequest, LlmStreamChunk } from "./types";

export type { LlmEngine, LlmHealth, LlmStreamChunk, LlmRequest, LlmProvider };

const codex = new CodexProvider();

/** Pick the engine. There is only Codex. */
export function selectProvider(_preferred?: LlmEngine): {
  provider: LlmProvider;
  active: LlmEngine;
  reason: string;
} {
  return {
    provider: codex,
    active: "codex",
    reason: codex.isConfigured() ? "codex" : "unconfigured",
  };
}

/** Health check for the Codex engine — credit-free (no API call). */
export async function healthAll(): Promise<{
  primary: LlmEngine;
  fallback: LlmEngine;
  active: LlmEngine;
  results: LlmHealth[];
}> {
  const c = await codex.health();

  const lines = [
    "── Codex health (config-only, no API call) ────────────",
    `  Codex  ${c.ok ? "✓" : "✗"}  ${c.detail}`,
    `  Engine → codex`,
    "──────────────────────────────────────────────────────",
  ].join("\n");

  console.log(lines);

  return {
    primary: "codex",
    fallback: "codex",
    active: "codex",
    results: [c],
  };
}

/**
 * REAL Codex connectivity ping — spends ~1 token. Only invoked from the manual
 * "Ping" action in the header, never on a timer.
 */
export async function pingCodex(): Promise<{
  primary: LlmEngine;
  fallback: LlmEngine;
  active: LlmEngine;
  results: LlmHealth[];
}> {
  const c = await codex.ping();
  console.log(`── Codex ping (live) ──  ${c.ok ? "✓" : "✗"}  ${c.latencyMs}ms  ${c.detail}`);
  return { primary: "codex", fallback: "codex", active: "codex", results: [c] };
}

/** Stream from Codex. (No cascade — Codex is the only engine.) */
export async function* streamWithFallback(
  req: LlmRequest,
  _preferred?: LlmEngine,
): AsyncIterable<LlmStreamChunk & { engine: LlmEngine }> {
  for await (const chunk of codex.streamComplete(req)) {
    yield { ...chunk, engine: "codex" };
  }
}

export const llm = {
  codex,
  select: selectProvider,
  healthAll,
  pingCodex,
  streamWithFallback,
};
