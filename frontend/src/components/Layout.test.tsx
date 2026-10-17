import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { productPage } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

describe("Navbar", () => {
  it("shows Products, Cart, Login and Register when logged out", () => {
    mockFetch(() => jsonResponse(200, productPage([])));
    renderApp("/login");

    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Products" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Register" })).toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("navigates to the catalog from the Products link", async () => {
    mockFetch(() => jsonResponse(200, productPage([])));
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(within(screen.getByRole("banner")).getByRole("link", { name: "Products" }));
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
  });
});
