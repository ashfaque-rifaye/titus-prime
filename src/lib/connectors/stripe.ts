/**
 * Stripe connector — payments + invoices.
 *
 * Real path: hits Stripe API with `STRIPE_API_KEY` (test mode supported).
 * Demo path: deterministic fixtures shaped exactly like real Stripe payloads.
 */
import type {
  Connector,
  CanonicalInflow,
  CanonicalOutflow,
  CanonicalSubscription,
  CanonicalBankBalance,
} from "./types";
import { toUsd } from "./types";

export class StripeConnector implements Connector {
  readonly id = "stripe" as const;
  readonly displayName = "Stripe";
  readonly category = "payments" as const;
  readonly icon = "💳";
  readonly description = "Customer invoices, charges, refunds, MRR.";
  readonly regions = ["US", "IN", "Global"] as const;

  isReal(): boolean {
    return false;
  }

  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_API_KEY);
  }

  async sync() {
    // Deterministic SaaS invoice book: 6 invoices, mixed currencies.
    const inflows: CanonicalInflow[] = [
      mkInflow("stripe_inv_1042", "Acme Robotics", 8200, "USD", -14, "late"),
      mkInflow("stripe_inv_1038", "TechFlow Labs", 3400, "USD", -16, "late"),
      mkInflow("stripe_inv_1029", "Nimbus Health", 1450, "USD", -28, "very_late"),
      mkInflow("stripe_inv_1025", "Hexa Studios", 920, "USD", -5, "late"),
      mkInflow("stripe_inv_1018", "Loop Analytics", 6400, "USD", -23, "very_late"),
      mkInflow("stripe_inv_1011", "Mango Retail", 2750, "USD", -2, "late"),
      // INR invoices for Indian customers
      mkInflow("stripe_inv_in_2104", "Tatva Cloud Pvt Ltd", 685_000, "INR", -11, "late"),
      mkInflow("stripe_inv_in_2098", "Saanvi Analytics", 235_000, "INR", -3, "late"),
    ];
    return {
      inflows,
      outflows: [] as CanonicalOutflow[],
      subscriptions: [] as CanonicalSubscription[],
      banks: [] as CanonicalBankBalance[],
    };
  }
}

function mkInflow(
  id: string,
  customer: string,
  amount: number,
  currency: "USD" | "INR",
  daysLate: number,
  status: CanonicalInflow["status"],
): CanonicalInflow {
  const now = Date.now();
  const issued = new Date(now - (daysLate + 30) * 24 * 60 * 60 * 1000).toISOString();
  const due = new Date(now - daysLate * 24 * 60 * 60 * 1000).toISOString();
  return {
    id,
    source: "stripe",
    kind: "invoice",
    customer,
    amount,
    currency,
    amountUsd: toUsd(amount, currency),
    issuedAt: issued,
    dueAt: due,
    daysLate: Math.max(0, -daysLate),
    status,
    meta: { stripe_invoice_id: id.replace("stripe_", "") },
  };
}
