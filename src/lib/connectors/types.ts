/**
 * Connector type system.
 *
 * A Connector is a typed adapter that pulls financial data from an external
 * source (Stripe, Plaid, Salesforce, Gmail, etc.) and writes it to the
 * canonical store in a normalized shape. Every connector implements the same
 * interface so the orchestrator can sync them in parallel without caring about
 * the source.
 *
 * Currency support: USD (US) and INR (India) are first-class. Conversions
 * happen at ingest time using a simple FX table (deterministic for the demo).
 */

export type Currency = "USD" | "INR";

export type ConnectorId =
  | "stripe"
  | "plaid"
  | "salesforce"
  | "quickbooks"
  | "gmail"
  | "outlook"
  | "slack"
  | "teams"
  | "razorpay"
  | "tally"
  | "zoho"
  | "csv";

export type ConnectorCategory =
  | "payments"
  | "banking"
  | "crm"
  | "accounting"
  | "email"
  | "comms";

export type ConnectionStatus =
  | "disconnected"
  | "connected"
  | "syncing"
  | "error";

export type CanonicalInflow = {
  /** stable connector-prefixed id, e.g. "stripe_inv_1042" */
  id: string;
  source: ConnectorId;
  kind: "invoice" | "charge" | "deposit";
  customer: string;
  amount: number;
  currency: Currency;
  /** USD-equivalent, computed at ingest. Same value if currency=USD. */
  amountUsd: number;
  issuedAt: string;
  dueAt: string;
  daysLate: number;
  status: "current" | "late" | "very_late" | "paid";
  /** Free-form metadata returned by the source (e.g. Stripe charge_id, SFDC opp id) */
  meta?: Record<string, unknown>;
};

export type CanonicalOutflow = {
  id: string;
  source: ConnectorId;
  kind: "vendor_bill" | "subscription" | "payroll" | "tax" | "fee";
  vendor: string;
  amount: number;
  currency: Currency;
  amountUsd: number;
  dueAt: string;
  /** True when this is a recurring item (e.g. SaaS subscription). */
  recurring: boolean;
  meta?: Record<string, unknown>;
};

export type CanonicalSubscription = {
  id: string;
  source: ConnectorId;
  vendor: string;
  monthlyCost: number;
  annualCost: number;
  currency: Currency;
  monthlyCostUsd: number;
  annualCostUsd: number;
  renewsIn: number;
  cancelWindowClosesIn: number;
  essential: boolean;
  notes?: string;
};

export type CanonicalBankBalance = {
  source: ConnectorId;
  account: string;
  balance: number;
  currency: Currency;
  balanceUsd: number;
  asOf: string;
};

export type CanonicalSnapshot = {
  inflows: CanonicalInflow[];
  outflows: CanonicalOutflow[];
  subscriptions: CanonicalSubscription[];
  banks: CanonicalBankBalance[];
  /** Aggregate totals for fast UI rendering. All in USD. */
  totals: {
    cashUsd: number;
    arUsd: number;
    apUsd: number;
    monthlySubsUsd: number;
  };
};

export type SyncResult = {
  connector: ConnectorId;
  ok: boolean;
  durationMs: number;
  itemsIngested: number;
  detail: string;
  error?: string;
};

export interface Connector {
  readonly id: ConnectorId;
  readonly displayName: string;
  readonly category: ConnectorCategory;
  readonly icon: string;
  readonly description: string;
  /** Human-readable region badges, e.g. ["US", "IN"] */
  readonly regions: ("US" | "IN" | "EU" | "Global")[];
  /** Whether the connector is structurally ready (real sandbox vs. mocked) */
  isReal(): boolean;
  /** Returns true if credentials are present in env. */
  isConfigured(): boolean;
  /** Pull data from the source. Must be deterministic when isConfigured() is false. */
  sync(): Promise<{
    inflows: CanonicalInflow[];
    outflows: CanonicalOutflow[];
    subscriptions: CanonicalSubscription[];
    banks: CanonicalBankBalance[];
  }>;
}

/** Static FX rates for the demo. Production would pull from an FX provider. */
export const FX: Record<Currency, number> = {
  USD: 1,
  INR: 1 / 83.5, // 1 INR = ~0.012 USD (Nov 2024 reference)
};

export function toUsd(amount: number, currency: Currency): number {
  return Math.round(amount * FX[currency] * 100) / 100;
}

export function fromUsd(amountUsd: number, currency: Currency): number {
  return Math.round((amountUsd / FX[currency]) * 100) / 100;
}
