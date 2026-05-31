/**
 * Communication & SaaS connectors that surface subscriptions or invoice
 * intent: Gmail / Outlook (invoice email parsing), Slack / Teams (approval
 * notifications + alerts), generic SaaS subscription tracking.
 *
 * For the demo these return canonical subscription rows representing the
 * SaaS stack a typical SaaS company runs on.
 */
import type {
  Connector,
  CanonicalInflow,
  CanonicalOutflow,
  CanonicalSubscription,
  CanonicalBankBalance,
} from "./types";
import { toUsd } from "./types";

// Shared subscription stack for the demo company
const STACK: CanonicalSubscription[] = [
  {
    id: "sub_slack",
    source: "slack",
    vendor: "Slack Enterprise",
    monthlyCost: 1200,
    annualCost: 14_400,
    currency: "USD",
    monthlyCostUsd: 1200,
    annualCostUsd: 14_400,
    renewsIn: 8,
    cancelWindowClosesIn: 2,
    essential: false,
    notes: "Mostly duplicates Teams — review usage",
  },
  {
    id: "sub_teams",
    source: "teams",
    vendor: "Microsoft Teams + 365",
    monthlyCost: 950,
    annualCost: 11_400,
    currency: "USD",
    monthlyCostUsd: 950,
    annualCostUsd: 11_400,
    renewsIn: 92,
    cancelWindowClosesIn: 30,
    essential: true,
  },
  {
    id: "sub_aws",
    source: "outlook",
    vendor: "AWS Reserved Instances",
    monthlyCost: 3170,
    annualCost: 38_000,
    currency: "USD",
    monthlyCostUsd: 3170,
    annualCostUsd: 38_000,
    renewsIn: 42,
    cancelWindowClosesIn: 12,
    essential: true,
    notes: "+12% escalation effective July 1",
  },
  {
    id: "sub_notion",
    source: "gmail",
    vendor: "Notion Team Plan",
    monthlyCost: 240,
    annualCost: 2880,
    currency: "USD",
    monthlyCostUsd: 240,
    annualCostUsd: 2880,
    renewsIn: 19,
    cancelWindowClosesIn: 5,
    essential: false,
  },
  {
    id: "sub_datadog",
    source: "outlook",
    vendor: "Datadog Pro",
    monthlyCost: 800,
    annualCost: 9600,
    currency: "USD",
    monthlyCostUsd: 800,
    annualCostUsd: 9600,
    renewsIn: 60,
    cancelWindowClosesIn: 30,
    essential: true,
  },
  {
    id: "sub_linear",
    source: "gmail",
    vendor: "Linear",
    monthlyCost: 120,
    annualCost: 1440,
    currency: "USD",
    monthlyCostUsd: 120,
    annualCostUsd: 1440,
    renewsIn: 90,
    cancelWindowClosesIn: 60,
    essential: true,
  },
];

class CommsConnectorBase {
  protected readonly subset: CanonicalSubscription[];
  constructor(subset: CanonicalSubscription[]) {
    this.subset = subset;
  }
  async sync() {
    return {
      inflows: [] as CanonicalInflow[],
      outflows: [] as CanonicalOutflow[],
      subscriptions: this.subset,
      banks: [] as CanonicalBankBalance[],
    };
  }
}

export class GmailConnector extends CommsConnectorBase implements Connector {
  readonly id = "gmail" as const;
  readonly displayName = "Gmail";
  readonly category = "email" as const;
  readonly icon = "✉️";
  readonly description = "Inbox parsing for invoices, renewals, vendor emails.";
  readonly regions = ["US", "IN", "Global"] as const;
  constructor() {
    super(STACK.filter((s) => s.source === "gmail"));
  }
  isReal() {
    return false;
  }
  isConfigured() {
    return Boolean(process.env.GMAIL_TOKEN);
  }
}

export class OutlookConnector extends CommsConnectorBase implements Connector {
  readonly id = "outlook" as const;
  readonly displayName = "Outlook";
  readonly category = "email" as const;
  readonly icon = "📧";
  readonly description = "Microsoft 365 inbox + calendar invoice signals.";
  readonly regions = ["US", "IN", "Global"] as const;
  constructor() {
    super(STACK.filter((s) => s.source === "outlook"));
  }
  isReal() {
    return false;
  }
  isConfigured() {
    return Boolean(process.env.OUTLOOK_TOKEN);
  }
}

export class SlackConnector extends CommsConnectorBase implements Connector {
  readonly id = "slack" as const;
  readonly displayName = "Slack";
  readonly category = "comms" as const;
  readonly icon = "💬";
  readonly description = "Approvals + alerts pushed to your finance channel.";
  readonly regions = ["US", "IN", "Global"] as const;
  constructor() {
    super(STACK.filter((s) => s.source === "slack"));
  }
  isReal() {
    return false;
  }
  isConfigured() {
    return Boolean(process.env.SLACK_BOT_TOKEN);
  }
}

export class TeamsConnector extends CommsConnectorBase implements Connector {
  readonly id = "teams" as const;
  readonly displayName = "Microsoft Teams";
  readonly category = "comms" as const;
  readonly icon = "🟪";
  readonly description = "Enterprise approval channels, Loop component pings.";
  readonly regions = ["US", "IN", "Global"] as const;
  constructor() {
    super(STACK.filter((s) => s.source === "teams"));
  }
  isReal() {
    return false;
  }
  isConfigured() {
    return Boolean(process.env.TEAMS_TOKEN);
  }
}
