/**
 * GET /api/cloud/aws
 *
 * Returns REAL AWS spend via the Cost Explorer API when credentials are present
 * in the server environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). When
 * they're absent, returns deterministic demo data with `live: false` so the UI
 * can label it honestly as "Simulated" — never a fake "Connected".
 *
 * Credentials are read server-side only and never shipped to the browser.
 */
import { createFileRoute } from "@tanstack/react-router";

type ServiceCost = { name: string; cost: number };
type CloudResult = {
  live: boolean;
  provider: "aws";
  monthlySpend: number;
  prevMonthSpend: number;
  currency: string;
  topServices: ServiceCost[];
  detail: string;
};

const DEMO: CloudResult = {
  live: false,
  provider: "aws",
  monthlySpend: 3842,
  prevMonthSpend: 3510,
  currency: "USD",
  topServices: [
    { name: "EC2", cost: 1680 },
    { name: "RDS", cost: 890 },
    { name: "S3", cost: 420 },
    { name: "Lambda", cost: 210 },
    { name: "CloudFront", cost: 180 },
  ],
  detail: "Simulated — set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for live data.",
};

function monthRange(offsetMonths: number): { Start: string; End: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths + 1, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { Start: iso(start), End: iso(end) };
}

export const Route = createFileRoute("/api/cloud/aws")({
  server: {
    handlers: {
      GET: async () => {
        const keyId = process.env.AWS_ACCESS_KEY_ID;
        const secret = process.env.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || "us-east-1";

        if (!keyId || !secret) {
          return json(DEMO);
        }

        try {
          const { CostExplorerClient, GetCostAndUsageCommand } =
            await import("@aws-sdk/client-cost-explorer");
          const client = new CostExplorerClient({
            region,
            credentials: { accessKeyId: keyId, secretAccessKey: secret },
          });

          // Current month: spend grouped by service.
          const cur = monthRange(0);
          const curResp = await client.send(
            new GetCostAndUsageCommand({
              TimePeriod: cur,
              Granularity: "MONTHLY",
              Metrics: ["UnblendedCost"],
              GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
            }),
          );

          // Previous month: total spend only (for MoM delta).
          const prev = monthRange(1);
          const prevResp = await client.send(
            new GetCostAndUsageCommand({
              TimePeriod: prev,
              Granularity: "MONTHLY",
              Metrics: ["UnblendedCost"],
            }),
          );

          const groups = curResp.ResultsByTime?.[0]?.Groups ?? [];
          const services: ServiceCost[] = groups
            .map((g) => ({
              name: shortName(g.Keys?.[0] ?? "Unknown"),
              cost: Math.round(Number(g.Metrics?.UnblendedCost?.Amount ?? 0)),
            }))
            .filter((s) => s.cost > 0)
            .sort((a, b) => b.cost - a.cost);

          const monthlySpend = services.reduce((s, x) => s + x.cost, 0);
          const prevTotal = Math.round(
            Number(prevResp.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount ?? 0),
          );
          const currency =
            curResp.ResultsByTime?.[0]?.Groups?.[0]?.Metrics?.UnblendedCost?.Unit ?? "USD";

          return json({
            live: true,
            provider: "aws",
            monthlySpend,
            prevMonthSpend: prevTotal,
            currency,
            topServices: services.slice(0, 6),
            detail: `Live · Cost Explorer · ${cur.Start} → ${cur.End}`,
          } satisfies CloudResult);
        } catch (e: any) {
          // Real failure (bad creds, no ce:GetCostAndUsage permission, etc.) —
          // surface it honestly instead of silently showing fake numbers.
          return json({
            ...DEMO,
            detail: `AWS error: ${String(e?.message ?? e).slice(0, 140)}`,
          });
        }
      },
    },
  },
});

/** "Amazon Elastic Compute Cloud - Compute" → "EC2-ish" short label. */
function shortName(full: string): string {
  const map: Record<string, string> = {
    "Amazon Elastic Compute Cloud - Compute": "EC2",
    "Amazon Relational Database Service": "RDS",
    "Amazon Simple Storage Service": "S3",
    "AWS Lambda": "Lambda",
    "Amazon CloudFront": "CloudFront",
    "Amazon Virtual Private Cloud": "VPC",
    "EC2 - Other": "EC2-Other",
  };
  return map[full] ?? full.replace(/^Amazon\s|^AWS\s/, "");
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
