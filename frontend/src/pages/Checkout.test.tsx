import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import { cartBody, makeCartItem, makeOrder, type RawCartItem, type RawOrder } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };
const BOARD = makeCartItem({ quantity: 2 }); // 2 x $9.99 = $19.98
const SENSOR = makeCartItem({ product_id: "2", name: "DHT22 Sensor", unit_price_cents: 450, quantity: 1 }); // $4.50

interface ServerOptions {
  items?: RawCartItem[];
  orderFailure?: { status: number; detail: string };
  hang?: boolean;
}

// A tiny in-memory shop: cart-service + order-service.
function shopServer(options: ServerOptions = {}) {
  let cartItems = options.items ?? [BOARD, SENSOR];
  let created: RawOrder | null = null;
  return (url: string, init?: RequestInit): Response | Promise<Response> => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, USER);
    if (url === "/api/cart-service/cart" && method === "GET") {
      return jsonResponse(200, cartBody(cartItems));
    }
    if (url === "/api/order-service/orders" && method === "POST") {
      if (options.hang) return new Promise<Response>(() => {});
      if (options.orderFailure) {
        return jsonResponse(options.orderFailure.status, { detail: options.orderFailure.detail });
      }
      created = makeOrder({ id: "101", items: cartItems });
      cartItems = []; // the server consumes the cart
      return jsonResponse(201, created);
    }
    if (url === "/api/order-service/orders/101" && created) return jsonResponse(200, created);
    return jsonResponse(404, { detail: "Not found" });
  };
}

function loggedIn() {
  localStorage.setItem(TOKEN_KEY, "tok");
}

async function fillShipping(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Address"), "12 Analytical St");
  await user.type(screen.getByLabelText("City"), "London");
}

describe("Checkout page", () => {
  it("redirects to /login when logged out", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    renderApp("/checkout");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the cart summary and a prefilled name", async () => {
    loggedIn();
    mockFetch(shopServer());
    renderApp("/checkout");

    await screen.findByRole("button", { name: "Place order" });
    const summary = within(screen.getByRole("region", { name: "Order summary" }));
    expect(summary.getByText("ESP32 DevKit x 2")).toBeInTheDocument();
    expect(summary.getByText("$19.98")).toBeInTheDocument();
    expect(summary.getByText("DHT22 Sensor x 1")).toBeInTheDocument();
    expect(summary.getByText("$4.50")).toBeInTheDocument();
    expect(summary.getByText("$24.48")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });

  it("validates the address form before calling the API", async () => {
    loggedIn();
    const fetchMock = mockFetch(shopServer());
    const user = userEvent.setup();
    renderApp("/checkout");
    await screen.findByRole("button", { name: "Place order" });

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Address is required.")).toBeInTheDocument();
    expect(screen.getByText("City is required.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("places the order, opens it and resets the cart badge", async () => {
    loggedIn();
    const fetchMock = mockFetch(shopServer());
    const user = userEvent.setup();
    renderApp("/checkout");
    const header = within(screen.getByRole("banner"));
    await screen.findByRole("button", { name: "Place order" });
    expect(await header.findByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByRole("heading", { name: "Order #101" })).toBeInTheDocument();
    expect(await header.findByRole("link", { name: "Cart" })).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/order-service/orders");
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: "Ada Lovelace",
      address: "12 Analytical St",
      city: "London",
    });
    expect((post[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("shows a clear message and a Back to cart button on 409", async () => {
    loggedIn();
    mockFetch(shopServer({ orderFailure: { status: 409, detail: "Price changed for ESP32 DevKit" } }));
    const user = userEvent.setup();
    renderApp("/checkout");
    await screen.findByRole("button", { name: "Place order" });

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Price changed for ESP32 DevKit");
    expect(within(alert).getByRole("link", { name: "Back to cart" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
  });

  it("shows the error for an empty cart on 400", async () => {
    loggedIn();
    mockFetch(shopServer({ orderFailure: { status: 400, detail: "Cart is empty" } }));
    const user = userEvent.setup();
    renderApp("/checkout");
    await screen.findByRole("button", { name: "Place order" });

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Cart is empty");
    expect(within(alert).getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("disables the button while the order is being placed", async () => {
    loggedIn();
    mockFetch(shopServer({ hang: true }));
    const user = userEvent.setup();
    renderApp("/checkout");
    await screen.findByRole("button", { name: "Place order" });

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByRole("button", { name: "Placing order..." })).toBeDisabled();
  });

  it("shows the empty state instead of the form when the cart is empty", async () => {
    loggedIn();
    mockFetch(shopServer({ items: [] }));
    renderApp("/checkout");

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Place order" })).not.toBeInTheDocument();
  });

  it("is reachable from the cart page", async () => {
    loggedIn();
    mockFetch(shopServer());
    renderApp("/cart");

    expect(await screen.findByRole("link", { name: "Proceed to checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });
});
