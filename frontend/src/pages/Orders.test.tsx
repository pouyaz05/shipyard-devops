import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import { cartBody, makeCartItem, makeOrder, type RawOrder } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };

// 2 x $9.99 + 1 x $4.50 = $24.48
const PENDING = makeOrder({
  id: "101",
  status: "pending",
  created_at: "2026-10-16T12:00:00Z",
  items: [
    makeCartItem({ quantity: 2 }),
    makeCartItem({ product_id: "2", name: "DHT22 Sensor", unit_price_cents: 450, quantity: 1 }),
  ],
});
// 1 x $4.50
const PAID = makeOrder({
  id: "100",
  status: "paid",
  created_at: "2026-10-10T12:00:00Z",
  items: [makeCartItem({ product_id: "2", name: "DHT22 Sensor", unit_price_cents: 450, quantity: 1 })],
});

// A tiny in-memory order-service.
function orderServer(initial: RawOrder[]) {
  let orders = initial;
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, USER);
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url === "/api/order-service/orders" && method === "GET") {
      return jsonResponse(200, { items: orders });
    }
    const pay = url.match(/^\/api\/order-service\/orders\/([^/]+)\/pay$/);
    if (pay && method === "POST") {
      orders = orders.map((o) => (o.id === pay[1] ? { ...o, status: "paid" } : o));
      return jsonResponse(200, {});
    }
    const detail = url.match(/^\/api\/order-service\/orders\/([^/]+)$/);
    if (detail && method === "GET") {
      const order = orders.find((o) => o.id === detail[1]);
      return order ? jsonResponse(200, order) : jsonResponse(404, { detail: "Order not found" });
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

function loggedIn() {
  localStorage.setItem(TOKEN_KEY, "tok");
}

describe("Orders page", () => {
  it("lists orders, newest first, with date, total and status", async () => {
    loggedIn();
    mockFetch(orderServer([PAID, PENDING]));
    renderApp("/orders");

    expect(await screen.findByText("Order #101")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Order #/ });
    expect(links[0]).toHaveTextContent("Order #101");
    expect(links[1]).toHaveTextContent("Order #100");
    expect(links[0]).toHaveAttribute("href", "/orders/101");

    expect(screen.getByText("Oct 16, 2026")).toBeInTheDocument();
    expect(screen.getByText("$24.48")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Oct 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("shows a loading state", async () => {
    loggedIn();
    mockFetch((url) =>
      url.endsWith("/users/me") ? jsonResponse(200, USER) : (new Promise<Response>(() => {}) as never),
    );
    renderApp("/orders");

    expect(await screen.findByText("Loading orders...")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    loggedIn();
    mockFetch(orderServer([]));
    renderApp("/orders");

    expect(await screen.findByText("You have no orders yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/products");
  });

  it("shows an error and recovers with Try again", async () => {
    loggedIn();
    const base = orderServer([PENDING]);
    let listRequests = 0;
    mockFetch((url, init) => {
      if (url === "/api/order-service/orders") {
        listRequests += 1;
        if (listRequests === 1) return jsonResponse(500, { detail: "Order service unavailable" });
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    renderApp("/orders");

    expect(await screen.findByRole("alert")).toHaveTextContent("Order service unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Order #101")).toBeInTheDocument();
  });

  it("shows the Orders link only for logged-in users", async () => {
    loggedIn();
    mockFetch(orderServer([]));
    const { unmount } = renderApp("/");
    const header = within(screen.getByRole("banner"));
    expect(await header.findByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");
    unmount();

    localStorage.clear();
    mockFetch(orderServer([]));
    renderApp("/login");
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: "Orders" }),
    ).not.toBeInTheDocument();
  });

  it("redirects to /login when logged out", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    renderApp("/orders");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Order detail page", () => {
  it("shows items, total, shipping address and Pending status", async () => {
    loggedIn();
    mockFetch(orderServer([PENDING]));
    renderApp("/orders/101");

    expect(await screen.findByRole("heading", { name: "Order #101" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    expect(main.getByText("Placed on Oct 16, 2026")).toBeInTheDocument();
    expect(main.getByText("Pending")).toBeInTheDocument();
    expect(main.getByText("ESP32 DevKit")).toBeInTheDocument();
    expect(main.getByText("2 x $9.99")).toBeInTheDocument();
    expect(main.getByText("$19.98")).toBeInTheDocument();
    expect(main.getByText("DHT22 Sensor")).toBeInTheDocument();
    expect(main.getByText("$24.48")).toBeInTheDocument();
    expect(main.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(main.getByText("12 Analytical St")).toBeInTheDocument();
    expect(main.getByText("London")).toBeInTheDocument();
    expect(main.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("pays the order and shows Paid", async () => {
    loggedIn();
    const fetchMock = mockFetch(orderServer([PENDING]));
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Pay now" }));

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    const pay = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/orders/101/pay"))!;
    expect(pay[1]?.method).toBe("POST");
    expect((pay[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("does not offer payment for a paid order", async () => {
    loggedIn();
    mockFetch(orderServer([PAID]));
    renderApp("/orders/100");

    expect(await screen.findByRole("heading", { name: "Order #100" })).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("shows the payment error and keeps the order pending", async () => {
    loggedIn();
    const base = orderServer([PENDING]);
    mockFetch((url, init) =>
      url.endsWith("/pay") ? jsonResponse(409, { detail: "Order is no longer payable" }) : base(url, init),
    );
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Pay now" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Order is no longer payable");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeEnabled();
  });

  it("shows a not-found state for an unknown order", async () => {
    loggedIn();
    mockFetch(orderServer([PENDING]));
    renderApp("/orders/999");

    expect(await screen.findByRole("heading", { name: "Order not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to orders" })).toHaveAttribute("href", "/orders");
  });
});
