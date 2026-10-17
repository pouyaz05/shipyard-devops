import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cartBody } from "../test/fixtures";
import { USER, loginAs } from "../test/users";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

function accountServer(options: { patchFailure?: { status: number; detail: string }; hang?: boolean } = {}) {
  let me = { ...USER };
  return (url: string, init?: RequestInit): Response | Promise<Response> => {
    if (url === "/api/cart-service/cart") return jsonResponse(200, cartBody([]));
    if (url.endsWith("/users/me")) {
      if (init?.method === "PATCH") {
        if (options.hang) return new Promise<Response>(() => {});
        if (options.patchFailure) {
          return jsonResponse(options.patchFailure.status, { detail: options.patchFailure.detail });
        }
        const { full_name } = JSON.parse(String(init.body)) as { full_name: string };
        me = { ...me, full_name };
        return jsonResponse(200, me);
      }
      return jsonResponse(200, me);
    }
    return jsonResponse(404, { detail: "Not found" });
  };
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Edit name" }));
}

describe("Account page", () => {
  it("shows the name, the email and a link to Orders", async () => {
    loginAs();
    mockFetch(accountServer());
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    expect(main.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(main.getByText("ada@example.com")).toBeInTheDocument();
    expect(main.getByRole("link", { name: "View your orders" })).toHaveAttribute("href", "/orders");
  });

  it("edits the name", async () => {
    loginAs();
    const fetchMock = mockFetch(accountServer());
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // the email is not editable
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Ada King");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Ada King")).toBeInTheDocument();
    expect(screen.getByText("Name updated.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(String(patch[0])).toBe("/api/user-service/users/me");
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ full_name: "Ada King" });
    expect((patch[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("validates an empty name", async () => {
    loginAs();
    const fetchMock = mockFetch(accountServer());
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("goes back without saving on Cancel", async () => {
    loginAs();
    const fetchMock = mockFetch(accountServer());
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    await user.type(screen.getByLabelText("Name"), " Jr");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("shows a clear message for a 403", async () => {
    loginAs();
    mockFetch(accountServer({ patchFailure: { status: 403, detail: "Forbidden" } }));
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    await user.type(screen.getByLabelText("Name"), " Jr");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do this.");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the server message for a 409", async () => {
    loginAs();
    mockFetch(accountServer({ patchFailure: { status: 409, detail: "Name is reserved" } }));
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    await user.type(screen.getByLabelText("Name"), " Jr");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is reserved");
  });

  it("disables Save while saving", async () => {
    loginAs();
    mockFetch(accountServer({ hang: true }));
    const user = userEvent.setup();
    renderApp("/account");

    await openEditor(user);
    await user.type(screen.getByLabelText("Name"), " Jr");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
  });
});
