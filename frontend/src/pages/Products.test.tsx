import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeProduct, productPage } from "../test/fixtures";
import { jsonResponse, mockFetch, renderApp } from "../test/utils";

const BOARD = makeProduct();
const SENSOR = makeProduct({
  id: "2",
  slug: "dht22",
  name: "DHT22 Sensor",
  price_cents: 450,
  stock: 3,
  category: { name: "Sensors", slug: "sensors" },
});
const CATEGORIES = [
  { name: "Boards", slug: "boards" },
  { name: "Sensors", slug: "sensors" },
];

function catalogHandler(listBody: unknown) {
  return (url: string) => {
    if (url.includes("/api/product-service/categories")) return jsonResponse(200, CATEGORIES);
    if (url.includes("/api/product-service/products")) return jsonResponse(200, listBody);
    return jsonResponse(404, { detail: "Not found" });
  };
}

function listCalls(fetchMock: ReturnType<typeof mockFetch>): URL[] {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/product-service/products");
}

describe("Products page", () => {
  it("shows a loading state, then the grid with prices and stock", async () => {
    mockFetch(catalogHandler(productPage([BOARD, SENSOR])));
    renderApp("/products");

    expect(screen.getByRole("status")).toHaveTextContent("Loading products...");
    expect(await screen.findByText("ESP32 DevKit")).toBeInTheDocument();
    expect(screen.getByText("DHT22 Sensor")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("shows an error and recovers with Try again", async () => {
    let listRequests = 0;
    mockFetch((url) => {
      if (url.includes("/categories")) return jsonResponse(200, CATEGORIES);
      listRequests += 1;
      return listRequests === 1
        ? jsonResponse(500, { detail: "Server exploded" })
        : jsonResponse(200, productPage([BOARD]));
    });
    const user = userEvent.setup();
    renderApp("/products");

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("ESP32 DevKit")).toBeInTheDocument();
  });

  it("shows an empty state and clears filters", async () => {
    const fetchMock = mockFetch(catalogHandler(productPage([])));
    const user = userEvent.setup();
    renderApp("/products?q=xyz");

    expect(await screen.findByText("No products found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await screen.findByText("No products found");
    const calls = listCalls(fetchMock);
    expect(calls[calls.length - 1].searchParams.has("q")).toBe(false);
  });

  it("searches when the form is submitted", async () => {
    const fetchMock = mockFetch(catalogHandler(productPage([BOARD])));
    const user = userEvent.setup();
    renderApp("/products");
    await screen.findByText("ESP32 DevKit");

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "esp32");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("ESP32 DevKit");
    const calls = listCalls(fetchMock);
    const last = calls[calls.length - 1];
    expect(last.searchParams.get("q")).toBe("esp32");
    expect(last.searchParams.get("page")).toBe("1");
  });

  it("filters by category", async () => {
    const fetchMock = mockFetch(catalogHandler(productPage([BOARD, SENSOR])));
    const user = userEvent.setup();
    renderApp("/products");
    await screen.findByRole("option", { name: "Sensors" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "sensors");

    await screen.findByText("DHT22 Sensor");
    const calls = listCalls(fetchMock);
    expect(calls[calls.length - 1].searchParams.get("category")).toBe("sensors");
  });

  it("paginates with Previous and Next", async () => {
    const fetchMock = mockFetch(catalogHandler(productPage([BOARD], { total: 30 })));
    const user = userEvent.setup();
    renderApp("/products");

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    const calls = listCalls(fetchMock);
    const last = calls[calls.length - 1];
    expect(last.searchParams.get("page")).toBe("2");
    expect(last.searchParams.get("page_size")).toBe("12");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });
});
