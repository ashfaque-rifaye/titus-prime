/**
 * Currency formatting helpers — supports USD and INR in the same surface.
 *
 * INR uses the Indian numbering system (lakh / crore separators). USD uses
 * standard en-US formatting. The `formatMoney` helper picks based on the
 * supplied currency code.
 */
export type Currency = "USD" | "INR";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const INR_FMT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const USD_FMT_CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_FMT_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, currency: Currency = "USD", opts?: { precise?: boolean }): string {
  if (currency === "INR") {
    return opts?.precise ? INR_FMT_PAISE.format(value) : INR_FMT.format(value);
  }
  return opts?.precise ? USD_FMT_CENTS.format(value) : USD_FMT.format(value);
}

/** Compact form: $32k, ₹18.7L, etc. */
export function formatCompact(value: number, currency: Currency = "USD"): string {
  if (currency === "INR") {
    if (Math.abs(value) >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
    if (Math.abs(value) >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
    if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
    return `₹${value.toFixed(0)}`;
  }
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}
