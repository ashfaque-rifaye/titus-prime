/**
 * Scenario Modeler
 *
 * Triggered by the orchestrator when Treasury Sentinel reports a crunch.
 * Calls Codex Prime to generate a constraint-optimization skill, then computes
 * three ranked survival plans against the actual data.
 */
import { bus } from "../event-bus";
import { runSkill } from "./codex-prime";
import { INVOICES, SUBSCRIPTIONS, VENDORS } from "../../mock-data";
import type { ProposedAction } from "../types";

export type ScenarioPlan = {
  name: string;
  successPct: number;
  collectIds: string[];
  pauseIds: string[];
  delayIds: string[];
  bufferGain: number;
  rationale: string;
};

export type ScenarioFinding = {
  plans: ScenarioPlan[];
  shortfall: number;
  skillRef: { agent: string; name: string; version: number };
};

export async function runScenario(args: {
  runId: string;
  mode: "stream" | "template";
  shortfall: number;
}): Promise<ScenarioFinding> {
  const { runId, mode, shortfall } = args;

  bus.emit({
    kind: "agent.thought",
    runId,
    ts: Date.now(),
    agent: "scenario",
    severity: "info",
    text: `Modeling 3 survival plans for a $${shortfall.toLocaleString()} shortfall.`,
  });

  const codex = await runSkill({
    runId,
    from: "scenario",
    skillKey: "optimize_survival",
    intent: "Mixed-integer optimization to rank 3 cash-crunch survival plans.",
    mode,
  });

  // Real plan computation against the mock dataset. Plans are deterministic
  // given the data, so the demo replays consistently.
  const sortedInvoices = [...INVOICES].sort((a, b) => b.amount - a.amount);
  const pausable = SUBSCRIPTIONS.filter((s) => !s.essential);
  const cheapestVendor = [...VENDORS].sort((a, b) => a.amount - b.amount)[0];

  const planA: ScenarioPlan = {
    name: "Plan A · Aggressive collect + pause",
    successPct: 92,
    collectIds: sortedInvoices.slice(0, 4).map((i) => i.id),
    pauseIds: pausable.slice(0, 2).map((s) => s.id),
    delayIds: [],
    bufferGain:
      sortedInvoices.slice(0, 4).reduce((s, i) => s + i.amount * 0.85, 0) +
      pausable.slice(0, 2).reduce((s, x) => s + x.monthlyCost, 0),
    rationale: "Maximizes recoverable cash under high success probability.",
  };
  const planB: ScenarioPlan = {
    name: "Plan B · Vendor delay",
    successPct: 85,
    collectIds: sortedInvoices.slice(0, 2).map((i) => i.id),
    pauseIds: [],
    delayIds: cheapestVendor ? [cheapestVendor.id] : [],
    bufferGain:
      sortedInvoices.slice(0, 2).reduce((s, i) => s + i.amount * 0.85, 0) +
      (cheapestVendor?.amount ?? 0),
    rationale: "Buys time without irritating customers.",
  };
  const planC: ScenarioPlan = {
    name: "Plan C · Bridge line",
    successPct: 78,
    collectIds: sortedInvoices.slice(0, 1).map((i) => i.id),
    pauseIds: [],
    delayIds: [],
    bufferGain: sortedInvoices.slice(0, 1).reduce((s, i) => s + i.amount * 0.85, 0) + 10_000,
    rationale: "Smallest behavioral change but draws on credit.",
  };

  const plans = [planA, planB, planC].map((p) => ({
    ...p,
    bufferGain: Math.round(p.bufferGain),
  }));

  bus.emit({
    kind: "agent.finding",
    runId,
    ts: Date.now(),
    agent: "scenario",
    severity: "info",
    title: `${plans.length} survival plans ranked`,
    detail: plans
      .map((p) => `${p.name} (${p.successPct}% · +$${p.bufferGain.toLocaleString()})`)
      .join(" · "),
    data: { plans },
  });

  return {
    plans,
    shortfall,
    skillRef: { agent: codex.skill.agent, name: codex.skill.name, version: codex.skill.version },
  };
}

export function buildScenarioActions(finding: ScenarioFinding): ProposedAction[] {
  return finding.plans.map<ProposedAction>((p) => ({
    agent: "scenario",
    type: "execute_plan",
    title: `Execute ${p.name}`,
    body: `Buffer gain ≈ $${p.bufferGain.toLocaleString()} · success ${p.successPct}%`,
    amountUsd: p.bufferGain,
    metadata: { plan: p },
  }));
}
