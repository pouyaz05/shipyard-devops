import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import {
  cartBody,
  makeCartItem,
  makeProduct,
  productPage,
  type RawCartItem,
} from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };
const BOARD = makeProduct();
const SOLD_OUT = makeProduct({ id: "3", slug: "sold-out", name: "Sold Out Board", stock: 0 });

// A tiny in-memory shop: product-service + cart-service + login.
function shopServer(options: { addConflict?: string } = {}) {
  let cartItems: RawCartItem[] = [];
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/login")) {
      return jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 });
    }
    if (url.endsWith("/users/me")) return jsonResponse(200, USER);
    if (url === "/api/cart-service/cart" && method === "GET") {
      return jsonResponse(200, cartBody(cartItems));
    }
    if (url === "/api/cart-service/cart/items" && method === "POST") {
      if (options.addConflict) return jsonResponse(409, { detail: options.addConflict });
      const body = JSON.parse(String(init?.body)) as { product_id: string; quantity: number };
      cartItems = [...cartItems, makeCartItem({ product_id: body.product_id, quantity: body.quantity })];
      return jsonResponse(201, {});
    }
    if (url.startsWith("/api/product-service/categories")) return jsonResponse(200, []);
    if (url.startsWith("/api/product-service/products/")) return jsonResponse(200, BOARD);
    if (url.startsWith("/api/product-service/products")) {
      return jsonResponse(200, productPage([BOARD, SOLD_OUT]));
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

describe("Add to cart", () => {
  it("sends a logged-out user to /login and brings them back after login", async () => {
    const fetchMock = mockFetch(shopServer());
    const user = userEvent.setup();
    renderApp("/products?q=esp");
    await screen.findByText("ESP32 DevKit");

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search products" })).toHaveValue("esp");
  });

  it("adds an item for a logged-in user and updates the navbar badge", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    const fetchMock = mockFetch(shopServer());
    const user = userEvent.setup();
    renderApp("/products");

    const header = within(screen.getByRole("banner"));
    await header.findByRole("link", { name: "ada@example.com" });
    await screen.findByText("ESP32 DevKit");

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByText(/Added to cart/)).toBeInTheDocument();
    expect(await header.findByRole("link", { name: "Cart, 1 item" })).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/cart-service/cart/items");
    expect(JSON.parse(String(post[1]!.body))).toEqual({ product_id: "1", quantity: 1 });
    expect((post[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("shows a clear message when the server answers 409", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    mockFetch(shopServer({ addConflict: "Only 2 left in stock" }));
    const user = userEvent.setup();
    renderApp("/products");

    const header = within(screen.getByRole("banner"));
    await header.findByRole("link", { name: "ada@example.com" });
    await screen.findByText("ESP32 DevKit");

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 2 left in stock");
    expect(header.getByRole("link", { name: "Cart" })).toBeInTheDocument();
  });

  it("disables the button for out-of-stock products", async () => {
    mockFetch(shopServer());
    renderApp("/products");
    await screen.findByText("Sold Out Board");

    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });

  it("works on the product detail page", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    mockFetch(shopServer());
    const user = userEvent.setup();
    renderApp("/products/esp32-devkit");

    const header = within(screen.getByRole("banner"));
    await header.findByRole("link", { name: "ada@example.com" });
    await screen.findByRole("heading", { name: "ESP32 DevKit" });

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByText(/Added to cart/)).toBeInTheDocument();
    expect(await header.findByRole("link", { name: "Cart, 1 item" })).toBeInTheDocument();
  });
});
