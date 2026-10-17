import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cartBody, makeCartItem, makeOrder } from "../../test/fixtures";
import { ADMIN, loginAs } from "../../test/users";
import { jsonResponse, mockFetch, renderApp } from "../../test/utils";

type Raw = Record<string, unknown>;

const BOARD = makeCartItem({ quantity: 2 }); // 2 x $9.99
const SENSOR = makeCartItem({ product_id: "2", name: "DHT22 Sensor", unit_price_cents: 450, quantity: 1 });

// $24.48, paid
const PAID: Raw = {
  ...makeOrder({ id: "101", status: "PAID", created_at: "2026-10-16T12:00:00Z", items: [BOARD, SENSOR] }),
  user_email: "ada@example.com",
};
// $4.50, shipped
const SHIPPED: Raw = {
  ...makeOrder({ id: "102", status: "SHIPPED", created_at: "2026-10-12T12:00:00Z", items: [SENSOR] }),
  user_email: "grace@example.com",
};
// $9.99, waiting for payment
const PENDING: Raw = {
  ...makeOrder({
    id: "103",
    status: "PENDING_PAYMENT",
    created_at: "2026-10-14T12:00:00Z",
    items: [makeCartItem({ quantity: 1 })],
  }),
  user_email: "alan@example.com",
};

// A tiny in-memory order-service (admin side).
function orderServer(
  initial: Raw[],
  options: { statusFailure?: { status: number; detail: string } } = {},
) {
  let orders = initial;
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, ADMIN);
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url.startsWith("/api/order-service/admin/orders") && method === "GET") {
      const status = new URL(url, "http://localhost").searchParams.get("status");
      const items = status ? orders.filter((o) => String(o.status).toUpperCase() === status) : orders;
      return jsonResponse(200, { items });
    }
    const match = url.match(/^\/api\/order-service\/admin\/orders\/([^/]+)\/status$/);
    if (match && method === "PATCH") {
      if (options.statusFailure) {
        return jsonResponse(options.statusFailure.status, { detail: options.statusFailure.detail });
      }
      const { status } = JSON.parse(String(init?.body)) as { status: string };
      orders = orders.map((o) => (o.id === match[1] ? { ...o, status } : o));
      return jsonResponse(200, {});
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

function row(orderNumber: string): HTMLElement {
  return screen.getByText(`Order #${orderNumber}`).closest("tr")!;
}

describe("Admin orders", () => {
  it("lists orders with customer, date, total and status", async () => {
    loginAs();
    mockFetch(orderServer([PAID, SHIPPED, PENDING]));
    renderApp("/admin/orders");

    await screen.findByText("Order #101");
    expect(within(row("101")).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(row("101")).getByText("Oct 16, 2026")).toBeInTheDocument();
    expect(within(row("101")).getByText("$24.48")).toBeInTheDocument();
    expect(within(row("101")).getByText("Paid")).toBeInTheDocument();
    expect(within(row("102")).getByText("Shipped")).toBeInTheDocument();
    expect(within(row("103")).getByText("Pending")).toBeInTheDocument();
  });

  it("offers an action only for paid and shipped orders", async () => {
    loginAs();
    mockFetch(orderServer([PAID, SHIPPED, PENDING]));
    renderApp("/admin/orders");
    await screen.findByText("Order #101");

    expect(
      within(row("101")).getByRole("button", { name: "Mark order #101 as shipped" }),
    ).toHaveTextContent("Mark as shipped");
    expect(
      within(row("102")).getByRole("button", { name: "Mark order #102 as delivered" }),
    ).toHaveTextContent("Mark as delivered");
    expect(within(row("103")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    loginAs();
    const fetchMock = mockFetch(orderServer([PAID, SHIPPED, PENDING]));
    const user = userEvent.setup();
    renderApp("/admin/orders");
    await screen.findByText("Order #101");

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "paid");

    await waitFor(() => expect(screen.queryByText("Order #102")).not.toBeInTheDocument());
    expect(screen.getByText("Order #101")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/admin/orders?status=PAID")),
    ).toBe(true);
  });

  it("marks a paid order as shipped, then as delivered", async () => {
    loginAs();
    const fetchMock = mockFetch(orderServer([PAID]));
    const user = userEvent.setup();
    renderApp("/admin/orders");

    await user.click(await screen.findByRole("button", { name: "Mark order #101 as shipped" }));

    const delivered = await screen.findByRole("button", { name: "Mark order #101 as delivered" });
    expect(within(row("101")).getByText("Shipped")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(String(patch[0])).toBe("/api/order-service/admin/orders/101/status");
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ status: "SHIPPED" });
    expect((patch[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");

    await user.click(delivered);

    await waitFor(() => expect(within(row("101")).getByText("Delivered")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Mark order #101/ })).not.toBeInTheDocument();
  });

  it("shows the server message on 409", async () => {
    loginAs();
    mockFetch(
      orderServer([PAID], { statusFailure: { status: 409, detail: "Order was already shipped" } }),
    );
    const user = userEvent.setup();
    renderApp("/admin/orders");

    await user.click(await screen.findByRole("button", { name: "Mark order #101 as shipped" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Order was already shipped");
    expect(within(row("101")).getByText("Paid")).toBeInTheDocument();
  });

  it("explains a 403", async () => {
    loginAs();
    mockFetch(orderServer([PAID], { statusFailure: { status: 403, detail: "Forbidden" } }));
    const user = userEvent.setup();
    renderApp("/admin/orders");

    await user.click(await screen.findByRole("button", { name: "Mark order #101 as shipped" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have permission to do this.",
    );
  });

  it("shows the empty state", async () => {
    loginAs();
    mockFetch(orderServer([]));
    renderApp("/admin/orders");

    expect(await screen.findByText("No orders found")).toBeInTheDocument();
  });

  it("shows a loading state and an error with retry", async () => {
    loginAs();
    const base = orderServer([PAID]);
    let listRequests = 0;
    mockFetch((url, init) => {
      if (url.startsWith("/api/order-service/admin/orders")) {
        listRequests += 1;
        if (listRequests === 1) return jsonResponse(500, { detail: "Order service unavailable" });
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    renderApp("/admin/orders");

    expect(await screen.findByRole("alert")).toHaveTextContent("Order service unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Order #101")).toBeInTheDocument();
  });
});
