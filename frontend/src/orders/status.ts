export type StatusTone = "amber" | "green" | "sky" | "slate";

const INFO: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "amber" },
  pending_payment: { label: "Pending", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  shipped: { label: "Shipped", tone: "sky" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "slate" },
  canceled: { label: "Cancelled", tone: "slate" },
};

function humanize(status: string): string {
  const text = status.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";
}

export function statusInfo(status: string): { label: string; tone: StatusTone } {
  return INFO[status] ?? { label: humanize(status), tone: "slate" };
}

// "pending" (FE-5 name) and "pending_payment" (PENDING_PAYMENT) mean the same thing.
export function isPendingPayment(status: string): boolean {
  return status === "pending" || status === "pending_payment";
}
