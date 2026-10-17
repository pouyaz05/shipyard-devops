import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { cartBody, makeProduct } from "../../test/fixtures";
import { ADMIN, loginAs } from "../../test/users";
import { jsonResponse, mockFetch, renderApp } from "../../test/utils";

type Raw = Record<string, unknown>;

const BOARD = makeProduct({ sku: "ESP32-V1", image_url: "", is_active: true });
const SENSOR = makeProduct({
  id: "2",
  slug: "dht22",
  name: "DHT22 Sensor",
  sku: "DHT22",
  price_cents: 450,
  stock: 0,
  is_active: false,
  category: { name: "Sensors", slug: "sensors" },
});

interface Failure {
  status: number;
  detail: string;
}

const failure = (f: Failure) => jsonResponse(f.status, { detail: f.detail });

// A tiny in-memory product-service.
function productServer(
  initial: Raw[],
  options: { saveFailure?: Failure; deleteFailure?: Failure } = {},
) {
  let products = initial;
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, ADMIN);
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url.startsWith("/api/product-service/categories")) {
      return jsonResponse(200, [{ name: "Boards", slug: "boards" }]);
    }
    if (url.startsWith("/api/product-service/products?") && method === "GET") {
      return jsonResponse(200, { items: products, total: products.length, page: 1, page_size: 20 });
    }
    if (url === "/api/product-service/products" && method === "POST") {
      if (options.saveFailure) return failure(options.saveFailure);
      const body = JSON.parse(String(init?.body)) as Raw;
      products = [...products, makeProduct({ id: "99", slug: "new-item", ...body })];
      return jsonResponse(201, products[products.length - 1]);
    }
    const one = url.match(/^\/api\/product-service\/products\/([^/?]+)$/);
    if (one) {
      const id = one[1];
      if (method === "GET") {
        const current = products.find((p) => p.id === id);
        return current ? jsonResponse(200, current) : jsonResponse(404, { detail: "Product not found" });
      }
      if (method === "PATCH") {
        if (options.saveFailure) return failure(options.saveFailure);
        const body = JSON.parse(String(init?.body)) as Raw;
        products = products.map((p) => (p.id === id ? { ...p, ...body } : p));
        return jsonResponse(200, {});
      }
      if (method === "DELETE") {
        if (options.deleteFailure) return failure(options.deleteFailure);
        products = products.filter((p) => p.id !== id);
        return new Response(null, { status: 204 });
      }
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

function hasCall(
  fetchMock: ReturnType<typeof mockFetch>,
  method: string,
  url: string,
): boolean {
  return fetchMock.mock.calls.some(([u, init]) => String(u) === url && init?.method === method);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Admin products list", () => {
  it("shows name, price, stock and active/inactive status", async () => {
    loginAs();
    mockFetch(productServer([BOARD, SENSOR]));
    renderApp("/admin/products");

    const boardRow = (await screen.findByText("ESP32 DevKit")).closest("tr")!;
    expect(within(boardRow).getByText("ESP32-V1")).toBeInTheDocument();
    expect(within(boardRow).getByText("$9.99")).toBeInTheDocument();
    expect(within(boardRow).getByText("42")).toBeInTheDocument();
    expect(within(boardRow).getByText("Active")).toBeInTheDocument();

    const sensorRow = screen.getByText("DHT22 Sensor").closest("tr")!;
    expect(within(sensorRow).getByText("$4.50")).toBeInTheDocument();
    expect(within(sensorRow).getByText("0")).toBeInTheDocument();
    expect(within(sensorRow).getByText("Inactive")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    loginAs();
    mockFetch(productServer([]));
    renderApp("/admin/products");

    expect(await screen.findByText("No products yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New product" })).toHaveAttribute(
      "href",
      "/admin/products/new",
    );
  });

  it("shows an error and recovers with Try again", async () => {
    loginAs();
    const base = productServer([BOARD]);
    let listRequests = 0;
    mockFetch((url, init) => {
      if (url.startsWith("/api/product-service/products?")) {
        listRequests += 1;
        if (listRequests === 1) return jsonResponse(500, { detail: "Catalog unavailable" });
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    renderApp("/admin/products");

    expect(await screen.findByRole("alert")).toHaveTextContent("Catalog unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("ESP32 DevKit")).toBeInTheDocument();
  });

  it("explains a 403 clearly", async () => {
    loginAs();
    const base = productServer([BOARD]);
    mockFetch((url, init) =>
      url.startsWith("/api/product-service/products?")
        ? jsonResponse(403, { detail: "Forbidden" })
        : base(url, init),
    );
    renderApp("/admin/products");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have permission to view this page.",
    );
  });

  it("paginates", async () => {
    loginAs();
    const base = productServer([BOARD]);
    const fetchMock = mockFetch((url, init) =>
      url.startsWith("/api/product-service/products?")
        ? jsonResponse(200, { items: [BOARD], total: 45 })
        : base(url, init),
    );
    const user = userEvent.setup();
    renderApp("/admin/products");

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("page=2&page_size=20")),
    ).toBe(true);
  });
});

describe("Admin product deletion", () => {
  it("deletes after confirmation", async () => {
    loginAs();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = mockFetch(productServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/admin/products");
    await screen.findByText("DHT22 Sensor");

    await user.click(screen.getByRole("button", { name: "Delete DHT22 Sensor" }));

    expect(confirmSpy).toHaveBeenCalledWith('Delete "DHT22 Sensor"? This cannot be undone.');
    await waitFor(() => expect(screen.queryByText("DHT22 Sensor")).not.toBeInTheDocument());
    expect(screen.getByText("ESP32 DevKit")).toBeInTheDocument();
    expect(hasCall(fetchMock, "DELETE", "/api/product-service/products/2")).toBe(true);
  });

  it("does nothing when the confirmation is declined", async () => {
    loginAs();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = mockFetch(productServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/admin/products");
    await screen.findByText("DHT22 Sensor");

    await user.click(screen.getByRole("button", { name: "Delete DHT22 Sensor" }));

    expect(screen.getByText("DHT22 Sensor")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("shows the server message on 409", async () => {
    loginAs();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch(
      productServer([BOARD], { deleteFailure: { status: 409, detail: "Product is used in orders" } }),
    );
    const user = userEvent.setup();
    renderApp("/admin/products");
    await screen.findByText("ESP32 DevKit");

    await user.click(screen.getByRole("button", { name: "Delete ESP32 DevKit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Product is used in orders");
    expect(screen.getByText("ESP32 DevKit")).toBeInTheDocument();
  });
});

describe("Admin product form", () => {
  it("validates, converts dollars to cents and creates a product", async () => {
    loginAs();
    const fetchMock = mockFetch(productServer([BOARD]));
    const user = userEvent.setup();
    renderApp("/admin/products");

    await user.click(await screen.findByRole("link", { name: "New product" }));
    expect(await screen.findByRole("heading", { name: "New product" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("SKU is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a price like 9.99.")).toBeInTheDocument();
    expect(screen.getByText("Stock must be a whole number (0 or more).")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    await user.type(screen.getByLabelText("Name"), "Logic Analyzer");
    await user.type(screen.getByLabelText("SKU"), "LA-8");
    await user.type(screen.getByLabelText("Price (USD)"), "12.50");
    await user.type(screen.getByLabelText("Stock"), "5");
    await user.type(screen.getByLabelText("Category"), "Tools");
    await user.type(screen.getByLabelText("Description"), "8-channel logic analyzer");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByRole("heading", { name: "Manage products" })).toBeInTheDocument();
    expect(await screen.findByText("Logic Analyzer")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/product-service/products");
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: "Logic Analyzer",
      sku: "LA-8",
      price_cents: 1250,
      stock: 5,
      category: "Tools",
      image_url: null,
      description: "8-channel logic analyzer",
      is_active: true,
    });
    expect((post[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("rejects a bad image URL", async () => {
    loginAs();
    mockFetch(productServer([]));
    const user = userEvent.setup();
    renderApp("/admin/products/new");

    await user.type(await screen.findByLabelText("Image URL"), "ftp://example.com/a.png");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText("Image URL must start with http:// or https://.")).toBeInTheDocument();
  });

  it("edits a product with prefilled values", async () => {
    loginAs();
    const fetchMock = mockFetch(productServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/admin/products");

    await user.click(await screen.findByRole("link", { name: "Edit ESP32 DevKit" }));
    expect(await screen.findByRole("heading", { name: "Edit product" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("ESP32 DevKit");
    expect(screen.getByLabelText("SKU")).toHaveValue("ESP32-V1");
    expect(screen.getByLabelText("Price (USD)")).toHaveValue("9.99");
    expect(screen.getByLabelText("Stock")).toHaveValue("42");
    expect(screen.getByLabelText("Category")).toHaveValue("Boards");
    expect(screen.getByLabelText("Active")).toBeChecked();

    await user.clear(screen.getByLabelText("Price (USD)"));
    await user.type(screen.getByLabelText("Price (USD)"), "11.00");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("$11.00")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(String(patch[0])).toBe("/api/product-service/products/1");
    expect(JSON.parse(String(patch[1]!.body))).toMatchObject({ price_cents: 1100, sku: "ESP32-V1" });
  });

  it("can deactivate a product", async () => {
    loginAs();
    const fetchMock = mockFetch(productServer([BOARD]));
    const user = userEvent.setup();
    renderApp("/admin/products/1");

    await user.click(await screen.findByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toMatchObject({ is_active: false });
  });

  it("shows a not-found state for an unknown product", async () => {
    loginAs();
    mockFetch(productServer([BOARD]));
    renderApp("/admin/products/404");

    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
  });

  it("shows the server message for a duplicate SKU (409)", async () => {
    loginAs();
    mockFetch(
      productServer([BOARD], { saveFailure: { status: 409, detail: "SKU already exists" } }),
    );
    const user = userEvent.setup();
    renderApp("/admin/products/1");

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SKU already exists");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("explains a 403 when saving", async () => {
    loginAs();
    mockFetch(productServer([BOARD], { saveFailure: { status: 403, detail: "Forbidden" } }));
    const user = userEvent.setup();
    renderApp("/admin/products/1");

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have permission to do this.",
    );
  });
});
