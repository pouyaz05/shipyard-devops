export function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    slug: "esp32-devkit",
    name: "ESP32 DevKit",
    description: "Dual-core Wi-Fi and Bluetooth development board.",
    price_cents: 999,
    stock: 42,
    category: { name: "Boards", slug: "boards" },
    ...overrides,
  };
}

export function productPage(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, page_size: 12, ...overrides };
}

export interface RawCartItem {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
}

export function makeCartItem(overrides: Partial<RawCartItem> = {}): RawCartItem {
  return {
    product_id: "1",
    name: "ESP32 DevKit",
    unit_price_cents: 999,
    quantity: 1,
    ...overrides,
  };
}

export function cartBody(items: RawCartItem[]) {
  return {
    items,
    total_cents: items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
  };
}

export interface RawOrder {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  items: RawCartItem[];
  shipping: { name: string; address: string; city: string };
}

export function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  const items = overrides.items ?? [makeCartItem({ quantity: 2 })];
  return {
    id: "101",
    status: "pending",
    total_cents: items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
    created_at: "2026-10-16T12:00:00Z",
    shipping: { name: "Ada Lovelace", address: "12 Analytical St", city: "London" },
    ...overrides,
    items,
  };
}
