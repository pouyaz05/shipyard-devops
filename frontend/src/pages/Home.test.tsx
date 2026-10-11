import { screen } from "@testing-library/react";
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

describe("Home", () => {
  it("renders the hero text", async () => {
    mockFetch(() => jsonResponse(200, productPage([])));
    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Electronic parts for makers" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No products yet")).toBeInTheDocument();
  });

  it("shows featured products with formatted prices", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, productPage([BOARD, SENSOR])));
    renderApp("/");

    expect(screen.getByRole("status")).toHaveTextContent("Loading products...");
    expect(await screen.findByText("ESP32 DevKit")).toBeInTheDocument();
    expect(screen.getByText("DHT22 Sensor")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("$4.50")).toBeInTheDocument();

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url.startsWith("/api/product-service/products")).toBe(true);
    expect(new URL(url, "http://localhost").searchParams.get("page_size")).toBe("4");
  });

  it("shows an error state without hiding the hero", async () => {
    mockFetch(() => jsonResponse(500, { detail: "Catalog is down" }));
    renderApp("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("Catalog is down");
    expect(
      screen.getByRole("heading", { name: "Electronic parts for makers" }),
    ).toBeInTheDocument();
  });
});
