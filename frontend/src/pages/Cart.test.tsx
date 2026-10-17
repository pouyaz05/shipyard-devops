import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import { cartBody, makeCartItem, type RawCartItem } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };
const BOARD = makeCartItem({ quantity: 2 }); // 2 x $9.99
const SENSOR = makeCartItem({ product_id: "2", name: "DHT22 Sensor", unit_price_cents: 450, quantity: 3 }); // 3 x $4.50

// A tiny in-memory cart-service.
function cartServer(initial: RawCartItem[]) {
  let items = initial;
  return (url: string, init?: RequestInit): Response => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/users/me")) return jsonResponse(200, USER);
    if (url === "/api/cart-service/cart" && method === "GET") return jsonResponse(200, cartBody(items));
    const match = url.match(/^\/api\/cart-service\/cart\/items\/(.+)$/);
    if (match && method === "PATCH") {
      const { quantity } = JSON.parse(String(init?.body)) as { quantity: number };
      items = items.map((i) => (i.product_id === match[1] ? { ...i, quantity } : i));
      return jsonResponse(200, cartBody(items));
    }
    if (match && method === "DELETE") {
      items = items.filter((i) => i.product_id !== match[1]);
      return new Response(null, { status: 204 });
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

function loggedIn() {
  localStorage.setItem(TOKEN_KEY, "tok");
}

describe("Cart page", () => {
  it("lists items with quantities, line totals and the total", async () => {
    loggedIn();
    mockFetch(cartServer([BOARD, SENSOR]));
    renderApp("/cart");

    const boardRow = (await screen.findByText("ESP32 DevKit")).closest("li")!;
    expect(within(boardRow).getByText("$9.99 each")).toBeInTheDocument();
    expect(within(boardRow).getByText("2")).toBeInTheDocument();
    expect(within(boardRow).getByText("$19.98")).toBeInTheDocument();

    const sensorRow = screen.getByText("DHT22 Sensor").closest("li")!;
    expect(within(sensorRow).getByText("$4.50 each")).toBeInTheDocument();
    expect(within(sensorRow).getByText("3")).toBeInTheDocument();
    expect(within(sensorRow).getByText("$13.50")).toBeInTheDocument();

    expect(screen.getByText("$33.48")).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "Cart, 5 items" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state", async () => {
    loggedIn();
    mockFetch((url) =>
      url.endsWith("/users/me") ? jsonResponse(200, USER) : new Promise<Response>(() => {}),
    );
    renderApp("/cart");

    expect(await screen.findByText("Loading your cart...")).toBeInTheDocument();
  });

  it("increases the quantity and updates the total", async () => {
    loggedIn();
    const fetchMock = mockFetch(cartServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/cart");
    await screen.findByText("ESP32 DevKit");

    await user.click(screen.getByRole("button", { name: "Increase quantity of ESP32 DevKit" }));

    expect(await screen.findByText("$43.47")).toBeInTheDocument(); // 3 x 9.99 + 3 x 4.50
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(String(patch[0])).toBe("/api/cart-service/cart/items/1");
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ quantity: 3 });
    expect((patch[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("decreases the quantity", async () => {
    loggedIn();
    mockFetch(cartServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/cart");
    await screen.findByText("DHT22 Sensor");

    await user.click(screen.getByRole("button", { name: "Decrease quantity of DHT22 Sensor" }));

    expect(await screen.findByText("$28.98")).toBeInTheDocument(); // 2 x 9.99 + 2 x 4.50
  });

  it("disables decrease at quantity 1", async () => {
    loggedIn();
    mockFetch(cartServer([makeCartItem({ quantity: 1 })]));
    renderApp("/cart");

    expect(
      await screen.findByRole("button", { name: "Decrease quantity of ESP32 DevKit" }),
    ).toBeDisabled();
  });

  it("removes an item", async () => {
    loggedIn();
    const fetchMock = mockFetch(cartServer([BOARD, SENSOR]));
    const user = userEvent.setup();
    renderApp("/cart");
    await screen.findByText("DHT22 Sensor");

    await user.click(screen.getByRole("button", { name: "Remove DHT22 Sensor" }));

    await waitFor(() => expect(screen.queryByText("DHT22 Sensor")).not.toBeInTheDocument());
    expect(screen.getByText("ESP32 DevKit")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    expect(
      await within(screen.getByRole("banner")).findByRole("link", { name: "Cart, 2 items" }),
    ).toBeInTheDocument();
  });

  it("shows the empty cart with a link to Products", async () => {
    loggedIn();
    mockFetch(cartServer([]));
    renderApp("/cart");

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/products");
  });

  it("shows a load error and recovers with Try again", async () => {
    loggedIn();
    const base = cartServer([BOARD]);
    let cartRequests = 0;
    mockFetch((url, init) => {
      if (url === "/api/cart-service/cart") {
        cartRequests += 1;
        if (cartRequests === 1) return jsonResponse(500, { detail: "Cart service unavailable" });
      }
      return base(url, init);
    });
    const user = userEvent.setup();
    renderApp("/cart");

    expect(await screen.findByRole("alert")).toHaveTextContent("Cart service unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("ESP32 DevKit")).toBeInTheDocument();
  });

  it("shows the server message on 409 (not enough stock) and keeps the quantity", async () => {
    loggedIn();
    const base = cartServer([BOARD, SENSOR]);
    mockFetch((url, init) =>
      init?.method === "PATCH"
        ? jsonResponse(409, { detail: "Only 3 DHT22 Sensor left in stock" })
        : base(url, init),
    );
    const user = userEvent.setup();
    renderApp("/cart");
    await screen.findByText("DHT22 Sensor");

    await user.click(screen.getByRole("button", { name: "Increase quantity of DHT22 Sensor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 3 DHT22 Sensor left in stock");
    const sensorRow = screen.getByText("DHT22 Sensor").closest("li")!;
    expect(within(sensorRow).getByText("3")).toBeInTheDocument();
  });

  it("redirects to /login when logged out", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    renderApp("/cart");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
