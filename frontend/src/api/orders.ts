import { normalizeCart, type CartItem } from "./cart";
import { ApiError, api } from "./client";

export interface ShippingInput {
  name: string;
  address: string;
  city: string;
}

export interface Order {
  id: string;
  status: string; // lower-case: "pending" | "pending_payment" | "paid" | "shipped" | ...
  total_cents: number;
  created_at: string;
  items: CartItem[];
  shipping: ShippingInput;
}

// Relative path only: never a full URL.
const BASE = "/api/order-service";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === "object" ? (value as Raw) : {};
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function normalizeOrder(value: unknown): Order {
  const raw = asRecord(value);
  const shipping = asRecord(raw.shipping);
  const { items, total_cents } = normalizeCart({ items: raw.items });
  return {
    id: String(raw.id ?? raw.order_id ?? ""),
    status: String(raw.status ?? "pending").toLowerCase(),
    total_cents: toNumber(raw.total_cents, total_cents),
    created_at: String(raw.created_at ?? ""),
    items,
    shipping: {
      name: String(shipping.name ?? raw.shipping_name ?? ""),
      address: String(shipping.address ?? raw.shipping_address ?? ""),
      city: String(shipping.city ?? raw.shipping_city ?? ""),
    },
  };
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const raw = asRecord(data);
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

export async function placeOrder(shipping: ShippingInput, signal?: AbortSignal): Promise<Order> {
  const order = normalizeOrder(
    await api.post<unknown>(`${BASE}/orders`, shipping, { auth: true, signal }),
  );
  if (!order.id) throw new ApiError(500, "Unexpected response from server.");
  return order;
}

export async function listOrders(signal?: AbortSignal): Promise<Order[]> {
  const data = await api.get<unknown>(`${BASE}/orders`, { auth: true, signal });
  return extractList(data).map(normalizeOrder);
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const data = await api.get<unknown>(`${BASE}/orders/${encodeURIComponent(id)}`, {
    auth: true,
    signal,
  });
  return normalizeOrder(data);
}

export async function payOrder(id: string): Promise<void> {
  await api.post<unknown>(`${BASE}/orders/${encodeURIComponent(id)}/pay`, {}, { auth: true });
}

export async function cancelOrder(id: string): Promise<void> {
  await api.post<unknown>(`${BASE}/orders/${encodeURIComponent(id)}/cancel`, {}, { auth: true });
}
