/**
 * Dual-engine LLM service — now a three-engine cascade.
 *
 * Priority order:
 *   1. Gemini 2.5 Flash  (primary — Google AI Studio direct)
 *   2. Groq / llama-3.3-70b-versatile  (fallback — fast, generous free tier)
 *   3. OpenAI Codex  (tertiary — activates when CODEX_API_KEY is set)
 *
 * The `selectProvider()` function picks the highest-priority configured engine.
 * `streamWithFallback()` tries the preferred engine and automatically cascades
 * to the next configured engine if the first fails before producing any output.
 *
 * Health check logs a clean ASCII block to the server console on every call.
 */
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { CodexProvider } from "./codex";
import type {
  LlmEngine,
  LlmHealth,
  LlmProvider,
  LlmRequest,
  LlmStreamChunk,
} from "./types";

export type { LlmEngine, LlmHealth, LlmStreamChunk, LlmRequest, LlmProvider };

const gemini = new GeminiProvider();
const groq = new GroqProvider();
const codex = new CodexProvider();

/** Ordered cascade: Gemini → Groq → Codex */
const CASCADE: LlmProvider[] = [gemini, groq, codex];

const PROVIDERS: Record<LlmEngine, LlmProvider> = {
  gemini,
  groq,
  codex,
};

/**
 * Pick the best available provider.
 * - If `preferred` is configured, use it.
 * - Otherwise walk the cascade and return the first configured provider.
 */
export function selectProvider(preferred?: LlmEngine): {
  provider: LlmProvider;
  active: LlmEngine;
  reason: string;
} {
  if (preferred && PROVIDERS[preferred]?.isConfigured()) {
    return { provider: PROVIDERS[preferred], active: preferred, reason: "explicit" };
  }
  for (const p of CASCADE) {
    if (p.isConfigured()) {
      return { provider: p, active: p.engine as LlmEngine, reason: "cascade" };
    }
  }
  // Nothing configured — return Gemini so calls produce structured errors.
  return { provider: gemini, active: "gemini", reason: "unconfigured" };
}

/** Run a health check across all three providers in parallel. */
export async function healthAll(): Promise<{
  primary: LlmEngine;
  fallback: LlmEngine;
  active: LlmEngine;
  results: LlmHealth[];
}> {
  const [g, gr, c] = await Promise.all([gemini.health(), groq.health(), codex.health()]);
  const active = g.ok ? "gemini" : gr.ok ? "groq" : c.ok ? "codex" : "gemini";

  const lines = [
    "── LLM health check ──────────────────────────────────",
    `  Gemini  ${g.ok ? "✓" : "✗"}  ${g.latencyMs}ms  ${g.detail}`,
    `  Groq    ${gr.ok ? "✓" : "✗"}  ${gr.latencyMs}ms  ${gr.detail}`,
    `  Codex   ${c.ok ? "✓" : "✗"}  ${c.latencyMs}ms  ${c.detail}`,
    `  Active  → ${active}`,
    "──────────────────────────────────────────────────────",
  ].join("\n");
  // eslint-disable-next-line no-console
  console.log(lines);

  return {
    primary: "gemini",
    fallback: gr.ok ? "groq" : "codex",
    active: active as LlmEngine,
    results: [g, gr, c],
  };
}

/**
 * Stream from the selected engine with automatic cascade fallback.
 *
 * If the preferred engine fails before producing any output, the next
 * configured engine in the cascade is tried automatically. A brief
 * comment line is injected into the stream so the Workshop pane shows
 * which engine took over.
 */
export async function* streamWithFallback(
  req: LlmRequest,
  preferred?: LlmEngine,
): AsyncIterable<LlmStreamChunk & { engine: LlmEngine }> {
  const { provider: first, active: firstEngine } = selectProvider(preferred);
  let yieldedDelta = false;

  for await (const chunk of first.streamComplete(req)) {
    if (chunk.type === "delta") yieldedDelta = true;
    if (chunk.type === "error" && !yieldedDelta) {
      // Primary failed before producing output — cascade to next engine.
      const nextProvider = CASCADE.find(
        (p) => p.engine !== firstEngine && p.isConfigured(),
      );
      if (nextProvider) {
        const nextEngine = nextProvider.engine as LlmEngine;
        yield {
          type: "delta",
          text: `# engine fallback: ${firstEngine} → ${nextEngine}\n`,
          engine: nextEngine,
        };
        for await (const c2 of nextProvider.streamComplete(req)) {
          yield { ...c2, engine: nextEngine };
        }
        return;
      }
    }
    yield { ...chunk, engine: firstEngine };
  }
}

export const llm = {
  gemini,
  groq,
  codex,
  select: selectProvider,
  healthAll,
  streamWithFallback,
};
