/**
 * Tax Compliance Agent
 *
 * Monitors per-state revenue against economic-nexus thresholds. When a state
 * crosses, it asks Codex Prime to compute SaaS tax owed (with state-law citations
 * inline in the generated Python) and proposes a `file_tax_return` action — which
 * is always queued for human approval per the policy envelope.
 */
import { bus } from "../event-bus";
import { runSkill } from "./codex-prime";
import { STATE_REVENUE, type StateRevenue } from "../../mock-data";
import type { ProposedAction } from "../types";

export type TaxFinding = {
  crossings: StateRevenue[];
  totalOwed: number;
  skillRef: { agent: string; name: string; version: number };
};

export async function runTax(args: {
  runId: string;
  mode: "stream" | "template";
}): Promise<TaxFinding> {
  const { runId, mode } = args;

  bus.emit({
    kind: "agent.thought",
    runId,
    ts: Date.now(),
    agent: "tax",
    severity: "info",
    text: "Tallying per-state revenue against economic-nexus thresholds (CA, TX, NY, FL).",
  });

  const codex = await runSkill({
    runId,
    from: "tax",
    skillKey: "tx_saas_calc",
    intent: "Compute Texas SaaS sales tax with state-law citations inline.",
    mode,
  });

  const crossings = STATE_REVENUE.filter((s) => s.nexusCrossed);
  const totalOwed = crossings.reduce((s, r) => s + r.taxOwed, 0);

  if (crossings.length > 0) {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "tax",
      severity: "alert",
      title: `Nexus crossed in ${crossings.length} state${crossings.length === 1 ? "" : "s"}`,
      detail: crossings
        .map((s) => `${s.state}: $${s.revenueYTD.toLocaleString()} YTD · owes $${s.taxOwed.toFixed(2)}`)
        .join(" · "),
      data: { totalOwed, states: crossings.map((s) => s.state) },
    });
  } else {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "tax",
      severity: "success",
      title: "No new state nexus crossings this scan",
      detail: STATE_REVENUE.map(
        (s) => `${s.state}: $${s.revenueYTD.toLocaleString()} of ${s.threshold ? "$" + s.threshold.toLocaleString() : "N/A"}`,
      ).join(" · "),
    });
  }

  return {
    crossings,
    totalOwed,
    skillRef: { agent: codex.skill.agent, name: codex.skill.name, version: codex.skill.version },
  };
}

export function buildTaxActions(finding: TaxFinding): ProposedAction[] {
  return finding.crossings.map<ProposedAction>((s) => ({
    agent: "tax",
    type: "file_tax_return",
    title: `${s.state} sales-tax filing · $${s.taxOwed.toFixed(2)}`,
    body: `Pre-filled return ready. Click provenance to inspect the calculation script.`,
    amountUsd: s.taxOwed,
    metadata: { state: s.state },
  }));
}
