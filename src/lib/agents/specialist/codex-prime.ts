/**
 * Codex Prime — the shared coding agent.
 *
 * When a specialist agent says "I need to compute X on the user's data," it calls
 * `runSkill()` here. Codex Prime:
 *   1) selects an LLM engine (Gemini default, Codex fallback when key present),
 *   2) streams Python token-by-token into the run's event log,
 *   3) commits the resulting source to the skill library (Supabase) with a bumped
 *      version number, an input hash, and a duration measurement,
 *   4) returns the skill reference so the caller can attach it to a finding.
 *
 * The same code path drives the Workshop pane's live token stream — the pane just
 * subscribes to `codex.token` events on the bus.
 */
import { selectProvider } from "../../llm";
import { SKILL_TEMPLATES, type SkillKey } from "../../skill-templates";
import { commitSkill, type SkillRow } from "../../skills-store.server";
import { bus } from "../event-bus";
import { getCustomization } from "../customizations";
import type { AgentId, AgentEvent } from "../types";

export type CodexResult = {
  skill: SkillRow;
  code: string;
  outputSummary: string;
  durationMs: number;
  engine: string;
};

const SYSTEM = `You are Codex Prime, the shared coding agent inside Titus-Prime — an
autonomous financial operations system. You are called by specialist agents
(Treasury Sentinel, Collection, Subscription Watchdog, Tax Compliance, Scenario
Modeler) to write Python that solves a specific problem on specific data.

Hard rules:
- Output ONLY a single Python file. No prose. No markdown fences.
- File header: a docstring with the calling agent, business reason, an input
  hash placeholder, and a UTC timestamp comment.
- Use pandas / numpy / scipy / pulp where useful. Type hints required.
- Add concise inline comments citing the financial reasoning (e.g. "TX Tax Code
  151.0101: SaaS taxable as data-processing service").
- End with an \`if __name__ == "__main__":\` block that prints a one-line human summary.
- 60-120 lines. Keep it tight.`.trim();

function userPromptFor(skillKey: SkillKey, intent: string, agent: AgentId, customization: string | null): string {
  const tpl = SKILL_TEMPLATES[skillKey];
  const lines = [
    `Calling agent: ${agent}`,
    `Intent: ${intent}`,
    `Skill name: ${tpl.agent}/${tpl.name}.py`,
    `Reference summary: ${tpl.summary}`,
    `Expected output one-liner: ${tpl.outputSummary}`,
  ];
  if (customization) {
    lines.push(
      "",
      "USER CUSTOMIZATION (must be respected in generated logic & tone):",
      customization,
    );
  }
  lines.push("", "Generate the Python skill now.");
  return lines.join("\n");
}

function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/**
 * Run a Codex Prime skill request end-to-end.
 *
 * @param runId   the orchestrator run id (used in event correlation)
 * @param from    which specialist agent is calling
 * @param skillKey  the canonical skill being requested
 * @param intent  human-readable reason
 * @param mode    "stream" hits the LLM, "template" replays the canonical file
 *                instantly. Both end with a real DB commit.
 */
export async function runSkill(args: {
  runId: string;
  from: AgentId;
  skillKey: SkillKey;
  intent: string;
  mode?: "stream" | "template";
}): Promise<CodexResult> {
  const { runId, from, skillKey, intent } = args;
  const mode = args.mode ?? "stream";
  const tpl = SKILL_TEMPLATES[skillKey];
  const started = Date.now();

  bus.emit({
    kind: "codex.skill_request",
    runId,
    ts: started,
    from,
    intent,
    skillKey,
  } satisfies Extract<AgentEvent, { kind: "codex.skill_request" }>);

  let code = "";
  let engineLabel = "template";

  if (mode === "template") {
    code = tpl.code;
    // Stream the canonical template so the Workshop pane animates uniformly.
    for (const chunk of chunkOf(code, 96)) {
      code = code; // (no-op, code already set)
      bus.emit({ kind: "codex.token", runId, ts: Date.now(), skillKey, delta: chunk });
      await sleep(8);
    }
  } else {
    const { provider, active } = selectProvider();
    engineLabel = active;
    const customization = await getCustomization(from);
    let yielded = 0;
    try {
      for await (const c of provider.streamComplete({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPromptFor(skillKey, intent, from, customization) },
        ],
        maxTokens: 1400,
        temperature: 0.3,
        trace: `codex.${from}.${skillKey}`,
      })) {
        if (c.type === "delta") {
          yielded++;
          code += c.text;
          bus.emit({ kind: "codex.token", runId, ts: Date.now(), skillKey, delta: c.text });
        } else if (c.type === "error") {
          // Fall back to canonical template if the LLM fails outright.
          if (yielded === 0) {
            code = tpl.code;
            engineLabel = `${active}→template-fallback`;
            for (const chunk of chunkOf(code, 96)) {
              bus.emit({ kind: "codex.token", runId, ts: Date.now(), skillKey, delta: chunk });
              await sleep(6);
            }
          }
          break;
        }
      }
    } catch (e: any) {
      // Defensive fallback — never let Codex Prime fail the run silently.
      code = tpl.code;
      engineLabel = `${active}→template-fallback`;
      for (const chunk of chunkOf(code, 96)) {
        bus.emit({ kind: "codex.token", runId, ts: Date.now(), skillKey, delta: chunk });
        await sleep(6);
      }
    }
  }

  // Strip code fences if the model accidentally added them.
  code = stripFences(code).trim();
  const durationMs = Date.now() - started;
  const inputHash = hashOf(`${from}:${skillKey}:${intent}:${tpl.code.length}`);

  const skill = await commitSkill({
    agent: tpl.agent,
    name: tpl.name,
    code,
    summary: tpl.summary,
    outputSummary: tpl.outputSummary,
    inputHash,
    durationMs,
  });

  bus.emit({
    kind: "codex.skill_committed",
    runId,
    ts: Date.now(),
    from,
    skillKey,
    version: skill.version,
    durationMs,
    outputSummary: tpl.outputSummary,
    engine: engineLabel,
  });

  return {
    skill,
    code,
    outputSummary: tpl.outputSummary,
    durationMs,
    engine: engineLabel,
  };
}

function chunkOf(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
function stripFences(s: string): string {
  const m = s.match(/^```(?:python|py)?\s*([\s\S]*?)```\s*$/);
  return m ? m[1] : s;
}
