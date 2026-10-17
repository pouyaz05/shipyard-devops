import { api } from "./client";

export interface CartItem {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  total_cents: number;
}

export const EMPTY_CART: Cart = { items: [], total_cents: 0 };

// Relative path only: never a full URL.
const BASE = "/api/cart-service";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === "object" ? (value as Raw) : {};
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function normalizeItem(value: unknown): CartItem {
  const raw = asRecord(value);
  return {
    product_id: String(raw.product_id ?? raw.id ?? ""),
    name: String(raw.name ?? raw.product_name ?? "Unknown product"),
    unit_price_cents: toNumber(raw.unit_price_cents ?? raw.price_cents, 0),
    quantity: Math.max(0, Math.trunc(toNumber(raw.quantity, 1))),
  };
}

export function normalizeCart(value: unknown): Cart {
  const raw = asRecord(value);
  const list = Array.isArray(value) ? value : Array.isArray(raw.items) ? raw.items : [];
  const items = list.map(normalizeItem);
  const computed = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  return { items, total_cents: toNumber(raw.total_cents, computed) };
}

export async function fetchCart(signal?: AbortSignal): Promise<Cart> {
  return normalizeCart(await api.get<unknown>(`${BASE}/cart`, { auth: true, signal }));
}

export async function addCartItem(productId: string, quantity = 1): Promise<void> {
  await api.post<unknown>(`${BASE}/cart/items`, { product_id: productId, quantity }, { auth: true });
}

export async function updateCartItem(productId: string, quantity: number): Promise<void> {
  await api.patch<unknown>(
    `${BASE}/cart/items/${encodeURIComponent(productId)}`,
    { quantity },
    { auth: true },
  );
}

export async function removeCartItem(productId: string): Promise<void> {
  await api.delete<unknown>(`${BASE}/cart/items/${encodeURIComponent(productId)}`, { auth: true });
}
