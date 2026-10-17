import { centsToDollarInput, dollarsToCents, formatCents } from "./money";

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

describe("dollarsToCents", () => {
  it("converts dollar amounts to integer cents", () => {
    expect(dollarsToCents("9.99")).toBe(999);
    expect(dollarsToCents("12.5")).toBe(1250);
    expect(dollarsToCents("12.50")).toBe(1250);
    expect(dollarsToCents("10")).toBe(1000);
    expect(dollarsToCents("0.07")).toBe(7);
    expect(dollarsToCents(" 19.99 ")).toBe(1999);
  });

  it("avoids floating point errors", () => {
    expect(dollarsToCents("1.15")).toBe(115);
    expect(dollarsToCents("0.29")).toBe(29);
    expect(dollarsToCents("19.90")).toBe(1990);
  });

  it("rejects anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-1", "1.234", "1,50", ".5", "5.", "1e3", "$5"]) {
      expect(dollarsToCents(bad)).toBeNull();
    }
  });
});

describe("centsToDollarInput", () => {
  it("formats cents for a form field", () => {
    expect(centsToDollarInput(999)).toBe("9.99");
    expect(centsToDollarInput(1000)).toBe("10.00");
    expect(centsToDollarInput(5)).toBe("0.05");
    expect(centsToDollarInput(Number.NaN)).toBe("");
  });
});
