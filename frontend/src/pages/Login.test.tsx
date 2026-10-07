import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_KEY } from "../api/client";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const USER = { id: "1", email: "ada@example.com", full_name: "Ada Lovelace" };

function authHandler(url: string) {
  if (url.endsWith("/auth/login")) {
    return jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 });
  }
  if (url.endsWith("/users/me")) return jsonResponse(200, USER);
  return jsonResponse(404, { detail: "Not found" });
}

describe("Login page", () => {
  it("validates the form before calling the API", async () => {
    const fetchMock = mockFetch(authHandler);
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /account after a successful login", async () => {
    const fetchMock = mockFetch(authHandler);
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    expect(main.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(main.getByText("ada@example.com")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok");

    const loginCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/auth/login"));
    expect(JSON.parse(String(loginCall![1]!.body))).toEqual({
      email: "ada@example.com",
      password: "correct-horse-battery",
    });
    const meCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/users/me"));
    expect((meCall![1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("shows the server error inline", async () => {
    mockFetch(() => jsonResponse(401, { detail: "Invalid credentials" }));
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("disables the button while the request is in flight", async () => {
    mockFetch(() => new Promise<Response>(() => {}));
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("button", { name: "Logging in..." })).toBeDisabled();
  });

  it("links to the register page", async () => {
    mockFetch(authHandler);
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(screen.getByRole("link", { name: "Create an account" }));
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
});
