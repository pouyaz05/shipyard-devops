import { screen, within } from "@testing-library/react";
import { TOKEN_KEY } from "../api/client";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };

describe("ProtectedRoute", () => {
  it("redirects to /login when logged out", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the account page when the stored token is valid", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    mockFetch((url) =>
      url.endsWith("/users/me") ? jsonResponse(200, USER) : jsonResponse(404, { detail: "Not found" }),
    );
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    expect(main.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(main.getByText("ada@example.com")).toBeInTheDocument();
  });
});
