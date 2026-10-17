import { ApiError } from "../api/client";

export function orderErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.message.startsWith("Request failed")) {
      if (err.status === 409) {
        return "Prices or stock changed since you added these items. Please review your cart and try again.";
      }
      if (err.status === 400) return "Your cart is empty.";
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
