import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("Register page", () => {
  it("validates the form before calling the API", async () => {
    const fetchMock = mockFetch(() => jsonResponse(500, {}));
    const user = userEvent.setup();
    renderApp("/register");

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers, logs in and redirects to /account", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.endsWith("/auth/register")) return jsonResponse(201, USER);
      if (url.endsWith("/auth/login")) {
        return jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 });
      }
      if (url.endsWith("/users/me")) return jsonResponse(200, USER);
      return jsonResponse(404, { detail: "Not found" });
    });
    const user = userEvent.setup();
    renderApp("/register");

    await fillForm(user);

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/user-service/auth/register",
      "/api/user-service/auth/login",
      "/api/user-service/users/me",
    ]);
  });

  it("shows the 409 error inline", async () => {
    mockFetch(() => jsonResponse(409, { detail: "Email already registered" }));
    const user = userEvent.setup();
    renderApp("/register");

    await fillForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("links to the login page", async () => {
    mockFetch(() => jsonResponse(500, {}));
    const user = userEvent.setup();
    renderApp("/register");

    await user.click(screen.getByRole("link", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
