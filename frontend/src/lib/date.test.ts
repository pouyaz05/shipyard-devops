import { formatDate } from "./date";

describe("formatDate", () => {
  it("formats an ISO date", () => {
    expect(formatDate("2026-10-16T12:00:00Z")).toBe("Oct 16, 2026");
  });

  it("returns N/A for invalid input", () => {
    expect(formatDate("")).toBe("N/A");
    expect(formatDate("not a date")).toBe("N/A");
  });
});
