const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return "N/A";
  return usd.format(Math.round(cents) / 100);
}

// "12.50" -> 1250. Returns null for anything that is not a plain dollar amount.
export function dollarsToCents(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

// 999 -> "9.99" (for form fields)
export function centsToDollarInput(cents: number): string {
  return Number.isFinite(cents) ? (Math.round(cents) / 100).toFixed(2) : "";
}
