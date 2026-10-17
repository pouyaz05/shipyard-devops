import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeProduct } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const URL_PATH = "/api/product-service/products/esp32-devkit";

describe("ProductDetail page", () => {
  it("shows price, stock and description", async () => {
    const product = makeProduct();
    const fetchMock = mockFetch((url) =>
      url === URL_PATH ? jsonResponse(200, product) : jsonResponse(404, { detail: "Not found" }),
    );
    renderApp("/products/esp32-devkit");

    expect(screen.getByRole("status")).toHaveTextContent("Loading product...");
    expect(await screen.findByRole("heading", { name: "ESP32 DevKit" })).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByText("42 units available")).toBeInTheDocument();
    expect(screen.getByText(product.description)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to products/ })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe(URL_PATH);
  });

  it("shows out of stock", async () => {
    mockFetch(() => jsonResponse(200, makeProduct({ stock: 0 })));
    renderApp("/products/esp32-devkit");

    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText(/units? available/)).not.toBeInTheDocument();
  });

  it("shows a not-found state for a 404", async () => {
    mockFetch(() => jsonResponse(404, { detail: "Product not found" }));
    renderApp("/products/nope");

    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to products" })).toBeInTheDocument();
  });

  it("shows an error and recovers with Try again", async () => {
    let requests = 0;
    mockFetch(() => {
      requests += 1;
      return requests === 1
        ? jsonResponse(500, { detail: "Server exploded" })
        : jsonResponse(200, makeProduct());
    });
    const user = userEvent.setup();
    renderApp("/products/esp32-devkit");

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "ESP32 DevKit" })).toBeInTheDocument();
  });
});
