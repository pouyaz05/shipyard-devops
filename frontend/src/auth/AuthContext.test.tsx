import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import { productPage } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };

describe("AuthProvider", () => {
  it("clears the stored token when /users/me returns 401", async () => {
    localStorage.setItem(TOKEN_KEY, "expired");
    mockFetch(() => jsonResponse(401, { detail: "Invalid or expired token" }));
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("shows the user email and Logout in the header, and logs out", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    mockFetch((url) =>
      url.endsWith("/users/me") ? jsonResponse(200, USER) : jsonResponse(200, productPage([])),
    );
    const user = userEvent.setup();
    renderApp("/");

    const header = within(screen.getByRole("banner"));
    expect(await header.findByRole("link", { name: "ada@example.com" })).toBeInTheDocument();
    expect(header.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();

    await user.click(header.getByRole("button", { name: "Logout" }));

    expect(await header.findByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Register" })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
