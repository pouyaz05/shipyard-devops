import { formatCents } from "./money";

describe("formatCents", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(999)).toBe("$9.99");
    expect(formatCents(1999)).toBe("$19.99");
  });

  it("adds thousands separators", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(100000000)).toBe("$1,000,000.00");
  });

  it("returns N/A for invalid values", () => {
    expect(formatCents(Number.NaN)).toBe("N/A");
  });
});
