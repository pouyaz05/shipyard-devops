import { screen, within } from "@testing-library/react";
import { cartBody, productPage } from "../test/fixtures";
import { ADMIN, USER, loginAs } from "../test/users";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

function server(me: unknown) {
  return (url: string): Response => {
    if (url.endsWith("/users/me")) return jsonResponse(200, me);
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url.startsWith("/api/product-service/products?")) return jsonResponse(200, productPage([]));
    if (url.startsWith("/api/order-service/admin/orders")) return jsonResponse(200, { items: [] });
    return jsonResponse(404, { detail: "Not found" });
  };
}

describe("AdminRoute", () => {
  it("lets an admin in and shows the Admin link", async () => {
    loginAs();
    mockFetch(server(ADMIN));
    renderApp("/admin/products");

    expect(await screen.findByRole("heading", { name: "Manage products" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "Admin" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("redirects /admin to the products page", async () => {
    loginAs();
    mockFetch(server(ADMIN));
    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: "Manage products" })).toBeInTheDocument();
  });

  it("shows the orders page under /admin/orders", async () => {
    loginAs();
    mockFetch(server(ADMIN));
    renderApp("/admin/orders");

    expect(await screen.findByRole("heading", { name: "Manage orders" })).toBeInTheDocument();
  });

  it("sends a non-admin to the home page without calling admin APIs", async () => {
    loginAs();
    const fetchMock = mockFetch(server(USER));
    renderApp("/admin/products");

    expect(
      await screen.findByRole("heading", { name: "Electronic parts for makers" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: "Admin" }),
    ).not.toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("include_inactive") || url.includes("/admin/"))).toBe(false);
  });

  it("sends a logged-out visitor to /login", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    renderApp("/admin/orders");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows Not found for an unknown admin page", async () => {
    loginAs();
    mockFetch(server(ADMIN));
    renderApp("/admin/nope");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
