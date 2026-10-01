import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

describe("Home", () => {
  it("renders the hero text", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Electronic parts for makers" }),
    ).toBeInTheDocument();
  });
});
