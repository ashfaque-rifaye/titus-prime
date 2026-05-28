/**
 * Multi-agent type system.
 *
 * Agents communicate exclusively through `AgentEvent`s on a typed pub/sub bus.
 * Every event carries a `runId` (one orchestrator run = one demo trace) and a
 * timestamp so the UI can replay the conversation as a transcript.
 */

export type AgentId =
  | "orchestrator"
  | "treasury"
  | "collection"
  | "subscription"
  | "tax"
  | "scenario"
  | "codex";

export type Severity = "info" | "warn" | "alert" | "success";

/** Every distinct event the system can emit. Discriminated by `kind`. */
export type AgentEvent =
  | { kind: "run.started"; runId: string; ts: number; intent: string }
  | { kind: "run.completed"; runId: string; ts: number; summary: string }
  | { kind: "run.failed"; runId: string; ts: number; error: string }
  | {
      kind: "agent.thought";
      runId: string;
      ts: number;
      agent: AgentId;
      severity: Severity;
      text: string;
    }
  | {
      kind: "agent.message";
      runId: string;
      ts: number;
      from: AgentId;
      to: AgentId | "broadcast";
      subject: string;
      payload: unknown;
    }
  | {
      kind: "agent.finding";
      runId: string;
      ts: number;
      agent: AgentId;
      severity: Severity;
      title: string;
      detail: string;
      data?: Record<string, unknown>;
    }
  | {
      kind: "codex.skill_request";
      runId: string;
      ts: number;
      from: AgentId;
      intent: string;
      skillKey: string;
    }
  | {
      kind: "codex.token";
      runId: string;
      ts: number;
      skillKey: string;
      delta: string;
    }
  | {
      kind: "codex.skill_committed";
      runId: string;
      ts: number;
      from: AgentId;
      skillKey: string;
      version: number;
      durationMs: number;
      outputSummary: string;
      engine: string;
    }
  | {
      kind: "policy.decision";
      runId: string;
      ts: number;
      action: string;
      ruleHit: string;
      decision: "auto" | "queue";
    }
  | {
      kind: "approval.queued";
      runId: string;
      ts: number;
      agent: AgentId;
      title: string;
      body: string;
    };

export type EventListener = (e: AgentEvent) => void | Promise<void>;

/** Action a specialist agent might take, then evaluated by the Policy Envelope. */
export type ProposedAction = {
  agent: AgentId;
  type:
    | "send_email"
    | "pay_vendor"
    | "cancel_subscription"
    | "pause_subscription"
    | "file_tax_return"
    | "delay_payment"
    | "execute_plan";
  title: string;
  body?: string;
  amountUsd?: number;
  metadata?: Record<string, unknown>;
};
