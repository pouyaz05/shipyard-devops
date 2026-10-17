import { cartBody, makeCartItem } from "../test/fixtures";
import { jsonResponse, mockFetch } from "../test/utils";
import { addCartItem, fetchCart, normalizeCart, removeCartItem, updateCartItem } from "./cart";
import { TOKEN_KEY } from "./client";

function authHeader(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

describe("cart API", () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, "tok");
  });

  it("fetches the cart on a relative path with the bearer token", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, cartBody([makeCartItem({ quantity: 2 }), makeCartItem({ product_id: "2", name: "DHT22", unit_price_cents: 450 })])),
    );

    const cart = await fetchCart();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/cart-service/cart");
    expect(String(url)).not.toMatch(/^https?:/);
    expect(authHeader(init)).toBe("Bearer tok");
    expect(cart.items).toHaveLength(2);
    expect(cart.total_cents).toBe(2 * 999 + 450);
  });

  it("adds an item with POST", async () => {
    const fetchMock = mockFetch(() => jsonResponse(201, {}));
    await addCartItem("1", 2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/cart-service/cart/items");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ product_id: "1", quantity: 2 });
    expect(authHeader(init)).toBe("Bearer tok");
  });

  it("updates the quantity with PATCH", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await updateCartItem("1", 4);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/cart-service/cart/items/1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ quantity: 4 });
  });

  it("removes an item with DELETE and accepts an empty 204 response", async () => {
    const fetchMock = mockFetch(() => new Response(null, { status: 204 }));
    await expect(removeCartItem("a b")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/cart-service/cart/items/a%20b");
    expect(init?.method).toBe("DELETE");
  });

  it("computes the total when the server does not send one and tolerates garbage", () => {
    expect(
      normalizeCart({ items: [{ product_id: 5, name: "X", unit_price_cents: 100, quantity: 2 }] }),
    ).toEqual({
      items: [{ product_id: "5", name: "X", unit_price_cents: 100, quantity: 2 }],
      total_cents: 200,
    });
    expect(normalizeCart(null)).toEqual({ items: [], total_cents: 0 });
  });
});
