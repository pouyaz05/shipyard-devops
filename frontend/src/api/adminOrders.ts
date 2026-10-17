import { api } from "./client";
import { normalizeOrder, type Order } from "./orders";

export interface AdminOrder extends Order {
  customer: string;
}

// Relative path only: never a full URL.
const BASE = "/api/order-service";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === "object" ? (value as Raw) : {};
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const raw = asRecord(data);
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

export function normalizeAdminOrder(value: unknown): AdminOrder {
  const raw = asRecord(value);
  return {
    ...normalizeOrder(value),
    customer: String(raw.user_email ?? raw.customer_email ?? raw.email ?? raw.user_id ?? ""),
  };
}

export async function listAdminOrders(status: string, signal?: AbortSignal): Promise<AdminOrder[]> {
  const query = new URLSearchParams();
  if (status) query.set("status", status.toUpperCase());
  const qs = query.toString();
  const data = await api.get<unknown>(`${BASE}/admin/orders${qs ? `?${qs}` : ""}`, {
    auth: true,
    signal,
  });
  return extractList(data).map(normalizeAdminOrder);
}

export async function setAdminOrderStatus(id: string, status: string): Promise<void> {
  await api.patch<unknown>(
    `${BASE}/admin/orders/${encodeURIComponent(id)}/status`,
    { status: status.toUpperCase() },
    { auth: true },
  );
}
