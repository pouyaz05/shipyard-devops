import { makeCartItem, makeOrder } from "../test/fixtures";
import { jsonResponse, mockFetch } from "../test/utils";
import { ApiError, TOKEN_KEY } from "./client";
import { getOrder, listOrders, normalizeOrder, payOrder, placeOrder } from "./orders";

function authHeader(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

describe("orders API", () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, "tok");
  });

  it("places an order on a relative path with the bearer token", async () => {
    const fetchMock = mockFetch(() => jsonResponse(201, makeOrder()));

    const order = await placeOrder({ name: "Ada", address: "12 St", city: "London" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/order-service/orders");
    expect(String(url)).not.toMatch(/^https?:/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Ada", address: "12 St", city: "London" });
    expect(authHeader(init)).toBe("Bearer tok");
    expect(order).toMatchObject({ id: "101", status: "pending", total_cents: 1998 });
  });

  it("rejects when the response has no order id", async () => {
    mockFetch(() => jsonResponse(201, {}));
    await expect(placeOrder({ name: "Ada", address: "12 St", city: "London" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("lists orders from { items } or a plain array", async () => {
    mockFetch(() => jsonResponse(200, { items: [makeOrder()] }));
    expect(await listOrders()).toHaveLength(1);

    mockFetch(() => jsonResponse(200, [makeOrder(), makeOrder({ id: "102" })]));
    expect(await listOrders()).toHaveLength(2);
  });

  it("gets one order", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, makeOrder()));
    const order = await getOrder("101");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/order-service/orders/101");
    expect(order.items[0]).toMatchObject({ name: "ESP32 DevKit", quantity: 2 });
    expect(order.shipping).toEqual({ name: "Ada Lovelace", address: "12 Analytical St", city: "London" });
  });

  it("pays an order with POST", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await payOrder("101");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/order-service/orders/101/pay");
    expect(init?.method).toBe("POST");
    expect(authHeader(init)).toBe("Bearer tok");
  });

  it("normalizes flat shipping fields, lower-cases the status and computes the total", () => {
    const order = normalizeOrder({
      order_id: 7,
      status: "PAID",
      shipping_name: "Ada",
      shipping_address: "12 St",
      shipping_city: "London",
      items: [makeCartItem({ unit_price_cents: 100, quantity: 3 })],
    });
    expect(order).toMatchObject({
      id: "7",
      status: "paid",
      total_cents: 300,
      shipping: { name: "Ada", address: "12 St", city: "London" },
    });
  });
});
