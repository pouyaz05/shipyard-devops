import { makeCartItem, makeOrder, makeProduct } from "../test/fixtures";
import { jsonResponse, mockFetch } from "../test/utils";
import { listAdminOrders, setAdminOrderStatus } from "./adminOrders";
import {
  createProduct,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  updateProduct,
  type ProductInput,
} from "./adminProducts";
import { TOKEN_KEY } from "./client";
import { cancelOrder } from "./orders";
import { fetchMe, updateMyName } from "./user";

function authHeader(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

const INPUT: ProductInput = {
  name: "Logic Analyzer",
  sku: "LA-8",
  price_cents: 1250,
  stock: 5,
  category: "Tools",
  image_url: null,
  description: "8 channels",
  is_active: true,
};

describe("admin API", () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, "tok");
  });

  it("lists products including inactive ones, on a relative path with the token", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, {
        items: [makeProduct({ sku: "ESP32-V1", is_active: false }), makeProduct({ id: "2" })],
        total: 45,
      }),
    );

    const page = await listAdminProducts({ page: 2, pageSize: 20 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "/api/product-service/products?include_inactive=true&page=2&page_size=20",
    );
    expect(String(url)).not.toMatch(/^https?:/);
    expect(authHeader(init)).toBe("Bearer tok");
    expect(page.total).toBe(45);
    expect(page.items[0]).toMatchObject({ sku: "ESP32-V1", is_active: false });
    expect(page.items[1].is_active).toBe(true); // missing flag means active
  });

  it("gets, creates, updates and deletes a product", async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse(200, makeProduct()),
    );

    const product = await getAdminProduct("1");
    expect(product.name).toBe("ESP32 DevKit");
    await createProduct(INPUT);
    await updateProduct("1", INPUT);
    await deleteProduct("1");

    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`);
    expect(calls).toEqual([
      "GET /api/product-service/products/1",
      "POST /api/product-service/products",
      "PATCH /api/product-service/products/1",
      "DELETE /api/product-service/products/1",
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(INPUT);
  });

  it("lists admin orders with an optional uppercase status filter", async () => {
    const order = { ...makeOrder({ status: "PAID" }), user_email: "ada@example.com" };
    const fetchMock = mockFetch(() => jsonResponse(200, { items: [order] }));

    const all = await listAdminOrders("");
    const paid = await listAdminOrders("paid");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/order-service/admin/orders");
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/order-service/admin/orders?status=PAID");
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe("Bearer tok");
    expect(all[0]).toMatchObject({ id: "101", status: "paid", customer: "ada@example.com" });
    expect(paid).toHaveLength(1);
  });

  it("changes an order status with PATCH", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await setAdminOrderStatus("101", "shipped");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/order-service/admin/orders/101/status");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "SHIPPED" });
  });

  it("cancels an order with POST", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await cancelOrder("101");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/order-service/orders/101/cancel");
    expect(init?.method).toBe("POST");
    expect(authHeader(init)).toBe("Bearer tok");
  });

  it("reads the role from /users/me and defaults to user", async () => {
    mockFetch(() => jsonResponse(200, { id: 9, email: "a@x.com", full_name: "A", role: "admin" }));
    expect(await fetchMe()).toEqual({ id: "9", email: "a@x.com", full_name: "A", role: "admin" });

    mockFetch(() => jsonResponse(200, { id: 1, email: "b@x.com", full_name: "B" }));
    expect((await fetchMe()).role).toBe("user");
  });

  it("updates the name with PATCH /users/me", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { full_name: "Ada King" }));
    expect(await updateMyName("Ada King")).toBe("Ada King");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/user-service/users/me");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ full_name: "Ada King" });

    // An empty response falls back to the name that was sent.
    mockFetch(() => new Response(null, { status: 204 }));
    expect(await updateMyName("Ada Byron")).toBe("Ada Byron");
    void makeCartItem; // fixture import kept for symmetry with other tests
  });
});
