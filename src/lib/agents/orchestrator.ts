/**
 * Orchestrator — the "LangGraph state machine" of Titus-Prime.
 *
 * Coordinates the five specialist agents through the shared event bus:
 *   1) Treasury runs first (it's the trigger source)
 *   2) If Treasury escalates a crunch:
 *      - Collection runs in CRISIS mode (priority chase)
 *      - Subscription runs in CRISIS mode (surface pausable)
 *      - Scenario runs against the shortfall
 *   3) Tax runs in parallel (state-revenue scan is independent)
 *   4) All proposed actions are filtered through the Policy Envelope:
 *      - inside envelope  → marked auto (logged, "executed")
 *      - outside envelope → row inserted into `approvals`
 *
 * Every step emits typed events so the UI can render a live transcript.
 */
import { bus } from "./event-bus";
import { evaluate, loadPolicy } from "./policy";
import type { ProposedAction } from "./types";
import { runTreasury, buildTreasuryActions } from "./specialist/treasury";
import { runCollection, buildCollectionActions } from "./specialist/collection";
import { runSubscription, buildSubscriptionActions } from "./specialist/subscription";
import { runTax, buildTaxActions } from "./specialist/tax";
import { runScenario, buildScenarioActions } from "./specialist/scenario";
import { supabaseAdmin } from "../supabase-admin.server";
import { recordValueOnce, type ValueCategory } from "../value/ledger.server";
import { recordOutcome } from "../value/outcomes.server";

/** Map an action type to a value category + estimated manual minutes it replaces. */
function valueForAction(a: ProposedAction): { category: ValueCategory; minutes: number } | null {
  switch (a.type) {
    case "execute_plan":
      return { category: "protected", minutes: 90 }; // survival plan = hours of CFO firefighting
    case "send_email":
      return { category: "recovered", minutes: 12 }; // each chased invoice
    case "cancel_subscription":
    case "pause_subscription":
      return { category: "saved", minutes: 20 };
    case "pay_vendor":
      return { category: "saved", minutes: 10 }; // early-pay discount captured
    case "file_tax_return":
      return { category: "protected", minutes: 120 }; // avoided penalty + manual filing
    case "delay_payment":
      return { category: "protected", minutes: 15 };
    default:
      return null;
  }
}

export type RunMode = "stream" | "template";
export type RunOptions = { mode?: RunMode; intent?: string };

export type RunSummary = {
  runId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  agentsExecuted: string[];
  proposedActions: number;
  autoExecuted: number;
  queuedForApproval: number;
};

export function newRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runOrchestrator(opts: RunOptions = {}): Promise<RunSummary> {
  const runId = newRunId();
  const mode: RunMode = opts.mode ?? "template";
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  bus.emit({
    kind: "run.started",
    runId,
    ts: t0,
    intent: opts.intent ?? "Daily autonomous sweep",
  });

  const agentsExecuted: string[] = [];
  const allActions: ProposedAction[] = [];

  try {
    // Step 1: Treasury — always first.
    bus.emit({
      kind: "agent.thought",
      runId,
      ts: Date.now(),
      agent: "orchestrator",
      severity: "info",
      text: "Dispatching Treasury Sentinel.",
    });
    const treasury = await runTreasury({ runId, mode });
    agentsExecuted.push("treasury");
    allActions.push(...buildTreasuryActions(treasury));

    const crisisMode = !!treasury.crunch;
    const shortfall = treasury.crunch?.shortfallVsFloor ?? 0;

    if (crisisMode) {
      bus.emit({
        kind: "agent.message",
        runId,
        ts: Date.now(),
        from: "orchestrator",
        to: "broadcast",
        subject: "ORCHESTRATOR: enter crisis mode",
        payload: { shortfall, day: treasury.crunch?.day },
      });
    }

    // Step 2: Collection + Subscription + Tax + Scenario run in parallel.
    // (Scenario only triggers in crisis mode.)
    const tasks: Promise<unknown>[] = [];

    tasks.push(
      runCollection({ runId, mode, crisisMode, shortfall }).then((f) => {
        agentsExecuted.push("collection");
        allActions.push(...buildCollectionActions(f));
      }),
    );
    tasks.push(
      runSubscription({ runId, mode, crisisMode }).then((f) => {
        agentsExecuted.push("subscription");
        allActions.push(...buildSubscriptionActions(f));
      }),
    );
    tasks.push(
      runTax({ runId, mode }).then((f) => {
        agentsExecuted.push("tax");
        allActions.push(...buildTaxActions(f));
      }),
    );

    if (crisisMode) {
      tasks.push(
        runScenario({ runId, mode, shortfall }).then((f) => {
          agentsExecuted.push("scenario");
          allActions.push(...buildScenarioActions(f));
        }),
      );
    }

    await Promise.all(tasks);

    // Step 3: Policy Envelope — every action gets evaluated.
    bus.emit({
      kind: "agent.thought",
      runId,
      ts: Date.now(),
      agent: "orchestrator",
      severity: "info",
      text: `Evaluating ${allActions.length} proposed actions against the policy envelope.`,
    });
    const policy = await loadPolicy();
    let auto = 0;
    let queued = 0;

    for (const action of allActions) {
      const decision = evaluate(action, policy);
      bus.emit({
        kind: "policy.decision",
        runId,
        ts: Date.now(),
        action: action.title,
        ruleHit: decision.ruleHit,
        decision: decision.decision,
      });

      // Record the projected value this action represents (de-duped by ref+label).
      const v = valueForAction(action);
      if (v) {
        await recordValueOnce({
          agent: action.agent,
          category: v.category,
          amountUsd: action.amountUsd ?? 0,
          minutesSaved: v.minutes,
          label: action.title,
          runId,
          status: "projected",
          ref:
            (action.metadata?.invoiceId as string) ??
            (action.metadata?.subId as string) ??
            action.title,
        });
      }

      // Outcome tracking — collection emails get a pending outcome so the
      // recovery-rate loop is grounded in real sends, not just projections.
      if (action.type === "send_email") {
        const ref = (action.metadata?.invoiceId as string) ?? action.title;
        recordOutcome({
          kind: "collection_reminder",
          ref,
          label: action.title,
          amountUsd: action.amountUsd ?? 0,
        });
      }

      if (decision.decision === "auto") {
        auto++;
      } else {
        queued++;
        await supabaseAdmin.from("approvals").insert({
          agent: action.agent,
          title: action.title,
          body: action.body ?? null,
          payload: { ...(action.metadata ?? {}), runId, type: action.type },
          status: "pending",
        });
        bus.emit({
          kind: "approval.queued",
          runId,
          ts: Date.now(),
          agent: action.agent,
          title: action.title,
          body: action.body ?? "",
        });
      }
    }

    const endedAt = new Date().toISOString();
    const summary: RunSummary = {
      runId,
      startedAt,
      endedAt,
      durationMs: Date.now() - t0,
      agentsExecuted,
      proposedActions: allActions.length,
      autoExecuted: auto,
      queuedForApproval: queued,
    };

    bus.emit({
      kind: "run.completed",
      runId,
      ts: Date.now(),
      summary: `${agentsExecuted.length} agents · ${allActions.length} proposed · ${auto} auto · ${queued} queued`,
    });

    return summary;
  } catch (e: any) {
    bus.emit({
      kind: "run.failed",
      runId,
      ts: Date.now(),
      error: e?.message ?? "unknown error",
    });
    throw e;
  }
}
