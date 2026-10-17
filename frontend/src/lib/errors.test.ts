import { ApiError } from "../api/client";
import { describeError, loadErrorMessage } from "./errors";

describe("describeError", () => {
  it("explains 401 and 403 clearly", () => {
    expect(describeError(new ApiError(401, "Not authenticated"))).toBe(
      "Your session has expired. Please log in again.",
    );
    expect(describeError(new ApiError(403, "Forbidden"))).toBe(
      "You don't have permission to do this.",
    );
  });

  it("uses the server detail for 409, or a fallback when there is none", () => {
    expect(describeError(new ApiError(409, "SKU already exists"))).toBe("SKU already exists");
    expect(describeError(new ApiError(409, "Request failed (409)"), "Already changed.")).toBe(
      "Already changed.",
    );
  });

  it("passes other API messages through and handles unknown errors", () => {
    expect(describeError(new ApiError(500, "Boom"))).toBe("Boom");
    expect(describeError(new Error("x"))).toBe("Something went wrong. Please try again.");
  });
});

describe("loadErrorMessage", () => {
  it("maps 401 and 403 and keeps other messages", () => {
    expect(loadErrorMessage("x", 403)).toBe("You don't have permission to view this page.");
    expect(loadErrorMessage("x", 401)).toBe("Your session has expired. Please log in again.");
    expect(loadErrorMessage("Server down", 500)).toBe("Server down");
    expect(loadErrorMessage("Network error", null)).toBe("Network error");
  });
});
