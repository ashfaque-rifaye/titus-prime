/**
 * Collection & Receivables Agent
 *
 * Triages overdue invoices, calls Codex Prime to (a) segment customers and (b)
 * draft tone-aware reminders, then proposes per-invoice actions sized to either
 * auto-send or queue based on the policy envelope.
 *
 * In "crisis mode" (when Treasury Sentinel has broadcast an escalate message)
 * the agent prioritizes the highest-recoverable invoices that resolve the
 * specific shortfall — instead of just walking the standard ladder.
 */
import { bus } from "../event-bus";
import { runSkill } from "./codex-prime";
import { INVOICES, type Invoice } from "../../mock-data";
import type { ProposedAction } from "../types";

export type CollectionFinding = {
  totalAr: number;
  prioritized: Invoice[];
  crisisMode: boolean;
  shortfall: number;
  skillRefs: Array<{ agent: string; name: string; version: number }>;
};

export async function runCollection(args: {
  runId: string;
  mode: "stream" | "template";
  crisisMode: boolean;
  shortfall: number;
}): Promise<CollectionFinding> {
  const { runId, mode, crisisMode, shortfall } = args;

  bus.emit({
    kind: "agent.thought",
    runId,
    ts: Date.now(),
    agent: "collection",
    severity: crisisMode ? "warn" : "info",
    text: crisisMode
      ? `Crisis mode armed — prioritizing invoices that resolve a ${money(shortfall)} shortfall.`
      : "Walking the standard 1/7/14/30-day reminder ladder.",
  });

  // Two Codex calls — one to segment, one to draft. Each becomes a real
  // versioned skill in the library.
  const seg = await runSkill({
    runId,
    from: "collection",
    skillKey: "segment_customers",
    intent:
      "Classify overdue customers as chronic-late vs. one-time delay; rank by recoverable cash.",
    mode,
  });
  const drafter = await runSkill({
    runId,
    from: "collection",
    skillKey: "draft_email",
    intent: "Generate tone-aware reminder bodies per invoice + customer relationship.",
    mode,
  });

  // Real prioritization logic.
  const prioritized = prioritize(INVOICES, { crisisMode, shortfall });
  const totalAr = INVOICES.reduce((s, i) => s + i.amount, 0);

  bus.emit({
    kind: "agent.finding",
    runId,
    ts: Date.now(),
    agent: "collection",
    severity: prioritized.length > 0 ? "warn" : "info",
    title: `${prioritized.length} overdue invoices · ${money(totalAr)} AR`,
    detail: crisisMode
      ? "Top-priority chases will recover the cash that resolves the projected crunch."
      : "Drafts queued; sub-$1k reminders will auto-send within policy.",
    data: { invoiceIds: prioritized.map((i) => i.id) },
  });

  return {
    totalAr,
    prioritized,
    crisisMode,
    shortfall,
    skillRefs: [
      { agent: seg.skill.agent, name: seg.skill.name, version: seg.skill.version },
      { agent: drafter.skill.agent, name: drafter.skill.name, version: drafter.skill.version },
    ],
  };
}

export function buildCollectionActions(finding: CollectionFinding): ProposedAction[] {
  return finding.prioritized.map<ProposedAction>((inv) => ({
    agent: "collection",
    type: "send_email",
    title: `Reminder · ${inv.customer} · INV ${inv.id}`,
    body: `${inv.daysLate} days late on ${money(inv.amount)}.`,
    amountUsd: inv.amount,
    metadata: { invoiceId: inv.id, daysLate: inv.daysLate },
  }));
}

function prioritize(inv: Invoice[], ctx: { crisisMode: boolean; shortfall: number }): Invoice[] {
  const sorted = [...inv].sort((a, b) => {
    if (ctx.crisisMode) {
      // Maximize recoverable amount first, then days late.
      if (b.amount !== a.amount) return b.amount - a.amount;
      return b.daysLate - a.daysLate;
    }
    // Standard ladder: most overdue first, then largest.
    if (b.daysLate !== a.daysLate) return b.daysLate - a.daysLate;
    return b.amount - a.amount;
  });

  if (!ctx.crisisMode) return sorted;

  // In crisis mode, take the smallest set whose amounts cover the shortfall.
  const out: Invoice[] = [];
  let acc = 0;
  for (const i of sorted) {
    out.push(i);
    acc += i.amount;
    if (acc >= ctx.shortfall) break;
  }
  return out.length ? out : sorted.slice(0, 3);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
