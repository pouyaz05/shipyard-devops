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
