import { jsonResponse, mockFetch } from "../test/utils";
import { makeProduct, productPage } from "../test/fixtures";
import { getProduct, listCategories, listProducts } from "./products";

describe("products API", () => {
  it("builds the list URL with query params and uses a relative path", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, productPage([makeProduct()], { total: 30 })));

    const result = await listProducts({ q: "esp32", category: "boards", page: 2, pageSize: 12 });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url.startsWith("/api/product-service/products?")).toBe(true);
    expect(url).not.toMatch(/^https?:/);
    const params = new URL(url, "http://localhost").searchParams;
    expect(params.get("q")).toBe("esp32");
    expect(params.get("category")).toBe("boards");
    expect(params.get("page")).toBe("2");
    expect(params.get("page_size")).toBe("12");
    expect(result.total).toBe(30);
    expect(result.items[0]).toMatchObject({ slug: "esp32-devkit", price_cents: 999, stock: 42 });
  });

  it("omits empty q and category", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, productPage([])));
    await listProducts({ q: "", category: "", page: 1, pageSize: 4 });
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost").searchParams;
    expect(params.has("q")).toBe(false);
    expect(params.has("category")).toBe(false);
  });

  it("requests a single product by slug", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, makeProduct()));
    const product = await getProduct("esp32-devkit");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/product-service/products/esp32-devkit");
    expect(product.name).toBe("ESP32 DevKit");
    expect(product.category).toEqual({ name: "Boards", slug: "boards" });
  });

  it("lists categories", async () => {
    mockFetch(() => jsonResponse(200, [{ name: "Boards", slug: "boards" }]));
    expect(await listCategories()).toEqual([{ name: "Boards", slug: "boards" }]);
  });
});
