const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return "N/A";
  return usd.format(Math.round(cents) / 100);
}
