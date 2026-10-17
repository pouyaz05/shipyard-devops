import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { cartBody, makeOrder } from "../test/fixtures";
import { USER, loginAs } from "../test/users";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

// A tiny in-memory order-service with one order.
function orderServer(status: string, options: { cancelFailure?: { status: number; detail: string } } = {}) {
  let order = makeOrder({ id: "101", status });
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, USER);
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url === "/api/order-service/orders/101" && method === "GET") return jsonResponse(200, order);
    if (url === "/api/order-service/orders/101/cancel" && method === "POST") {
      if (options.cancelFailure) {
        return jsonResponse(options.cancelFailure.status, { detail: options.cancelFailure.detail });
      }
      order = { ...order, status: "CANCELLED" };
      return jsonResponse(200, {});
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cancel order", () => {
  it("is offered for PENDING_PAYMENT orders", async () => {
    loginAs();
    mockFetch(orderServer("PENDING_PAYMENT"));
    renderApp("/orders/101");

    expect(await screen.findByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it.each(["PAID", "SHIPPED", "DELIVERED", "CANCELLED"])("is not offered for %s orders", async (status) => {
    loginAs();
    mockFetch(orderServer(status));
    renderApp("/orders/101");

    expect(await screen.findByRole("heading", { name: "Order #101" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("cancels after confirmation and shows the new status", async () => {
    loginAs();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = mockFetch(orderServer("PENDING_PAYMENT"));
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Cancel order" }));

    const main = within(screen.getByRole("main"));
    expect(await main.findByText("Cancelled")).toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/orders/101/cancel"))!;
    expect(post[1]?.method).toBe("POST");
    expect((post[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("does nothing when the confirmation is declined", async () => {
    loginAs();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = mockFetch(orderServer("PENDING_PAYMENT"));
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Cancel order" }));

    expect(screen.getByRole("button", { name: "Cancel order" })).toBeEnabled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/cancel"))).toBe(false);
  });

  it("shows the server message on 409 and keeps the order pending", async () => {
    loginAs();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch(
      orderServer("PENDING_PAYMENT", { cancelFailure: { status: 409, detail: "Order was already paid" } }),
    );
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Cancel order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Order was already paid");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeEnabled();
  });

  it("explains a 403", async () => {
    loginAs();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch(orderServer("PENDING_PAYMENT", { cancelFailure: { status: 403, detail: "Forbidden" } }));
    const user = userEvent.setup();
    renderApp("/orders/101");

    await user.click(await screen.findByRole("button", { name: "Cancel order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do this.");
  });
});
