/**
 * Treasury Sentinel
 *
 * Detects projected cash crunches against the safety floor. When a crunch is
 * found it commits a `cash_forecast` skill via Codex Prime, emits a finding,
 * and broadcasts an "escalate" message that other agents listen for.
 */
import { bus } from "../event-bus";
import type { AgentEvent, ProposedAction } from "../types";
import { runSkill } from "./codex-prime";
import { CASH_PROJECTION, SAFETY_FLOOR, BANK_BALANCE, PAYROLL } from "../../mock-data";

export type TreasuryFinding = {
  crunch: { day: number; balance: number; shortfallVsFloor: number } | null;
  openingBalance: number;
  payroll: { amount: number; day: number };
  skillRef: { agent: string; name: string; version: number };
};

export async function runTreasury(args: {
  runId: string;
  mode: "stream" | "template";
}): Promise<TreasuryFinding> {
  const { runId, mode } = args;

  bus.emit({
    kind: "agent.thought",
    runId,
    ts: Date.now(),
    agent: "treasury",
    severity: "info",
    text: "Inspecting bank balance, AR, AP, payroll, and recurring debits.",
  });

  const codex = await runSkill({
    runId,
    from: "treasury",
    skillKey: "cash_forecast",
    intent: "Project 30-day cash with payroll and recurring outflows; flag floor breach.",
    mode,
  });

  // Real computation against the projection.
  const breach = CASH_PROJECTION.find((p) => p.balance < SAFETY_FLOOR);
  const finding: TreasuryFinding = {
    crunch: breach
      ? {
          day: breach.day,
          balance: breach.balance,
          shortfallVsFloor: SAFETY_FLOOR - breach.balance,
        }
      : null,
    openingBalance: BANK_BALANCE,
    payroll: PAYROLL,
    skillRef: { agent: codex.skill.agent, name: codex.skill.name, version: codex.skill.version },
  };

  if (finding.crunch) {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "treasury",
      severity: "alert",
      title: `Cash crunch projected on Day ${finding.crunch.day}`,
      detail: `Projected balance ${money(finding.crunch.balance)} — ${money(finding.crunch.shortfallVsFloor)} below the ${money(SAFETY_FLOOR)} safety floor.`,
      data: { ...finding },
    } satisfies Extract<AgentEvent, { kind: "agent.finding" }>);

    // Cross-agent escalation. This is the actual message-passing the narrative
    // describes — every recipient subscribes to the bus and reacts.
    bus.emit({
      kind: "agent.message",
      runId,
      ts: Date.now(),
      from: "treasury",
      to: "broadcast",
      subject: "ESCALATE: cash_crunch_detected",
      payload: { day: finding.crunch.day, shortfall: finding.crunch.shortfallVsFloor },
    });
  } else {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "treasury",
      severity: "success",
      title: "No cash crunch projected within 30 days",
      detail: `Opening balance ${money(BANK_BALANCE)}; minimum projected day-balance stays above floor.`,
    });
  }

  return finding;
}

export function buildTreasuryActions(finding: TreasuryFinding): ProposedAction[] {
  if (!finding.crunch) return [];
  return [
    {
      agent: "treasury",
      type: "execute_plan",
      title: `Survival plan for Day ${finding.crunch.day} crunch`,
      body: `Resolve a ${money(finding.crunch.shortfallVsFloor)} shortfall vs. the safety floor.`,
      amountUsd: finding.crunch.shortfallVsFloor,
      metadata: { kind: "treasury.execute_plan" },
    },
  ];
}

function money(n: number): string {
  return `$${Math.abs(n).toLocaleString()}${n < 0 ? " (negative)" : ""}`;
}
