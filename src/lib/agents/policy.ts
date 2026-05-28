/**
 * Policy Envelope evaluator.
 *
 * The envelope is the trust boundary. When a specialist agent proposes an
 * action, the orchestrator asks `evaluate()` whether the action falls inside
 * the envelope (auto-execute) or outside (queue for human approval).
 *
 * The envelope itself is sourced from the `policies` Supabase row written by
 * the /policy page. We parse the YAML-ish key/value document defensively so a
 * partial or malformed policy still produces a safe, conservative decision.
 */
import { supabaseAdmin } from "../supabase-admin.server";
import type { ProposedAction } from "./types";

export type PolicyState = {
  approve_email_above_usd: number;
  approve_payment_above_usd: number;
  approve_subscription_change: boolean;
  approve_tax_filing: boolean;
  pause_all: boolean;
  raw: string;
  loadedAt: string;
};

const DEFAULT_POLICY: Omit<PolicyState, "raw" | "loadedAt"> = {
  approve_email_above_usd: 1000,
  approve_payment_above_usd: 500,
  approve_subscription_change: true,
  approve_tax_filing: true,
  pause_all: false,
};

function parse(yamlish: string): Omit<PolicyState, "raw" | "loadedAt"> {
  const out: any = { ...DEFAULT_POLICY };
  for (const rawLine of yamlish.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (!(key in out)) continue;
    if (val === "true" || val === "false") out[key] = val === "true";
    else if (!isNaN(Number(val))) out[key] = Number(val);
  }
  return out;
}

export async function loadPolicy(): Promise<PolicyState> {
  const { data } = await supabaseAdmin
    .from("policies")
    .select("yaml_content, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const raw = data?.yaml_content ?? "";
  return {
    ...parse(raw),
    raw,
    loadedAt: new Date().toISOString(),
  };
}

export type PolicyDecision = {
  decision: "auto" | "queue";
  ruleHit: string;
};

/**
 * Apply the envelope. Conservative defaults: when in doubt, queue.
 * Tax filings, subscription changes, and any action above the configured caps
 * always queue. Otherwise low-risk actions auto-act.
 */
export function evaluate(action: ProposedAction, policy: PolicyState): PolicyDecision {
  if (policy.pause_all) {
    return { decision: "queue", ruleHit: "pause_all engaged → all autonomous action paused" };
  }

  switch (action.type) {
    case "file_tax_return":
      if (policy.approve_tax_filing) {
        return { decision: "queue", ruleHit: "tax filings always require approval" };
      }
      return { decision: "auto", ruleHit: "tax auto-filing enabled by policy" };

    case "cancel_subscription":
    case "pause_subscription":
      if (policy.approve_subscription_change) {
        return {
          decision: "queue",
          ruleHit: `subscription ${action.type === "cancel_subscription" ? "cancellations" : "pauses"} require approval`,
        };
      }
      return { decision: "auto", ruleHit: "subscription auto-action enabled by policy" };

    case "send_email": {
      const amt = action.amountUsd ?? 0;
      if (amt > policy.approve_email_above_usd) {
        return {
          decision: "queue",
          ruleHit: `email ties to invoice $${amt.toLocaleString()} > $${policy.approve_email_above_usd.toLocaleString()} cap`,
        };
      }
      return {
        decision: "auto",
        ruleHit: `email within $${policy.approve_email_above_usd.toLocaleString()} cap`,
      };
    }

    case "pay_vendor":
    case "delay_payment": {
      const amt = action.amountUsd ?? 0;
      if (amt > policy.approve_payment_above_usd) {
        return {
          decision: "queue",
          ruleHit: `${action.type === "pay_vendor" ? "payment" : "delay"} of $${amt.toLocaleString()} > $${policy.approve_payment_above_usd.toLocaleString()} cap`,
        };
      }
      return {
        decision: "auto",
        ruleHit: `within $${policy.approve_payment_above_usd.toLocaleString()} cap`,
      };
    }

    case "execute_plan":
      // Multi-step survival plans are always escalated — by definition out of envelope.
      return { decision: "queue", ruleHit: "scenario plans are always out-of-envelope" };

    default:
      return { decision: "queue", ruleHit: "unknown action type → conservative queue" };
  }
}
