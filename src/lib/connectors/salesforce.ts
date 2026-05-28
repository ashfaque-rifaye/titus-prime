/**
 * Salesforce connector — CRM-driven AR enrichment.
 *
 * Pulls account-level health, deal pipeline, and customer payment history.
 * Used by Collection agent to weight tone (don't be aggressive with a $400k
 * pipeline customer who's 3 days late).
 */
import type {
  Connector,
  CanonicalInflow,
  CanonicalOutflow,
  CanonicalSubscription,
  CanonicalBankBalance,
} from "./types";
import { toUsd } from "./types";

export class SalesforceConnector implements Connector {
  readonly id = "salesforce" as const;
  readonly displayName = "Salesforce";
  readonly category = "crm" as const;
  readonly icon = "☁️";
  readonly description = "Account health, pipeline, customer relationship signals.";
  readonly regions = ["US", "IN", "Global"] as const;

  isReal(): boolean {
    return false;
  }
  isConfigured(): boolean {
    return Boolean(process.env.SALESFORCE_TOKEN);
  }

  async sync() {
    // Salesforce contributes large enterprise invoices that aren't billed
    // through Stripe — typically wire-transfer customers.
    const inflows: CanonicalInflow[] = [
      {
        id: "sfdc_inv_E0042",
        source: "salesforce",
        kind: "invoice",
        customer: "Quanta Industries (Enterprise)",
        amount: 48_000,
        currency: "USD",
        amountUsd: 48_000,
        issuedAt: new Date(Date.now() - 38 * 86400_000).toISOString(),
        dueAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
        daysLate: 8,
        status: "late",
        meta: { sfdc_account_health: "green", sfdc_arr: 480_000 },
      },
      {
        id: "sfdc_inv_in_7710",
        source: "salesforce",
        kind: "invoice",
        customer: "Reliance Digital Cloud",
        amount: 12_50_000,
        currency: "INR",
        amountUsd: toUsd(12_50_000, "INR"),
        issuedAt: new Date(Date.now() - 31 * 86400_000).toISOString(),
        dueAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
        daysLate: 1,
        status: "late",
        meta: { sfdc_account_health: "amber", sfdc_arr: 1_50_00_000 },
      },
    ];
    return {
      inflows,
      outflows: [] as CanonicalOutflow[],
      subscriptions: [] as CanonicalSubscription[],
      banks: [] as CanonicalBankBalance[],
    };
  }
}
